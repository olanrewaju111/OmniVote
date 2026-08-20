import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { db } from '@/lib/db';
import { resolveTenant } from '@/lib/tenant';
import { safeParse } from '@/lib/safe-parse';
import { getAuthUser } from '@/lib/auth';
import { requireTenantMatch } from '@/lib/rbac';
import { logAudit, extractIp } from '@/lib/audit';
import { requireCsrf } from '@/lib/security/csrf-enforce';

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/pvt?tenantId=X — comprehensive PVT dashboard
// ─────────────────────────────────────────────────────────────────────────────
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
    const electionId = searchParams.get('electionId');

    // -----------------------------------------------------------------------
    // 1. Fetch all PVT submissions (latest 200) with polling unit info
    // -----------------------------------------------------------------------
    const pvtWhere: Record<string, unknown> = { tenantId };
    if (electionId) pvtWhere.electionId = electionId;

    const pvtSubmissions = await db.pvtSubmission.findMany({
      where: pvtWhere,
      include: {
        pollingUnit: { select: { id: true, name: true, code: true, state: true, lga: true, ward: true } },
      },
      orderBy: { submittedAt: 'desc' },
      take: 200,
    });

    const pvtSubmissionsParsed = pvtSubmissions.map(s => ({
      ...s,
      partyResults: safeParse(s.partyResults),
    }));

    // -----------------------------------------------------------------------
    // 2. Fetch existing comparisons
    // -----------------------------------------------------------------------
    const comparisonWhere: Record<string, unknown> = { tenantId };
    if (electionId) comparisonWhere.electionId = electionId;

    const comparisons = await db.resultComparison.findMany({
      where: comparisonWhere,
      include: {
        pollingUnit: { select: { id: true, name: true, code: true, state: true, lga: true, ward: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const comparisonsParsed = comparisons.map(c => ({
      ...c,
      partyDeltas: safeParse(c.partyDeltas),
    }));

    // -----------------------------------------------------------------------
    // 4. Stats counts
    // -----------------------------------------------------------------------
    const [totalSubmissions, verifiedCount, anomalyCount] = await Promise.all([
      db.pvtSubmission.count({ where: pvtWhere }),
      db.pvtSubmission.count({ where: { ...pvtWhere, isVerified: true } }),
      db.resultComparison.count({ where: { ...comparisonWhere, isAnomaly: true } }),
    ]);

    const unitsWithCompRows = await db.resultComparison.groupBy({
      by: ['pollingUnitId'],
      where: {
        tenantId,
        pvtSubmissionId: { not: null },
        officialResultId: { not: null },
        ...(electionId ? { electionId } : {}),
      },
    });
    const unitsWithComparison = unitsWithCompRows.length;

    const bySourceRows = await db.pvtSubmission.groupBy({
      by: ['source'],
      where: pvtWhere,
      _count: { source: true },
    });
    const bySource = Object.fromEntries(bySourceRows.map(g => [g.source, g._count.source])) as Record<string, number>;

    const pvtWithState = await db.pvtSubmission.findMany({
      where: pvtWhere,
      select: { pollingUnit: { select: { state: true } } },
    });
    const stateCountMap: Record<string, number> = {};
    for (const p of pvtWithState) {
      const state = p.pollingUnit?.state || 'Unknown';
      stateCountMap[state] = (stateCountMap[state] || 0) + 1;
    }
    const byState = stateCountMap;

    // -----------------------------------------------------------------------
    // 5. Sankey data
    // -----------------------------------------------------------------------
    const partyColorMap: Record<string, string> = {
      APC: '#009688',
      PDP: '#E91E63',
      LP: '#2196F3',
      NNPP: '#FF9800',
    };
    const defaultColor = '#607D8B';

    const allPartyResults: { party: string; votes: number; state: string }[] = [];
    for (const s of pvtSubmissions) {
      const parties: { party: string; votes: number }[] = safeParse(s.partyResults);
      const state = s.pollingUnit?.state || 'Unknown';
      for (const p of parties) {
        allPartyResults.push({ party: p.party, votes: p.votes, state });
      }
    }

    const partySet = new Set(allPartyResults.map(r => r.party));
    const nodes: { id: string; label: string; color: string }[] = [];

    const stateSet = new Set(pvtWithState.map(p => p.pollingUnit?.state || 'Unknown'));
    for (const state of stateSet) {
      nodes.push({ id: `state_${state}`, label: state, color: '#37474F' });
    }

    for (const party of partySet) {
      nodes.push({ id: `party_${party}`, label: party, color: partyColorMap[party] || defaultColor });
    }

    const linkMap: Record<string, { source: string; target: string; value: number; state: string }> = {};
    for (const r of allPartyResults) {
      const key = `${r.state}->${r.party}`;
      if (!linkMap[key]) {
        linkMap[key] = { source: `state_${r.state}`, target: `party_${r.party}`, value: 0, state: r.state };
      }
      linkMap[key].value += r.votes;
    }
    const links = Object.values(linkMap);

    const sankeyData = { nodes, links };

    // -----------------------------------------------------------------------
    // 6. Party totals (aggregate PVT results by party)
    // -----------------------------------------------------------------------
    const partyTotalsMap: Record<string, number> = {};
    for (const s of pvtSubmissions) {
      const parties: { party: string; votes: number }[] = safeParse(s.partyResults);
      for (const p of parties) {
        partyTotalsMap[p.party] = (partyTotalsMap[p.party] || 0) + p.votes;
      }
    }
    const partyTotals = Object.entries(partyTotalsMap)
      .map(([party, votes]) => ({ party, votes }))
      .sort((a, b) => b.votes - a.votes);

    // -----------------------------------------------------------------------
    // 7. Coverage
    // -----------------------------------------------------------------------
    const totalPollingUnits = await db.pollingUnit.count({
      where: electionId ? { electionId } : {},
    });
    const pvtCoveredUnits = await db.pvtSubmission.groupBy({
      by: ['pollingUnitId'],
      where: pvtWhere,
    }).then(rows => rows.length);
    const coveragePct = totalPollingUnits > 0
      ? Math.round((pvtCoveredUnits / totalPollingUnits) * 10000) / 100
      : 0;

    // -----------------------------------------------------------------------
    // Return
    // -----------------------------------------------------------------------
    return NextResponse.json({
      pvtSubmissions: pvtSubmissionsParsed,
      comparisons: comparisonsParsed,
      stats: {
        totalSubmissions,
        verifiedCount,
        unitsWithComparison,
        anomalyCount,
        bySource,
        byState,
      },
      sankeyData,
      partyTotals,
      coverage: {
        totalPollingUnits,
        pvtCoveredUnits,
        coveragePct,
      },
    });
  } catch (err) {
    console.error('[GET /api/pvt]', err);
    return NextResponse.json({ error: 'Failed to fetch PVT dashboard data' }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/pvt?tenantId=X — submit, verify, or run comparison
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
    // CSRF protection
    const csrfErr = requireCsrf(req);
    if (csrfErr) return csrfErr;

  try {
    const { id: tenantId, error } = await resolveTenant(req);
    if (error) return error;

    const authUser = await getAuthUser(req);
    if (!authUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const tenantErr = requireTenantMatch(authUser, tenantId);
    if (tenantErr) return tenantErr;

    const body = await req.json();
    const { action } = body;

    if (!action) {
      return NextResponse.json({ error: 'action is required (SUBMIT_PVT, VERIFY_PVT, RUN_COMPARISON)' }, { status: 400 });
    }

    // =========================================================================
    // SUBMIT_PVT
    // =========================================================================
    if (action === 'SUBMIT_PVT') {
      const {
        electionId, pollingUnitId, submittedById,
        partyResults, accreditedVoters, totalValidVotes,
        rejectedBallots, totalVotesCast,
        bvasSerialNumber, source,
      } = body;

      if (!electionId || !pollingUnitId || !submittedById) {
        return NextResponse.json({ error: 'electionId, pollingUnitId, and submittedById are required' }, { status: 400 });
      }
      if (!Array.isArray(partyResults) || partyResults.length === 0) {
        return NextResponse.json({ error: 'partyResults must be a non-empty array' }, { status: 400 });
      }
      if (totalVotesCast === undefined || totalVotesCast === null) {
        return NextResponse.json({ error: 'totalVotesCast is required' }, { status: 400 });
      }

      const verificationHash = crypto
        .createHash('sha256')
        .update(JSON.stringify(partyResults))
        .digest('hex');

      const submission = await db.pvtSubmission.create({
        data: {
          tenantId,
          electionId,
          pollingUnitId,
          submittedById,
          partyResults: JSON.stringify(partyResults),
          accreditedVoters: accreditedVoters || 0,
          totalValidVotes: totalValidVotes || 0,
          rejectedBallots: rejectedBallots || 0,
          totalVotesCast: totalVotesCast || 0,
          bvasSerialNumber: bvasSerialNumber || null,
          source: source || 'MOBILE',
          verificationHash,
        },
      });

      void logAudit({
        userId: authUser.userId,
        action: 'CREATE_PVT_SUBMISSION',
        entityType: 'PvtSubmission',
        entityId: submission.id,
        metadata: { electionId, pollingUnitId, source: source || 'MOBILE' },
        ipAddress: extractIp(req),
      });

      return NextResponse.json({
        success: true,
        message: 'PVT submission created',
        submission: {
          id: submission.id,
          verificationHash: submission.verificationHash,
          submittedAt: submission.submittedAt,
          source: submission.source,
        },
      }, { status: 201 });
    }

    // =========================================================================
    // VERIFY_PVT
    // =========================================================================
    if (action === 'VERIFY_PVT') {
      const WRITE_ROLES = ['SUPER_ADMIN', 'TENANT_ADMIN', 'ANALYST', 'TRUST_SAFETY'] as const;
      if (!WRITE_ROLES.includes(authUser.role as typeof WRITE_ROLES[number])) {
        return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
      }
      const { pvtId, verifiedById } = body;

      if (!pvtId || !verifiedById) {
        return NextResponse.json({ error: 'pvtId and verifiedById are required' }, { status: 400 });
      }

      const existing = await db.pvtSubmission.findUnique({ where: { id: pvtId } });
      if (!existing || existing.tenantId !== tenantId) {
        return NextResponse.json({ error: 'PVT submission not found' }, { status: 404 });
      }
      if (existing.isVerified) {
        return NextResponse.json({ error: 'PVT submission is already verified' }, { status: 409 });
      }

      const updated = await db.pvtSubmission.update({
        where: { id: pvtId },
        data: {
          isVerified: true,
          verifiedById,
          verifiedAt: new Date(),
        },
      });

      void logAudit({
        userId: authUser.userId,
        action: 'VERIFY_PVT_SUBMISSION',
        entityType: 'PvtSubmission',
        entityId: pvtId,
        metadata: { verifiedById },
        ipAddress: extractIp(req),
      });

      return NextResponse.json({
        success: true,
        message: 'PVT submission verified',
        verifiedAt: updated.verifiedAt,
      });
    }

    // =========================================================================
    // RUN_COMPARISON
    // =========================================================================
    if (action === 'RUN_COMPARISON') {
      const WRITE_ROLES = ['SUPER_ADMIN', 'TENANT_ADMIN', 'ANALYST'] as const;
      if (!WRITE_ROLES.includes(authUser.role as typeof WRITE_ROLES[number])) {
        return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
      }
      const { pollingUnitId, electionId } = body;

      if (!pollingUnitId || !electionId) {
        return NextResponse.json({ error: 'pollingUnitId and electionId are required' }, { status: 400 });
      }

      const pvt = await db.pvtSubmission.findFirst({
        where: { tenantId, pollingUnitId, electionId },
        orderBy: { submittedAt: 'desc' },
      });
      if (!pvt) {
        return NextResponse.json({ error: 'No PVT submission found for this polling unit' }, { status: 404 });
      }

      const official = await db.electionResult.findFirst({
        where: { tenantId, pollingUnitId },
      });
      if (!official) {
        return NextResponse.json({ error: 'No official result found for this polling unit' }, { status: 404 });
      }

      await db.resultComparison.deleteMany({
        where: { tenantId, pollingUnitId, electionId },
      });

      const pvtParties: { party: string; votes: number }[] = safeParse(pvt.partyResults);
      const offParties: { party: string; votes: number }[] = safeParse(official.partyResults);

      const offMap = new Map<string, number>();
      for (const op of offParties) {
        offMap.set(op.party, op.votes);
      }

      const partyDeltas: { party: string; pvtVotes: number; officialVotes: number; delta: number; deltaPct: number }[] = [];
      for (const pp of pvtParties) {
        const offVotes = offMap.get(pp.party) ?? 0;
        const delta = pp.votes - offVotes;
        const deltaPct = offVotes > 0 ? Math.round((Math.abs(delta) / offVotes) * 10000) / 100 : 0;
        partyDeltas.push({ party: pp.party, pvtVotes: pp.votes, officialVotes: offVotes, delta, deltaPct });
      }

      for (const op of offParties) {
        if (!pvtParties.find(pp => pp.party === op.party)) {
          partyDeltas.push({ party: op.party, pvtVotes: 0, officialVotes: op.votes, delta: -op.votes, deltaPct: op.votes > 0 ? 100 : 0 });
        }
      }

      const totalPvtVotes = pvt.totalVotesCast;
      const totalOfficialVotes = official.totalVotesCast;
      const totalDelta = totalPvtVotes - totalOfficialVotes;
      const deltaPct = totalOfficialVotes > 0 ? Math.round((Math.abs(totalDelta) / totalOfficialVotes) * 10000) / 100 : 0;
      const isAnomaly = deltaPct > 5;
      const anomalyReason = isAnomaly ? 'exceeds_5pct' : null;

      const comparison = await db.resultComparison.create({
        data: {
          tenantId,
          electionId,
          pollingUnitId,
          pvtSubmissionId: pvt.id,
          officialResultId: official.id,
          partyDeltas: JSON.stringify(partyDeltas),
          totalPvtVotes,
          totalOfficialVotes,
          totalDelta,
          deltaPct,
          isAnomaly,
          anomalyReason,
        },
      });

      void logAudit({
        userId: authUser.userId,
        action: 'RUN_PVT_COMPARISON',
        entityType: 'ResultComparison',
        entityId: comparison.id,
        metadata: { pollingUnitId, electionId, isAnomaly, deltaPct },
        ipAddress: extractIp(req),
      });

      return NextResponse.json({
        success: true,
        message: 'Comparison generated',
        comparison: {
          id: comparison.id,
          totalDelta: comparison.totalDelta,
          deltaPct: comparison.deltaPct,
          isAnomaly: comparison.isAnomaly,
          anomalyReason: comparison.anomalyReason,
          partyDeltas: safeParse(comparison.partyDeltas),
        },
      });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err) {
    console.error('[POST /api/pvt]', err);
    return NextResponse.json({ error: 'Failed to process PVT request' }, { status: 500 });
  }
}