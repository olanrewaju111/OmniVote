import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { resolveTenant } from '@/lib/tenant';
import { safeParse } from '@/lib/safe-parse';
import { getAuthUser } from '@/lib/auth';
import { requireTenantMatch } from '@/lib/rbac';
import { logAudit, extractIp } from '@/lib/audit';

// GET /api/results — fetch results for a polling unit or all
export async function GET(req: NextRequest) {
  try {
    const { id: tenantId, error } = await resolveTenant(req);
    if (error) return error;

    const authUser = await getAuthUser(req);
    if (!authUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const tenantErr = requireTenantMatch(authUser, tenantId);
    if (tenantErr) return tenantErr;

    const { searchParams } = new URL(req.url || "", "http://localhost");
    const pollingUnitId = searchParams.get('pollingUnitId');
    const reporterId = searchParams.get('reporterId');

    const where: Record<string, unknown> = { tenantId };
    if (pollingUnitId) where.pollingUnitId = pollingUnitId;
    if (reporterId) where.reportedById = reporterId;

    const results = await db.electionResult.findMany({
      where,
      include: {
        pollingUnit: { select: { id: true, name: true, code: true, state: true, lga: true, ward: true, registeredVoters: true } },
        reporter: { select: { id: true, name: true, role: true } },
      },
      orderBy: { submittedAt: 'desc' },
      take: 100,
    });

    return NextResponse.json({
      results: results.map(r => ({
        id: r.id,
        accreditedVoters: r.accreditedVoters,
        totalValidVotes: r.totalValidVotes,
        rejectedBallots: r.rejectedBallots,
        totalVotesCast: r.totalVotesCast,
        partyResults: safeParse(r.partyResults),
        bvasUsed: r.bvasUsed,
        materialsArrivedOnTime: r.materialsArrivedOnTime,
        securityPresent: r.securityPresent,
        violenceOccurred: r.violenceOccurred,
        notes: r.notes,
        verified: r.verified,
        submittedAt: r.submittedAt,
        pollingUnit: r.pollingUnit,
        reporter: r.reporter,
      })),
    });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch results' }, { status: 500 });
  }
}

// POST /api/results — submit election results for a polling unit
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      reporterId, pollingUnitId,
      accreditedVoters, totalValidVotes, rejectedBallots, totalVotesCast,
      partyResults, bvasUsed, materialsArrivedOnTime, securityPresent,
      violenceOccurred, notes,
    } = body;

    if (!reporterId || !pollingUnitId) {
      return NextResponse.json({ error: 'reporterId and pollingUnitId are required' }, { status: 400 });
    }
    if (totalVotesCast === undefined || totalVotesCast === null) {
      return NextResponse.json({ error: 'totalVotesCast is required' }, { status: 400 });
    }

    // Resolve reporter's tenant
    const reporter = await db.user.findUnique({ where: { id: reporterId }, select: { tenantId: true } });
    if (!reporter) return NextResponse.json({ error: 'Reporter not found' }, { status: 404 });

    const pu = await db.pollingUnit.findUnique({
      where: { id: pollingUnitId },
      select: { id: true, electionId: true, registeredVoters: true },
    });
    if (!pu) return NextResponse.json({ error: 'Polling unit not found' }, { status: 404 });

    // Check for existing result (only one per PU)
    const existing = await db.electionResult.findFirst({
      where: { tenantId: reporter.tenantId, pollingUnitId },
    });
    if (existing) {
      return NextResponse.json({
        error: 'Results already submitted for this polling unit',
        existingId: existing.id,
      }, { status: 409 });
    }

    // Create the result
    const result = await db.electionResult.create({
      data: {
        tenantId: reporter.tenantId,
        pollingUnitId,
        reportedById: reporterId,
        accreditedVoters: accreditedVoters || 0,
        totalValidVotes: totalValidVotes || 0,
        rejectedBallots: rejectedBallots || 0,
        totalVotesCast: totalVotesCast || 0,
        partyResults: JSON.stringify(partyResults || []),
        bvasUsed: bvasUsed !== false,
        materialsArrivedOnTime: materialsArrivedOnTime !== false,
        securityPresent: securityPresent !== false,
        violenceOccurred: violenceOccurred === true,
        notes: notes || '',
      },
    });

    // Update the polling unit's total votes and turnout
    const newTotalVotes = (pu.registeredVoters > 0 && totalVotesCast > 0)
      ? totalVotesCast : pu.registeredVoters;
    const newTurnout = pu.registeredVoters > 0
      ? Math.round((newTotalVotes / pu.registeredVoters) * 10000) / 100 : 0;

    await db.pollingUnit.update({
      where: { id: pollingUnitId },
      data: { totalVotes: newTotalVotes, turnout: newTurnout, status: 'CLOSED' },
    });

    // Audit log
    void logAudit({
      userId: reporterId,
      action: 'CREATE_ELECTION_RESULT',
      entityType: 'ElectionResult',
      entityId: result.id,
      metadata: { pollingUnitId, totalVotesCast, accreditedVoters, partyCount: (partyResults || []).length },
      ipAddress: extractIp(req),
    });

    // If violence was reported, auto-create an incident
    if (violenceOccurred) {
      try {
        await db.incident.create({
          data: {
            tenantId: reporter.tenantId,
            pollingUnitId,
            reportedById: reporterId,
            type: 'VIOLENCE',
            severity: 'HIGH',
            description: 'Violence reported during result submission at polling unit. Agent noted violence during the voting process.',
          },
        });
        await db.alert.create({
          data: {
            tenantId: reporter.tenantId,
            type: 'SECURITY',
            category: 'WARNING',
            title: 'Violence reported during result submission',
            description: 'Agent reported violence at their polling unit while submitting results.',
          },
        });
      } catch (e: unknown) {
        console.error('[results] Non-fatal: failed to create violence incident/alert', e instanceof Error ? e.message : e);
      }
    }

    return NextResponse.json({
      success: true,
      result: {
        id: result.id,
        totalVotesCast: result.totalVotesCast,
        totalValidVotes: result.totalValidVotes,
        rejectedBallots: result.rejectedBallots,
        partyCount: (partyResults || []).length,
        submittedAt: result.submittedAt,
      },
    }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to submit results';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}