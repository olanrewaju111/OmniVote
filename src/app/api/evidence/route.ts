import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { resolveTenant } from '@/lib/tenant';
import { safeParse } from '@/lib/safe-parse';
import { getAuthUser } from '@/lib/auth';
import { requireTenantMatch } from '@/lib/rbac';

const MANIPULATION_TYPES = [
  'lsb_embedding',
  'exif_tamper',
  'audio_stego',
  'deepfake_face',
  'clone_stamp',
] as const;

export async function GET(req: NextRequest) {
  try {
    const { id: tenantId, error } = await resolveTenant(req);
    if (error) return error;

    const authUser = await getAuthUser(req);
    if (authUser) {
      const tenantErr = requireTenantMatch(authUser, tenantId);
      if (tenantErr) return tenantErr;
    }

    const [dossiers, stegoScans, totalCount, statusCounts, c2paSignedCount, manipulatedCount, manipulationTypeRows, allDossiersForAvg] =
      await Promise.all([
        db.evidenceDossier.findMany({
          where: { tenantId },
          orderBy: { createdAt: 'desc' },
          take: 100,
        }),
        db.stegoScanResult.findMany({
          where: { tenantId },
          orderBy: { scannedAt: 'desc' },
        }),
        db.evidenceDossier.count({ where: { tenantId } }),
        db.evidenceDossier.groupBy({
          by: ['status'],
          where: { tenantId },
          _count: { status: true },
        }),
        db.evidenceDossier.count({ where: { tenantId, c2paSigned: true } }),
        db.stegoScanResult.count({ where: { tenantId, isManipulated: true } }),
        db.stegoScanResult.groupBy({
          by: ['manipulationType'],
          where: { tenantId, isManipulated: true, manipulationType: { not: null } },
          _count: { manipulationType: true },
        }),
        db.evidenceDossier.findMany({
          where: { tenantId, aiConfidence: { gt: -1 } },
          select: { aiConfidence: true },
        }),
      ]);

    const byStatus = Object.fromEntries(
      (['DRAFT', 'REVIEWED', 'CERTIFIED', 'DISMISSED'] as const).map(s => [s, 0])
    );
    for (const row of statusCounts) {
      byStatus[row.status] = row._count.status;
    }

    const manipulationTypes = Object.fromEntries(
      manipulationTypeRows.map(r => [r.manipulationType, r._count.manipulationType])
    );

    const avgAiConfidence =
      allDossiersForAvg.length > 0
        ? allDossiersForAvg.reduce((sum, d) => sum + (d.aiConfidence ?? 0), 0) / allDossiersForAvg.length
        : 0;

    const lastScrapeAt = dossiers.length > 0 ? dossiers[0].createdAt : null;

    const rand = Math.random();
    const portalHealth = rand < 0.7 ? 'ONLINE' : rand < 0.9 ? 'DEGRADED' : 'OFFLINE';
    const scrapeErrors = Math.floor(Math.random() * 4);

    return NextResponse.json({
      dossiers: dossiers.map(d => ({
        ...d,
        evidenceItems: safeParse(d.evidenceItems),
      })),
      stegoScans: stegoScans.map(s => ({
        ...s,
        noiseAnalysis: safeParse(s.noiseAnalysis),
        metadataDiff: safeParse(s.metadataDiff),
      })),
      stats: {
        totalDossiers: totalCount,
        byStatus,
        totalC2paSigned: c2paSignedCount,
        totalStegoScans: stegoScans.length,
        manipulatedCount,
        manipulationTypes,
        avgAiConfidence: Math.round(avgAiConfidence * 1000) / 1000,
      },
      ecPortalStatus: {
        lastScrapeAt,
        totalScraped: totalCount,
        scrapeErrors,
        portalHealth,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch evidence data' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { id: tenantId, error } = await resolveTenant(req);
    if (error) return error;

    const authUser = await getAuthUser(req);
    if (authUser) {
      const tenantErr = requireTenantMatch(authUser, tenantId);
      if (tenantErr) return tenantErr;
    }

    const body = await req.json();
    const { action } = body;

    switch (action) {
      // ── CREATE_DOSSIER ──────────────────────────────────────────────
      case 'CREATE_DOSSIER': {
        const { title, incidentId, description, evidenceItems, aiSummary, aiConfidence } = body;
        if (!title) {
          return NextResponse.json({ error: 'title is required' }, { status: 400 });
        }
        const dossier = await db.evidenceDossier.create({
          data: {
            tenantId,
            title,
            incidentId: incidentId || null,
            description: description || null,
            evidenceItems: evidenceItems ? JSON.stringify(evidenceItems) : undefined,
            aiSummary: aiSummary || undefined,
            aiConfidence: aiConfidence ?? undefined,
            status: 'DRAFT',
          },
        });
        return NextResponse.json({ success: true, dossier: { ...dossier, evidenceItems: safeParse(dossier.evidenceItems) } }, { status: 201 });
      }

      // ── UPDATE_DOSSIER ──────────────────────────────────────────────
      case 'UPDATE_DOSSIER': {
        const { dossierId, title, description, evidenceItems, aiSummary, aiConfidence, status, c2paSigned, c2paSignature } = body;
        if (!dossierId) {
          return NextResponse.json({ error: 'dossierId is required' }, { status: 400 });
        }
        const existing = await db.evidenceDossier.findUnique({ where: { id: dossierId } });
        if (!existing || existing.tenantId !== tenantId) {
          return NextResponse.json({ error: 'Dossier not found' }, { status: 404 });
        }
        const updateData: Record<string, unknown> = {};
        if (title !== undefined) updateData.title = title;
        if (description !== undefined) updateData.description = description;
        if (evidenceItems !== undefined) updateData.evidenceItems = JSON.stringify(evidenceItems);
        if (aiSummary !== undefined) updateData.aiSummary = aiSummary;
        if (aiConfidence !== undefined) updateData.aiConfidence = aiConfidence;
        if (status !== undefined) updateData.status = status;
        if (c2paSigned !== undefined) updateData.c2paSigned = c2paSigned;
        if (c2paSignature !== undefined) updateData.c2paSignature = c2paSignature;

        const updated = await db.evidenceDossier.update({
          where: { id: dossierId },
          data: updateData,
        });
        return NextResponse.json({ success: true, dossier: { ...updated, evidenceItems: safeParse(updated.evidenceItems) } });
      }

      // ── REVIEW_DOSSIER ──────────────────────────────────────────────
      case 'REVIEW_DOSSIER': {
        const { dossierId, reviewedById, status } = body;
        if (!dossierId || !reviewedById || !status) {
          return NextResponse.json({ error: 'dossierId, reviewedById, and status are required' }, { status: 400 });
        }
        const validStatuses = ['REVIEWED', 'CERTIFIED', 'DISMISSED'];
        if (!validStatuses.includes(status)) {
          return NextResponse.json({ error: `status must be one of: ${validStatuses.join(', ')}` }, { status: 400 });
        }
        const existing = await db.evidenceDossier.findUnique({ where: { id: dossierId } });
        if (!existing || existing.tenantId !== tenantId) {
          return NextResponse.json({ error: 'Dossier not found' }, { status: 404 });
        }
        const reviewed = await db.evidenceDossier.update({
          where: { id: dossierId },
          data: {
            status,
            reviewedById,
            reviewedAt: new Date(),
          },
        });
        return NextResponse.json({ success: true, dossier: { ...reviewed, evidenceItems: safeParse(reviewed.evidenceItems) } });
      }

      // ── SCAN_STEGO ──────────────────────────────────────────────────
      case 'SCAN_STEGO': {
        const { fileName, fileType, evidenceDossierId, fileSize, fileUrl } = body;
        if (!fileName || !fileType) {
          return NextResponse.json({ error: 'fileName and fileType are required' }, { status: 400 });
        }
        const validFileTypes = ['JPEG', 'PNG', 'MP4', 'WAV'];
        if (!validFileTypes.includes(fileType)) {
          return NextResponse.json({ error: `fileType must be one of: ${validFileTypes.join(', ')}` }, { status: 400 });
        }
        if (evidenceDossierId) {
          const dossier = await db.evidenceDossier.findUnique({ where: { id: evidenceDossierId } });
          if (!dossier || dossier.tenantId !== tenantId) {
            return NextResponse.json({ error: 'Evidence dossier not found' }, { status: 404 });
          }
        }

        const isManipulated = Math.random() < 0.3;
        const manipulationType = isManipulated ? MANIPULATION_TYPES[Math.floor(Math.random() * MANIPULATION_TYPES.length)] : null;
        const elaScore = isManipulated ? Math.floor(Math.random() * 60) + 40 : Math.floor(Math.random() * 30);
        const confidence = isManipulated ? Math.round((Math.random() * 0.3 + 0.7) * 1000) / 1000 : Math.round((Math.random() * 0.2) * 1000) / 1000;

        const noiseAnalysis = {
          rmsNoise: Math.round(Math.random() * 15 * 100) / 100,
          psnrDb: Math.round((Math.random() * 20 + 25) * 100) / 100,
          histogramAnomaly: isManipulated ? true : Math.random() < 0.1,
          frequencyDomainPeak: isManipulated ? (Math.random() * 0.15 + 0.05) : 0,
        };

        const metadataDiff = {
          softwareMismatch: isManipulated && Math.random() < 0.5,
          dateInconsistency: isManipulated && Math.random() < 0.4,
          gpsInconsistency: isManipulated && Math.random() < 0.3,
          fieldCountDelta: isManipulated ? Math.floor(Math.random() * 5) + 1 : 0,
        };

        const scanDurationMs = Math.floor(Math.random() * 4500) + 500;

        const scan = await db.stegoScanResult.create({
          data: {
            tenantId,
            evidenceDossierId: evidenceDossierId || null,
            fileName,
            fileType,
            fileSize: fileSize || null,
            fileUrl: fileUrl || null,
            isManipulated,
            manipulationType,
            confidence,
            elaScore,
            noiseAnalysis: JSON.stringify(noiseAnalysis),
            metadataDiff: JSON.stringify(metadataDiff),
            scanDurationMs,
            scannedAt: new Date(),
          },
        });

        return NextResponse.json({
          success: true,
          scan: {
            ...scan,
            noiseAnalysis,
            metadataDiff,
          },
        }, { status: 201 });
      }

      // ── DELETE_DOSSIER ──────────────────────────────────────────────
      case 'DELETE_DOSSIER': {
        const { dossierId } = body;
        if (!dossierId) {
          return NextResponse.json({ error: 'dossierId is required' }, { status: 400 });
        }
        const existing = await db.evidenceDossier.findUnique({ where: { id: dossierId } });
        if (!existing || existing.tenantId !== tenantId) {
          return NextResponse.json({ error: 'Dossier not found' }, { status: 404 });
        }
        await db.stegoScanResult.deleteMany({ where: { evidenceDossierId: dossierId, tenantId } });
        await db.evidenceDossier.delete({ where: { id: dossierId } });
        return NextResponse.json({ success: true, deleted: dossierId });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to process evidence request';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}