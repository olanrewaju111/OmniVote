import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { getAuthUser } from '@/lib/auth';
import { requireTenantMatch } from '@/lib/rbac';
import { resolveTenant } from '@/lib/tenant';
import { db } from '@/lib/db';
import crypto from 'crypto';

const UPLOAD_DIR = join(process.cwd(), 'uploads');
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'video/mp4', 'video/webm',
  'audio/wav', 'audio/mpeg', 'audio/ogg',
  'application/pdf',
];

export async function POST(req: NextRequest) {
  try {
    const { id: tenantId, error } = await resolveTenant(req);
    if (error) return error;

    const authUser = await getAuthUser(req);
    if (!authUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const tenantErr = requireTenantMatch(authUser, tenantId);
    if (tenantErr) return tenantErr;

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const category = (formData.get('category') as string) || 'evidence';
    const dossierId = formData.get('dossierId') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: `File too large. Max ${MAX_FILE_SIZE / 1024 / 1024}MB` }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: `File type ${file.type} not allowed` }, { status: 400 });
    }

    // Generate unique filename preserving extension
    const ext = file.name.split('.').pop() || 'bin';
    const uniqueName = `${crypto.randomUUID()}.${ext}`;
    const relativePath = `${tenantId}/${category}/${uniqueName}`;
    const fullPath = join(UPLOAD_DIR, relativePath);

    // Ensure directory exists
    await mkdir(join(UPLOAD_DIR, tenantId, category), { recursive: true });

    // Write file
    const bytes = await file.arrayBuffer();
    await writeFile(fullPath, Buffer.from(bytes));

    // Build public URL (served via Next.js static or nginx)
    const fileUrl = `/uploads/${relativePath}`;

    // Audit log
    try {
      await db.auditLog.create({
        data: {
          userId: authUser.userId,
          action: 'FILE_UPLOADED',
          entityType: 'File',
          entityId: uniqueName,
          metadata: JSON.stringify({
            originalName: file.name, size: file.size, type: file.type,
            category, dossierId, path: relativePath,
          }),
        },
      });
    } catch { /* non-fatal */ }

    return NextResponse.json({
      success: true,
      file: {
        name: file.name,
        url: fileUrl,
        size: file.size,
        type: file.type,
        category,
      },
    }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Upload failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}