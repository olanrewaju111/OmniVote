import { NextResponse } from 'next/server';
import { resolveTenant } from '@/lib/tenant';
import { getAuthUser } from '@/lib/auth';
import { requireTenantMatch } from '@/lib/rbac';

// ─── Sample Win Probability Data (Nigerian Presidential Election) ───────

const PARTY_PROBABILITIES = [
  {
    party: 'APC',
    probability: 47.3,
    trend: 'up' as const,
  },
  {
    party: 'PDP',
    probability: 28.6,
    trend: 'down' as const,
  },
  {
    party: 'LP',
    probability: 18.4,
    trend: 'stable' as const,
  },
  {
    party: 'NNPP',
    probability: 4.2,
    trend: 'down' as const,
  },
  {
    party: 'Others',
    probability: 1.5,
    trend: 'stable' as const,
  },
];

const KEY_FACTORS = [
  {
    factor: 'North-West Turnout Surge',
    impact: 'positive' as const,
    description: 'Kano, Kaduna, and Katsina are reporting turnout 12% above our baseline projections. This heavily favours APC given their historical strength in the region. Over 4.2 million additional voters may have participated compared to initial estimates.',
  },
  {
    factor: 'South-East Voter Mobilization',
    impact: 'negative' as const,
    description: 'Unprecedented turnout in Anambra, Enugu, and Abia is driving LP numbers higher than pre-election models predicted. Early PVT data suggests LP may be capturing 65-70% of votes in the region, up from our 55% estimate.',
  },
  {
    factor: 'South-South Consolidation for PDP',
    impact: 'neutral' as const,
    description: 'Rivers, Delta, and Akwa Ibom are tracking as expected for PDP. No significant deviation from baseline. However, LP is showing stronger-than-expected performance in Edo and Cross River, offsetting PDP gains.',
  },
  {
    factor: 'Lagos Swing Dynamics',
    impact: 'positive' as const,
    description: 'Lagos turnout at 52% is above the 44% projected. APC appears to be consolidating its base in mainland LGAs while LP maintains strength on the island and in Alimosho. Net effect slightly favours APC by ~2% in overall probability.',
  },
  {
    factor: 'BVAS Technology Reliability',
    impact: 'positive' as const,
    description: 'BVAS failure rate at 0.027% is within acceptable bounds. This reduces the likelihood of post-election legal challenges based on technology failures, which benefits the leading party (APC) by removing a potential avenue for results disruption.',
  },
  {
    factor: 'Low Incidence of Electoral Violence',
    impact: 'neutral' as const,
    description: 'With only 12 out of 8,809 wards reporting violence, the election is one of the most peaceful in Nigerian history. While this is positive for overall credibility, it does not significantly shift party probabilities as violence was not a major differentiating factor in our model.',
  },
  {
    factor: 'IReV Upload Performance',
    impact: 'positive' as const,
    description: '78% upload completion rate for closed polling units, with 2.8s average latency. This supports transparency and reduces the window for result manipulation claims. Historical data shows high IReV performance correlates with reduced post-election litigation success.',
  },
  {
    factor: 'Youth Voter Surge',
    impact: 'negative' as const,
    description: 'The 18-35 demographic constituting 52% of early voters is slightly above our 47% projection. This cohort shows stronger preference for LP and PDP, putting mild downward pressure on APC probability. However, the effect is partially offset by high youth turnout in APC strongholds like Kano.',
  },
];

// ─── GET ─────────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  try {
    const { id: tenantId, error } = await resolveTenant(req);
    if (error) return error;

    const authUser = await getAuthUser(req);
    if (!authUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const tenantErr = requireTenantMatch(authUser, tenantId);
    if (tenantErr) return tenantErr;

    // Win probability is computed as the leading party's probability
    const projectedWinner = PARTY_PROBABILITIES.reduce((a, b) => (a.probability > b.probability ? a : b));

    // Confidence reflects model certainty — higher when more data is available
    // Simulated as inversely related to how many PUs are still open
    const confidence = 62.4;

    return NextResponse.json({
      winProbability: projectedWinner.probability,
      confidence,
      projectedWinner: projectedWinner.party,
      partyProbabilities: PARTY_PROBABILITIES,
      keyFactors: KEY_FACTORS,
      lastUpdated: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch win probability data' }, { status: 500 });
  }
}
