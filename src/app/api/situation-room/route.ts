import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Nigeria's 6 geo-political zones
const GEO_ZONES: Record<string, string[]> = {
  'North-West': ['Kano', 'Kaduna', 'Katsina', 'Sokoto', 'Jigawa', 'Kebbi', 'Zamfara'],
  'North-East': ['Borno', 'Yobe', 'Adamawa', 'Bauchi', 'Gombe', 'Taraba'],
  'North-Central': ['Plateau', 'Kwara', 'Niger', 'Benue', 'Nasarawa', 'Kogi', 'Abuja FCT'],
  'South-West': ['Lagos', 'Ogun', 'Oyo', 'Osun', 'Ondo', 'Ekiti'],
  'South-East': ['Enugu', 'Anambra', 'Imo', 'Abia', 'Ebonyi'],
  'South-South': ['Rivers', 'Delta', 'Akwa Ibom', 'Edo', 'Bayelsa', 'Cross River'],
};

// Reverse lookup: state → zone
const STATE_TO_ZONE: Record<string, string> = {};
for (const [zone, states] of Object.entries(GEO_ZONES)) {
  for (const s of states) STATE_TO_ZONE[s] = zone;
}

// Levels per election tier
const TIER_LEVELS: Record<string, string[]> = {
  PRESIDENTIAL: ['national', 'region', 'state', 'lga', 'ward'],
  STATE: ['state', 'lga', 'ward'],
  LOCAL: ['lga', 'ward'],
};

type AggItem = {
  id: string; name: string; registeredVoters: number; totalVotes: number;
  turnout: number; units: number; openUnits: number; closedUnits: number;
  flaggedUnits: number; incidents: number; criticalIncidents: number;
};

type DrillDown = {
  level: string;
  parentName: string;
  parentLevel: string;
  items: AggItem[];
  tiers: string[]; // available levels for this election type
};

export async function GET(req: NextRequest) {
  try {
    const tenant = await db.tenant.findFirst({ where: { slug: 'new' } });
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    // Get active election
    const election = await db.election.findFirst({
      where: { tenantId: tenant.id, status: { in: ['ACTIVE', 'UPCOMING'] } },
      select: { id: true, tier: true, title: true },
    });
    const tier = election?.tier || 'PRESIDENTIAL';
    const levels = TIER_LEVELS[tier] || TIER_LEVELS.PRESIDENTIAL;

    const { searchParams } = new URL(req.url);
    const level = searchParams.get('level') || levels[0]; // default to top level
    const filter = searchParams.get('filter') || ''; // state/lga/zone name for drill-down

    // Fetch all polling units + incident counts for this election
    const pollingUnits = await db.pollingUnit.findMany({
      where: election ? { electionId: election.id } : {},
    });

    // Fetch incident counts grouped by pollingUnitId
    const incidents = await db.incident.findMany({
      where: { tenantId: tenant.id },
      select: { pollingUnitId: true, severity: true },
    });

    // Build incident lookup
    const incidentMap = new Map<string, { total: number; critical: number }>();
    for (const inc of incidents) {
      if (!inc.pollingUnitId) continue;
      const existing = incidentMap.get(inc.pollingUnitId) || { total: 0, critical: 0 };
      existing.total++;
      if (inc.severity === 'CRITICAL') existing.critical++;
      incidentMap.set(inc.pollingUnitId, existing);
    }

    // Aggregate function
    function aggregate(units: typeof pollingUnits): AggItem {
      const registeredVoters = units.reduce((s, u) => s + u.registeredVoters, 0);
      const totalVotes = units.reduce((s, u) => s + u.totalVotes, 0);
      const turnout = registeredVoters > 0 ? Math.round((totalVotes / registeredVoters) * 10000) / 100 : 0;
      const openUnits = units.filter(u => u.status === 'OPEN').length;
      const closedUnits = units.filter(u => u.status === 'CLOSED').length;
      const flaggedUnits = units.filter(u => u.status === 'FLAGGED').length;
      let incTotal = 0, incCritical = 0;
      for (const u of units) {
        const inc = incidentMap.get(u.id);
        if (inc) { incTotal += inc.total; incCritical += inc.critical; }
      }
      return {
        id: '', name: '', registeredVoters, totalVotes, turnout,
        units: units.length, openUnits, closedUnits, flaggedUnits,
        incidents: incTotal, criticalIncidents: incCritical,
      };
    }

    let result: DrillDown;

    if (level === 'national' && tier === 'PRESIDENTIAL') {
      // National level — show 6 geo-political zones
      const items: AggItem[] = Object.entries(GEO_ZONES).map(([zone, states]) => {
        const zoneUnits = pollingUnits.filter(u => states.includes(u.state));
        const agg = aggregate(zoneUnits);
        return { ...agg, id: zone, name: zone };
      }).sort((a, b) => b.totalVotes - a.totalVotes);

      const nationalAgg = aggregate(pollingUnits);
      result = {
        level: 'national', parentName: 'Nigeria', parentLevel: 'national',
        items, tiers: levels,
      };

    } else if (level === 'region') {
      // Region level — show states within a geo-political zone
      const zone = filter;
      const zoneStates = GEO_ZONES[zone] || [];
      const items: AggItem[] = [];
      const seenStates = new Set<string>();

      for (const pu of pollingUnits) {
        if (zoneStates.includes(pu.state) && !seenStates.has(pu.state)) {
          seenStates.add(pu.state);
          const stateUnits = pollingUnits.filter(u => u.state === pu.state);
          const agg = aggregate(stateUnits);
          items.push({ ...agg, id: pu.state, name: pu.state });
        }
      }
      items.sort((a, b) => b.totalVotes - a.totalVotes);

      result = { level: 'region', parentName: zone, parentLevel: 'region', items, tiers: levels };

    } else if (level === 'state') {
      // State level — show LGAs within a state
      const stateName = filter;
      const items: AggItem[] = [];
      const seenLgas = new Set<string>();

      for (const pu of pollingUnits) {
        if (pu.state === stateName && !seenLgas.has(pu.lga)) {
          seenLgas.add(pu.lga);
          const lgaUnits = pollingUnits.filter(u => u.lga === pu.lga && u.state === stateName);
          const agg = aggregate(lgaUnits);
          items.push({ ...agg, id: `${stateName}/${pu.lga}`, name: pu.lga });
        }
      }
      items.sort((a, b) => b.totalVotes - a.totalVotes);

      // Find the zone for this state
      const zone = STATE_TO_ZONE[stateName] || 'Unknown Zone';

      result = { level: 'state', parentName: stateName, parentLevel: 'state', items, tiers: levels };

    } else if (level === 'lga') {
      // LGA level — show wards within an LGA
      const lgaName = filter;
      const items: AggItem[] = [];
      const seenWards = new Set<string>();

      for (const pu of pollingUnits) {
        if (pu.lga === lgaName && !seenWards.has(pu.ward)) {
          seenWards.add(pu.ward);
          const wardUnits = pollingUnits.filter(u => u.ward === pu.ward && u.lga === lgaName);
          const agg = aggregate(wardUnits);
          items.push({ ...agg, id: `${lgaName}/${pu.ward}`, name: pu.ward });
        }
      }
      items.sort((a, b) => b.totalVotes - a.totalVotes);

      result = { level: 'lga', parentName: lgaName, parentLevel: 'lga', items, tiers: levels };

    } else if (level === 'ward') {
      // Ward level — show individual polling units
      const wardFilter = filter;
      const [lgaName, wardName] = wardFilter.includes('/') ? wardFilter.split('/', 2) : ['', wardFilter];

      let wardUnits = pollingUnits;
      if (lgaName && wardName) {
        wardUnits = pollingUnits.filter(u => u.lga === lgaName && u.ward === wardName);
      } else if (wardName) {
        wardUnits = pollingUnits.filter(u => u.ward === wardName);
      }

      const items: AggItem[] = wardUnits.map(pu => {
        const agg = aggregate([pu]);
        return { ...agg, id: pu.id, name: pu.name || pu.code };
      });

      result = { level: 'ward', parentName: wardName || lgaName, parentLevel: 'ward', items, tiers: levels };

    } else {
      return NextResponse.json({ error: `Unknown level: ${level}` }, { status: 400 });
    }

    // Add summary totals for the parent
    const allItems = result.items;
    const summary = {
      registeredVoters: allItems.reduce((s, i) => s + i.registeredVoters, 0),
      totalVotes: allItems.reduce((s, i) => s + i.totalVotes, 0),
      turnout: 0,
      units: allItems.reduce((s, i) => s + i.units, 0),
      openUnits: allItems.reduce((s, i) => s + i.openUnits, 0),
      closedUnits: allItems.reduce((s, i) => s + i.closedUnits, 0),
      flaggedUnits: allItems.reduce((s, i) => s + i.flaggedUnits, 0),
      incidents: allItems.reduce((s, i) => s + i.incidents, 0),
      criticalIncidents: allItems.reduce((s, i) => s + i.criticalIncidents, 0),
      childCount: allItems.length,
    };
    summary.turnout = summary.registeredVoters > 0
      ? Math.round((summary.totalVotes / summary.registeredVoters) * 10000) / 100 : 0;

    return NextResponse.json({
      tier,
      levels,
      currentLevel: level,
      filter,
      summary,
      items: result.items,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch situation room data' }, { status: 500 });
  }
}