// Phase 5: Real data computation from election results
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { resolveTenant } from '@/lib/tenant';
import { getAuthUser } from '@/lib/auth';
import { requireTenantMatch } from '@/lib/rbac';

const PARTY_COLORS: Record<string, string> = {
  APC: '#00A651', PDP: '#E21A2B', LP: '#008751', NNPP: '#FF6B00', SDP: '#6B7280',
};

function getColor(party: string) { return PARTY_COLORS[party] || '#94A3B8'; }

export async function GET(req: Request) {
  try {
    const { id: tenantId, error } = await resolveTenant(req);
    if (error) return error;
    const authUser = await getAuthUser(req);
    if (!authUser) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    const tenantErr = requireTenantMatch(authUser, tenantId);
    if (tenantErr) return tenantErr;

    const results = await db.electionResult.findMany({
      where: { tenantId },
      select: { partyResults: true, submittedAt: true },
      orderBy: { submittedAt: 'asc' },
    });

    const totalPUs = await db.pollingUnit.count({ where: { election: { tenantId } } });

    if (results.length === 0) {
      return NextResponse.json({
        winProbability: 0, confidence: 0, projectedWinner: null,
        partyProbabilities: [], keyFactors: [{
          factor: 'Awaiting Results', impact: 'neutral' as const,
          description: `No election results have been submitted yet across ${totalPUs} polling units. Win probability will be computed as results come in.`,
        }], lastUpdated: new Date().toISOString(),
      });
    }

    // ── Aggregate votes per party ──
    const partyVotes = new Map<string, number>();
    const partyEarlyShares = new Map<string, number[]>();
    const partyLateShares = new Map<string, number[]>();
    let totalAllVotes = 0;

    const splitIdx = Math.floor(results.length * 0.2);

    for (let i = 0; i < results.length; i++) {
      let parsed: Array<{ party: string; votes: number }> = [];
      try { parsed = JSON.parse(results[i].partyResults); } catch { continue; }
      const rowTotal = parsed.reduce((s, p) => s + p.votes, 0);
      if (rowTotal === 0) continue;
      totalAllVotes += rowTotal;
      for (const p of parsed) {
        partyVotes.set(p.party, (partyVotes.get(p.party) || 0) + p.votes);
        const share = (p.votes / rowTotal) * 100;
        if (i < splitIdx) {
          partyEarlyShares.set(p.party, [...(partyEarlyShares.get(p.party) || []), share]);
        } else if (i >= results.length - splitIdx) {
          partyLateShares.set(p.party, [...(partyLateShares.get(p.party) || []), share]);
        }
      }
    }

    // ── Compute probabilities ──
    const sorted = [...partyVotes.entries()].sort((a, b) => b[1] - a[1]);
    const partyProbabilities = sorted.map(([party, votes]) => {
      const probability = totalAllVotes > 0 ? Math.round((votes / totalAllVotes) * 1000) / 10 : 0;
      const early = partyEarlyShares.get(party) || [];
      const late = partyLateShares.get(party) || [];
      const avgEarly = early.length > 0 ? early.reduce((a, b) => a + b, 0) / early.length : 0;
      const avgLate = late.length > 0 ? late.reduce((a, b) => a + b, 0) / late.length : 0;
      let trend: 'up' | 'down' | 'stable' = 'stable';
      if (avgLate > avgEarly + 2) trend = 'up';
      else if (avgLate < avgEarly - 2) trend = 'down';
      return { party, probability, trend, color: getColor(party) };
    });

    // ── Confidence ──
    const coverage = totalPUs > 0 ? results.length / totalPUs : 0;
    const confidence = Math.min(95, Math.round(coverage * 100));

    const projectedWinner = sorted.length > 0 ? sorted[0][0] : null;
    const winProbability = partyProbabilities.length > 0 ? partyProbabilities[0].probability : 0;

    // ── Dynamic key factors ──
    const keyFactors: Array<{ factor: string; impact: 'positive' | 'negative' | 'neutral'; description: string }> = [];

    keyFactors.push({
      factor: 'Results Coverage',
      impact: coverage > 0.5 ? 'positive' : 'neutral',
      description: `${results.length} of ${totalPUs} polling units (${Math.round(coverage * 100)}%) have submitted results. ${coverage > 0.75 ? 'Strong coverage provides high confidence in projections.' : 'More results needed for reliable projections.'}`,
    });

    if (sorted.length >= 2) {
      const margin = partyProbabilities[0].probability - partyProbabilities[1].probability;
      keyFactors.push({
        factor: 'Leading Party Margin',
        impact: margin > 10 ? 'positive' : margin > 5 ? 'neutral' : 'neutral',
        description: `${sorted[0][0]} leads ${sorted[1][0]} by ${margin.toFixed(1)} percentage points. ${margin > 15 ? 'This represents a comfortable lead that would be difficult to overcome.' : margin > 5 ? 'A moderate lead — the race could still shift with remaining results.' : 'A tight race — remaining results could change the projected winner.'}`,
      });
    }

    const closedPUs = await db.pollingUnit.findMany({
      where: { election: { tenantId }, status: 'CLOSED' }, select: { turnout: true }, take: 500,
    });
    if (closedPUs.length > 0) {
      const avgTurnout = closedPUs.reduce((s, pu) => s + pu.turnout, 0) / closedPUs.length;
      keyFactors.push({
        factor: 'Voter Turnout Analysis',
        impact: avgTurnout > 0.5 ? 'positive' : 'neutral',
        description: `Average turnout across ${closedPUs.length} closed polling units is ${(avgTurnout * 100).toFixed(1)}%. ${avgTurnout > 0.6 ? 'Strong participation indicates robust democratic engagement.' : 'Moderate turnout within expected range for this election tier.'}`,
      });
    }

    const violentIncidents = await db.incident.count({
      where: { tenantId, severity: { in: ['CRITICAL', 'HIGH'] }, type: { in: ['VIOLENCE', 'SNATCHED_BALLOT', 'INTIMIDATION'] } },
    });
    keyFactors.push({
      factor: 'Security Incident Impact',
      impact: violentIncidents > 10 ? 'negative' : violentIncidents > 3 ? 'neutral' : 'positive',
      description: `${violentIncidents} high-severity security incidents (violence, ballot snatching, intimidation) reported. ${violentIncidents <= 5 ? 'Election remains largely peaceful — security situation is within acceptable thresholds.' : 'Elevated security concerns may affect turnout in affected areas and could influence legal challenges.'}`,
    });

    const statesInResults = await db.electionResult.findMany({
      where: { tenantId },
      select: { pollingUnit: { select: { state: true } } },
      distinct: ['pollingUnitId'], take: 1000,
    });
    const distinctStates = new Set(statesInResults.map(r => (r as unknown as { pollingUnit: { state: string } }).pollingUnit.state));
    keyFactors.push({
      factor: 'Geographic Spread',
      impact: distinctStates.size > 10 ? 'positive' : 'neutral',
      description: `Results received from ${distinctStates.size} distinct states/regions. ${distinctStates.size > 10 ? 'Broad geographic coverage strengthens the reliability of projections.' : 'Limited geographic spread — projections may not yet represent national sentiment.'}`,
    });

    const quarantinedIncidents = await db.incident.count({ where: { tenantId, isQuarantined: true } });
    if (quarantinedIncidents > 0) {
      keyFactors.push({
        factor: 'Quarantined Reports',
        impact: 'neutral',
        description: `${quarantinedIncidents} reports quarantined for AI-flagged integrity concerns (deepfake, CIB, geo-anomaly). These are excluded from operational counts pending review.`,
      });
    }

    return NextResponse.json({
      winProbability, confidence, projectedWinner, partyProbabilities, keyFactors, lastUpdated: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch win probability data' }, { status: 500 });
  }
}
