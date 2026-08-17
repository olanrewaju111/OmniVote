import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const tenantId = req.nextUrl.searchParams.get('tenantId') || session.tenantId;

    // Get all results with polling unit info
    const results = await db.electionResult.findMany({
      where: { tenantId },
      include: {
        pollingUnit: { select: { state: true, lga: true, registeredVoters: true } },
      },
    });

    if (results.length === 0) {
      return NextResponse.json({
        states: [],
        national: [],
        victoryPath: { totalStates: 37, statesWon: 0, statesLeaning: 0, statesContested: 0, statesLost: 0, pathTo25: 0, remainingNeeded: 25, winProbability: 0, keySwingStates: [] },
        coalitionScenarios: [],
      });
    }

    // Aggregate by state
    const stateMap = new Map<string, {
      partyVotes: Record<string, number>;
      totalValidVotes: number;
      totalRegistered: number;
      units: number;
    }>();

    const allPartyVotes: Record<string, number> = {};

    for (const r of results) {
      const state = r.pollingUnit?.state || 'Unknown';
      if (!stateMap.has(state)) {
        stateMap.set(state, { partyVotes: {}, totalValidVotes: 0, totalRegistered: 0, units: 0 });
      }
      const agg = stateMap.get(state)!;
      agg.totalValidVotes += r.totalValidVotes;
      agg.totalRegistered += r.pollingUnit?.registeredVoters || 0;
      agg.units += 1;

      let partyResults: Array<{ party: string; votes: number }> = [];
      try { partyResults = JSON.parse(r.partyResults); } catch {}

      for (const pr of partyResults) {
        const party = (pr.party || '').toUpperCase();
        const votes = pr.votes || 0;
        agg.partyVotes[party] = (agg.partyVotes[party] || 0) + votes;
        allPartyVotes[party] = (allPartyVotes[party] || 0) + votes;
      }
    }

    // Build state results
    const states = Array.from(stateMap.entries()).map(([state, agg]) => {
      const sorted = Object.entries(agg.partyVotes).sort((a, b) => b[1] - a[1]);
      const leading = sorted[0] || ['UNKNOWN', 0];
      const trailing = sorted[1] || ['UNKNOWN', 0];
      const partyResults = sorted.map(([party, votes]) => ({ party, votes }));
      const turnout = agg.totalRegistered > 0 ? Math.round((agg.totalValidVotes / agg.totalRegistered) * 100) : 0;

      return {
        state,
        partyResults,
        totalValidVotes: agg.totalValidVotes,
        totalRegistered: agg.totalRegistered,
        turnout,
        leadingParty: leading[0],
        margin: leading[1] - trailing[1],
        status: agg.totalValidVotes > 0 ? 'REPORTED' : 'PENDING',
      };
    });

    // National aggregate
    const totalAllVotes = Object.values(allPartyVotes).reduce((s, v) => s + v, 0);
    const national = Object.entries(allPartyVotes)
      .sort((a, b) => b[1] - a[1])
      .map(([party, votes]) => {
        const partyStates = states.filter(s => s.leadingParty === party).length;
        return {
          party,
          votes,
          percentage: totalAllVotes > 0 ? (votes / totalAllVotes) * 100 : 0,
          states: partyStates,
          trend: 'stable' as const,
        };
      });

    // Victory path
    const topParty = national[0]?.party || 'APC';
    const statesWon = states.filter(s => {
      const marginPct = s.totalValidVotes > 0 ? (s.margin / s.totalValidVotes) * 100 : 0;
      return s.leadingParty === topParty && marginPct >= 8;
    }).length;
    const statesLeaning = states.filter(s => {
      const marginPct = s.totalValidVotes > 0 ? (s.margin / s.totalValidVotes) * 100 : 0;
      return s.leadingParty === topParty && marginPct >= 3 && marginPct < 8;
    }).length;
    const statesContested = states.filter(s => {
      const marginPct = s.totalValidVotes > 0 ? (s.margin / s.totalValidVotes) * 100 : 0;
      return s.leadingParty === topParty && marginPct < 3;
    }).length;
    const statesLost = states.filter(s => s.leadingParty !== topParty).length;
    const pathTo25 = statesWon + statesLeaning;
    const remainingNeeded = Math.max(0, 25 - pathTo25);

    // Win probability heuristic
    const securedPct = (statesWon + statesLeaning * 0.6 + statesContested * 0.3) / 25;
    const votePct = (national[0]?.percentage || 0) / 100;
    const winProbability = Math.min(99, Math.round((securedPct * 0.6 + votePct * 0.4) * 100));

    // Coalition scenarios
    const coalitionScenarios = generateCoalitionScenarios(national, states, totalAllVotes);

    const victoryPath = {
      totalStates: states.length || 37,
      statesWon,
      statesLeaning,
      statesContested,
      statesLost,
      pathTo25,
      remainingNeeded,
      winProbability,
      keySwingStates: [],
    };

    return NextResponse.json({ states, national, victoryPath, coalitionScenarios });
  } catch (error) {
    console.error('[victory-roadmap] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

const PARTY_COLORS: Record<string, string> = {
  APC: '#008751', PDP: '#CE1126', LP: '#2196F3', NNPP: '#FF9800',
};

function generateCoalitionScenarios(
  national: Array<{ party: string; votes: number; percentage: number; states: number }>,
  states: Array<{ leadingParty: string; totalValidVotes: number }>,
  totalVotes: number
) {
  const parties = national.map(n => n.party);
  const scenarios: Array<{
    id: string; name: string; description: string; parties: string[];
    projectedStates: number; projectedVotes: number; projectedPercentage: number; confidence: number;
  }> = [];

  // Solo scenarios
  for (const p of parties.slice(0, 3)) {
    const pStates = states.filter(s => s.leadingParty === p).length;
    const pVotes = national.find(n => n.party === p)?.votes || 0;
    scenarios.push({
      id: `solo-${p}`,
      name: `${p} Solo`,
      description: `${p} winning without coalition support.`,
      parties: [p],
      projectedStates: pStates,
      projectedVotes: pVotes,
      projectedPercentage: totalVotes > 0 ? (pVotes / totalVotes) * 100 : 0,
      confidence: Math.min(95, Math.round(pStates / 25 * 100)),
    });
  }

  // Two-party coalitions
  for (let i = 0; i < Math.min(parties.length - 1, 3); i++) {
    for (let j = i + 1; j < Math.min(parties.length, 4); j++) {
      const combo = [parties[i], parties[j]];
      const cStates = states.filter(s => combo.includes(s.leadingParty)).length;
      const cVotes = combo.reduce((sum, p) => sum + (national.find(n => n.party === p)?.votes || 0), 0);
      scenarios.push({
        id: `coal-${combo.join('-')}`,
        name: `${combo.join(' + ')} Coalition`,
        description: `Combined strength of ${combo.join(' and ')}.`,
        parties: combo,
        projectedStates: cStates,
        projectedVotes: cVotes,
        projectedPercentage: totalVotes > 0 ? (cVotes / totalVotes) * 100 : 0,
        confidence: Math.min(95, Math.round(cStates / 25 * 100)),
      });
    }
  }

  // Opposition coalition
  if (parties.length >= 3) {
    const opp = parties.slice(1, 3);
    const oStates = states.filter(s => opp.includes(s.leadingParty)).length;
    const oVotes = opp.reduce((sum, p) => sum + (national.find(n => n.party === p)?.votes || 0), 0);
    scenarios.push({
      id: 'opposition-coalition',
      name: 'Opposition Coalition',
      description: `${opp.join(' + ')} joining forces against the leading party.`,
      parties: opp,
      projectedStates: oStates,
      projectedVotes: oVotes,
      projectedPercentage: totalVotes > 0 ? (oVotes / totalVotes) * 100 : 0,
      confidence: Math.min(95, Math.round(oStates / 25 * 100)),
    });
  }

  return scenarios;
}