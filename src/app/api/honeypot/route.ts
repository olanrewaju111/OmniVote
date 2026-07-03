import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { resolveTenant } from '@/lib/tenant';
import { safeParse } from '@/lib/safe-parse';
import { getAuthUser } from '@/lib/auth';
import { requireTenantMatch } from '@/lib/rbac';

export async function GET(req: NextRequest) {
  try {
    const { id: tenantId, error } = await resolveTenant(req);
    if (error) return error;

    const authUser = await getAuthUser(req);
    if (authUser) {
      const tenantErr = requireTenantMatch(authUser, tenantId);
      if (tenantErr) return tenantErr;
    }

    const [honeypots, accessibilityReports, trapTypeGroups, deviationCount, alertCount, deviationStats, accessibilityStats, pwdStats] = await Promise.all([
      db.honeypotUnit.findMany({
        where: { tenantId },
        include: {
          pollingUnit: { select: { name: true, code: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      db.accessibilityReport.findMany({
        where: { tenantId },
        include: {
          pollingUnit: { select: { name: true, code: true, state: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      db.honeypotUnit.groupBy({
        by: ['trapType'],
        where: { tenantId },
        _count: { trapType: true },
      }),
      db.honeypotUnit.count({
        where: { tenantId, deviationDetected: true },
      }),
      db.honeypotUnit.count({
        where: { tenantId, alertTriggered: true },
      }),
      db.honeypotUnit.aggregate({
        where: { tenantId, deviationDetected: true },
        _avg: { deviationPct: true },
      }),
      db.accessibilityReport.aggregate({
        where: { tenantId },
        _avg: { overallScore: true },
      }),
      db.accessibilityReport.aggregate({
        where: { tenantId },
        _sum: { pwdVotersServed: true, pwdVotersTurnedAway: true },
      }),
    ]);

    // Collect all unique reporter IDs from accessibility reports
    const reporterIds = [...new Set(accessibilityReports.map(r => r.reportedById))];
    const reporters = reporterIds.length > 0
      ? await db.user.findMany({
          where: { id: { in: reporterIds } },
          select: { id: true, name: true },
        })
      : [];
    const reporterMap = Object.fromEntries(reporters.map(r => [r.id, r.name]));

    // Honeypots with parsed JSON fields
    const honeypotList = honeypots.map(h => ({
      id: h.id,
      tenantId: h.tenantId,
      pollingUnitId: h.pollingUnitId,
      name: h.name,
      state: h.state,
      lga: h.lga,
      isDecoy: h.isDecoy,
      trapType: h.trapType,
      expectedResults: safeParse(h.expectedResults, []),
      officialResults: safeParse(h.officialResults, []),
      deviationDetected: h.deviationDetected,
      deviationPct: h.deviationPct,
      alertTriggered: h.alertTriggered,
      alertId: h.alertId,
      notes: h.notes,
      isActive: h.isActive,
      createdAt: h.createdAt,
      updatedAt: h.updatedAt,
      pollingUnit: h.pollingUnit,
    }));

    // Accessibility reports with parsed JSON fields and reporter name
    const accessibilityList = accessibilityReports.map(r => ({
      id: r.id,
      tenantId: r.tenantId,
      pollingUnitId: r.pollingUnitId,
      reportedById: r.reportedById,
      features: safeParse(r.features, {}),
      barrierTypes: safeParse(r.barrierTypes, []),
      pwdVotersServed: r.pwdVotersServed,
      pwdVotersTurnedAway: r.pwdVotersTurnedAway,
      overallScore: r.overallScore,
      photoUrl: r.photoUrl,
      notes: r.notes,
      verified: r.verified,
      createdAt: r.createdAt,
      pollingUnit: r.pollingUnit,
      reporterName: reporterMap[r.reportedById] || null,
    }));

    // Stats
    const totalHoneypots = honeypots.length;
    const activeHoneypots = honeypots.filter(h => h.isActive).length;
    const byTrapType = Object.fromEntries(
      trapTypeGroups.map(g => [g.trapType, g._count.trapType])
    ) as Record<string, number>;

    // Biometric summary: FIELD_AGENT users for this tenant
    const fieldAgents = await db.user.findMany({
      where: { tenantId, role: 'FIELD_AGENT' },
      select: {
        id: true,
        name: true,
        biometricRiskScore: true,
        deviceTrustScore: true,
        isLocked: true,
        biometricProfile: true,
      },
    });

    const profiledAgents = fieldAgents.filter(a => a.biometricProfile !== null);
    const totalProfiled = profiledAgents.length;
    const avgRiskScore = totalProfiled > 0
      ? profiledAgents.reduce((sum, a) => sum + a.biometricRiskScore, 0) / totalProfiled
      : 0;
    const highRiskAgents = fieldAgents.filter(a => a.biometricRiskScore > 0.7);

    const biometricSummary = {
      totalProfiled,
      avgRiskScore: Math.round(avgRiskScore * 1000) / 1000,
      highRiskAgents: highRiskAgents.length,
      agents: fieldAgents.map(a => ({
        id: a.id,
        name: a.name,
        biometricRiskScore: a.biometricRiskScore,
        deviceTrustScore: a.deviceTrustScore,
        isLocked: a.isLocked,
        biometricProfile: safeParse(a.biometricProfile, null),
      })),
    };

    // Trap effectiveness
    const totalTraps = totalHoneypots;
    const trapsWithDeviations = deviationCount;
    const effectivenessPct = totalTraps > 0
      ? Math.round((trapsWithDeviations / totalTraps) * 10000) / 100
      : 0;

    return NextResponse.json({
      honeypots: honeypotList,
      accessibility: accessibilityList,
      stats: {
        totalHoneypots,
        activeHoneypots,
        byTrapType,
        deviationsDetected: deviationCount,
        alertsTriggered: alertCount,
        avgDeviationPct: deviationStats._avg.deviationPct
          ? Math.round(deviationStats._avg.deviationPct * 100) / 100
          : 0,
        totalAccessibilityReports: accessibilityReports.length,
        avgAccessibilityScore: accessibilityStats._avg.overallScore
          ? Math.round(accessibilityStats._avg.overallScore * 100) / 100
          : 0,
        pwdServed: pwdStats._sum.pwdVotersServed || 0,
        pwdTurnedAway: pwdStats._sum.pwdVotersTurnedAway || 0,
      },
      biometricSummary,
      trapEffectiveness: {
        totalTraps,
        trapsWithDeviations,
        effectivenessPct,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch honeypot data' }, { status: 500 });
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
      case 'CREATE_HONEYPOT': {
        const { pollingUnitId, name, state, lga, trapType, expectedResults, notes } = body;

        if (!pollingUnitId || !name || !state || !trapType) {
          return NextResponse.json(
            { error: 'pollingUnitId, name, state, and trapType are required' },
            { status: 400 },
          );
        }

        const validTrapTypes = ['GHOST_UNIT', 'TAMPER_TRAP', 'REPLAY_DETECTOR'];
        if (!validTrapTypes.includes(trapType)) {
          return NextResponse.json(
            { error: `trapType must be one of: ${validTrapTypes.join(', ')}` },
            { status: 400 },
          );
        }

        const honeypot = await db.honeypotUnit.create({
          data: {
            tenantId,
            pollingUnitId,
            name,
            state,
            lga: lga || null,
            trapType,
            expectedResults: JSON.stringify(expectedResults || []),
            notes: notes || '',
          },
        });

        return NextResponse.json({
          success: true,
          honeypot: {
            id: honeypot.id,
            name: honeypot.name,
            trapType: honeypot.trapType,
            isActive: honeypot.isActive,
            createdAt: honeypot.createdAt,
          },
        }, { status: 201 });
      }

      case 'UPDATE_OFFICIAL_RESULTS': {
        const { honeypotId, officialResults } = body;

        if (!honeypotId || !officialResults) {
          return NextResponse.json(
            { error: 'honeypotId and officialResults are required' },
            { status: 400 },
          );
        }

        const existing = await db.honeypotUnit.findFirst({
          where: { id: honeypotId, tenantId },
        });

        if (!existing) {
          return NextResponse.json({ error: 'Honeypot unit not found' }, { status: 404 });
        }

        const expected = safeParse(existing.expectedResults, []) as Array<{ party: string; votes: number }>;
        const official = officialResults as Array<{ party: string; votes: number }>;

        // Calculate deviation percentage
        let totalExpected = 0;
        let totalOfficial = 0;
        let maxPartyDeviation = 0;

        for (const exp of expected) {
          const partyExpected = exp.votes;
          const partyOfficial = official.find(o => o.party === exp.party)?.votes ?? 0;
          totalExpected += partyExpected;
          totalOfficial += partyOfficial;

          if (partyExpected > 0) {
            const partyDev = Math.abs(partyExpected - partyOfficial) / partyExpected * 100;
            if (partyDev > maxPartyDeviation) maxPartyDeviation = partyDev;
          }
        }

        // Overall deviation as percentage difference in total
        const deviationPct = totalExpected > 0
          ? Math.abs(totalExpected - totalOfficial) / totalExpected * 100
          : 0;

        const deviationDetected = deviationPct > 5;
        const alertTriggered = deviationDetected;

        // Optionally create an alert if triggered
        let alertId: string | null = null;
        if (alertTriggered) {
          try {
            const alert = await db.alert.create({
              data: {
                tenantId,
                type: 'SECURITY',
                category: 'WARNING',
                title: `Result deviation detected in honeypot: ${existing.name}`,
                description: `Deviation of ${Math.round(deviationPct * 100) / 100}% detected. Expected ${totalExpected} total votes, received ${totalOfficial}.`,
              },
            });
            alertId = alert.id;
          } catch {
            // Non-fatal: alert creation failure should not block the update
          }
        }

        const updated = await db.honeypotUnit.update({
          where: { id: honeypotId },
          data: {
            officialResults: JSON.stringify(official),
            deviationPct: Math.round(deviationPct * 100) / 100,
            deviationDetected,
            alertTriggered,
            alertId: alertId ?? undefined,
          },
        });

        return NextResponse.json({
          success: true,
          honeypot: {
            id: updated.id,
            deviationDetected: updated.deviationDetected,
            deviationPct: updated.deviationPct,
            alertTriggered: updated.alertTriggered,
            alertId: updated.alertId,
          },
        });
      }

      case 'TOGGLE_HONEYPOT': {
        const { honeypotId, isActive } = body;

        if (!honeypotId || typeof isActive !== 'boolean') {
          return NextResponse.json(
            { error: 'honeypotId (string) and isActive (boolean) are required' },
            { status: 400 },
          );
        }

        const existing = await db.honeypotUnit.findFirst({
          where: { id: honeypotId, tenantId },
        });

        if (!existing) {
          return NextResponse.json({ error: 'Honeypot unit not found' }, { status: 404 });
        }

        const updated = await db.honeypotUnit.update({
          where: { id: honeypotId },
          data: { isActive },
        });

        return NextResponse.json({
          success: true,
          honeypot: {
            id: updated.id,
            isActive: updated.isActive,
          },
        });
      }

      case 'CREATE_ACCESSIBILITY_REPORT': {
        const { pollingUnitId, reportedById, features, overallScore, barrierTypes, pwdVotersServed, pwdVotersTurnedAway, photoUrl, notes } = body;

        if (!pollingUnitId || !reportedById || !features || overallScore === undefined) {
          return NextResponse.json(
            { error: 'pollingUnitId, reportedById, features, and overallScore are required' },
            { status: 400 },
          );
        }

        if (typeof overallScore !== 'number' || overallScore < 0 || overallScore > 100) {
          return NextResponse.json(
            { error: 'overallScore must be a number between 0 and 100' },
            { status: 400 },
          );
        }

        const report = await db.accessibilityReport.create({
          data: {
            tenantId,
            pollingUnitId,
            reportedById,
            features: JSON.stringify(features),
            barrierTypes: JSON.stringify(barrierTypes || []),
            pwdVotersServed: pwdVotersServed || 0,
            pwdVotersTurnedAway: pwdVotersTurnedAway || 0,
            overallScore,
            photoUrl: photoUrl || null,
            notes: notes || '',
          },
        });

        return NextResponse.json({
          success: true,
          report: {
            id: report.id,
            pollingUnitId: report.pollingUnitId,
            overallScore: report.overallScore,
            verified: report.verified,
            createdAt: report.createdAt,
          },
        }, { status: 201 });
      }

      case 'VERIFY_ACCESSIBILITY': {
        const { reportId } = body;

        if (!reportId) {
          return NextResponse.json(
            { error: 'reportId is required' },
            { status: 400 },
          );
        }

        const existing = await db.accessibilityReport.findFirst({
          where: { id: reportId, tenantId },
        });

        if (!existing) {
          return NextResponse.json({ error: 'Accessibility report not found' }, { status: 404 });
        }

        const updated = await db.accessibilityReport.update({
          where: { id: reportId },
          data: { verified: true },
        });

        return NextResponse.json({
          success: true,
          report: {
            id: updated.id,
            verified: updated.verified,
          },
        });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}. Valid actions: CREATE_HONEYPOT, UPDATE_OFFICIAL_RESULTS, TOGGLE_HONEYPOT, CREATE_ACCESSIBILITY_REPORT, VERIFY_ACCESSIBILITY` },
          { status: 400 },
        );
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to process honeypot request';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}