import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import fs from 'node:fs';
import path from 'node:path';

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'video/mp4',
  'application/pdf',
]);

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// Map extension to MIME type for serving files
const EXT_TO_MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.pdf': 'application/pdf',
};

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return EXT_TO_MIME[ext] || 'application/octet-stream';
}

// POST /api/upload — upload a file
export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided. Use field name "file".' }, { status: 400 });
    }

    // Validate MIME type
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: `File type "${file.type}" is not allowed. Allowed: jpg, jpeg, png, gif, webp, mp4, pdf.` },
        { status: 400 },
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File size (${(file.size / 1024 / 1024).toFixed(1)}MB) exceeds the 10MB limit.` },
        { status: 400 },
      );
    }

    // Build unique file path: uploads/{tenantId}/{date}/{randomId}-{originalName}
    const tenantId = authUser.tenantId;
    const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const randomId = crypto.randomUUID().slice(0, 8);
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const relativePath = path.join('uploads', tenantId, date, `${randomId}-${safeName}`);

    // Resolve to the project's public directory
    const publicDir = path.join(process.cwd(), 'public');
    const fullPath = path.join(publicDir, relativePath);

    // Ensure directory exists
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });

    // Write file
    const buffer = await file.arrayBuffer();
    fs.writeFileSync(fullPath, Buffer.from(buffer));

    return NextResponse.json({
      success: true,
      url: `/api/upload/file?path=${encodeURIComponent(relativePath)}`,
      filename: `${randomId}-${safeName}`,
      size: file.size,
      mimeType: file.type,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Upload failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// GET /api/upload/file?path=... — serve an uploaded file
export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const relativePath = searchParams.get('path');

    if (!relativePath) {
      return NextResponse.json({ error: 'Missing "path" query parameter.' }, { status: 400 });
    }

    // Prevent path traversal
    const resolved = path.resolve(path.join(process.cwd(), 'public', relativePath));
    const publicDir = path.resolve(path.join(process.cwd(), 'public'));
    if (!resolved.startsWith(publicDir)) {
      return NextResponse.json({ error: 'Invalid file path.' }, { status: 400 });
    }

    if (!fs.existsSync(resolved)) {
      return NextResponse.json({ error: 'File not found.' }, { status: 404 });
    }

    const fileBuffer = fs.readFileSync(resolved);
    const mimeType = getMimeType(resolved);

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': mimeType,
        'Content-Length': String(fileBuffer.length),
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to serve file';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
