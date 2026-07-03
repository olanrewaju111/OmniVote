import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { resolveTenant } from '@/lib/tenant';
import { safeParse } from '@/lib/safe-parse';

// GET /api/flashpoint?tenantId=X
export async function GET(req: NextRequest) {
  try {
    const { id: tenantId, error } = await resolveTenant(req);
    if (error) return error;

    const [forecasts, scenarios] = await Promise.all([
      db.flashpointForecast.findMany({
        where: { tenantId },
        orderBy: { generatedAt: 'desc' },
      }),
      db.wargameScenario.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const parsedForecasts = forecasts.map(f => ({
      ...f,
      riskScores: safeParse(f.riskScores, {}),
      forecast: safeParse(f.forecast, []),
      contributingFactors: safeParse(f.contributingFactors, []),
    }));

    const parsedScenarios = scenarios.map(s => ({
      ...s,
      parameters: safeParse(s.parameters, {}),
      steps: safeParse(s.steps, []),
      results: safeParse(s.results, null),
    }));

    // Stats
    const totalForecasts = forecasts.length;

    const byRiskLevel = Object.fromEntries(
      ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map(level => [
        level,
        forecasts.filter(f => f.riskLevel === level).length,
      ])
    );

    const highRiskStates = [
      ...new Set(
        forecasts
          .filter(f => f.riskLevel === 'HIGH' || f.riskLevel === 'CRITICAL')
          .map(f => f.state)
      ),
    ];

    const totalScenarios = scenarios.length;

    const byScenarioStatus = Object.fromEntries(
      ['DRAFT', 'RUNNING', 'COMPLETED', 'ARCHIVED'].map(status => [
        status,
        scenarios.filter(s => s.status === status).length,
      ])
    );

    const avgConfidence =
      forecasts.length > 0
        ? forecasts.reduce((sum, f) => sum + f.confidence, 0) / forecasts.length
        : 0;

    // Heatmap data: flatten all forecast days, grouped by state + date
    const heatmapData: Array<{
      state: string;
      lga: string | null;
      date: string;
      overall: number;
      violence: number;
      intimidation: number;
      logistics: number;
      riskLevel: string;
    }> = [];

    for (const f of forecasts) {
      const days = safeParse(f.forecast, []) as Array<{
        date: string;
        overall: number;
        violence: number;
        intimidation: number;
        logistics: number;
      }>;
      for (const day of days) {
        heatmapData.push({
          state: f.state,
          lga: f.lga,
          date: day.date,
          overall: day.overall,
          violence: day.violence,
          intimidation: day.intimidation,
          logistics: day.logistics,
          riskLevel: f.riskLevel,
        });
      }
    }

    // Top 10 contributing factors by frequency
    const factorCounts: Record<string, number> = {};
    for (const f of forecasts) {
      const factors = safeParse(f.contributingFactors, []) as string[];
      for (const factor of factors) {
        factorCounts[factor] = (factorCounts[factor] || 0) + 1;
      }
    }
    const topContributingFactors = Object.entries(factorCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([factor, count]) => ({ factor, count }));

    return NextResponse.json({
      forecasts: parsedForecasts,
      scenarios: parsedScenarios,
      stats: {
        totalForecasts,
        byRiskLevel,
        highRiskStates,
        totalScenarios,
        byScenarioStatus,
        avgConfidence,
      },
      heatmapData,
      topContributingFactors,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch flashpoint data' }, { status: 500 });
  }
}

// POST /api/flashpoint?tenantId=X
export async function POST(req: NextRequest) {
  try {
    const { id: tenantId, error } = await resolveTenant(req);
    if (error) return error;

    const body = await req.json();
    const { action } = body;

    if (!action) {
      return NextResponse.json({ error: 'action is required' }, { status: 400 });
    }

    // -------------------------------------------------------
    // CREATE_FORECAST
    // -------------------------------------------------------
    if (action === 'CREATE_FORECAST') {
      const { state, riskScores, riskLevel, forecast, confidence, lga, contributingFactors, aiModel } = body;

      if (!state || !riskScores || !riskLevel || !forecast || confidence === undefined) {
        return NextResponse.json(
          { error: 'state, riskScores, riskLevel, forecast, and confidence are required' },
          { status: 400 }
        );
      }

      const validRiskLevels = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
      if (!validRiskLevels.includes(riskLevel)) {
        return NextResponse.json({ error: 'riskLevel must be LOW, MEDIUM, HIGH, or CRITICAL' }, { status: 400 });
      }

      if (typeof confidence !== 'number' || confidence < 0 || confidence > 1) {
        return NextResponse.json({ error: 'confidence must be a number between 0 and 1' }, { status: 400 });
      }

      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      const created = await db.flashpointForecast.create({
        data: {
          tenantId,
          state,
          lga: lga || null,
          riskScores: JSON.stringify(riskScores),
          riskLevel,
          forecast: JSON.stringify(forecast),
          contributingFactors: JSON.stringify(contributingFactors || []),
          aiModel: aiModel || 'ensemble_v2',
          confidence,
          expiresAt,
        },
      });

      return NextResponse.json(
        {
          success: true,
          forecast: {
            ...created,
            riskScores: safeParse(created.riskScores, {}),
            forecast: safeParse(created.forecast, []),
            contributingFactors: safeParse(created.contributingFactors, []),
          },
        },
        { status: 201 }
      );
    }

    // -------------------------------------------------------
    // RUN_WARGAME
    // -------------------------------------------------------
    if (action === 'RUN_WARGAME') {
      const { title, description, parameters, steps, currentPlayerRole } = body;

      if (!title || !description) {
        return NextResponse.json({ error: 'title and description are required' }, { status: 400 });
      }

      const now = new Date();
      const data: Record<string, unknown> = {
        tenantId,
        title,
        description,
        parameters: JSON.stringify(parameters || {}),
        steps: JSON.stringify(steps || []),
        status: 'RUNNING',
        startedAt: now,
        currentPlayerRole: currentPlayerRole || null,
      };

      const created = await db.wargameScenario.create({ data: data as never });

      return NextResponse.json(
        {
          success: true,
          scenario: {
            ...created,
            parameters: safeParse(created.parameters, {}),
            steps: safeParse(created.steps, []),
            results: safeParse(created.results, null),
          },
        },
        { status: 201 }
      );
    }

    // -------------------------------------------------------
    // COMPLETE_WARGAME
    // -------------------------------------------------------
    if (action === 'COMPLETE_WARGAME') {
      const { scenarioId, score, results } = body;

      if (!scenarioId) {
        return NextResponse.json({ error: 'scenarioId is required' }, { status: 400 });
      }

      const existing = await db.wargameScenario.findFirst({
        where: { id: scenarioId, tenantId },
      });
      if (!existing) {
        return NextResponse.json({ error: 'Scenario not found' }, { status: 404 });
      }

      const updated = await db.wargameScenario.update({
        where: { id: scenarioId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          score: score !== undefined ? score : null,
          results: results ? JSON.stringify(results) : existing.results,
        },
      });

      return NextResponse.json({
        success: true,
        scenario: {
          ...updated,
          parameters: safeParse(updated.parameters, {}),
          steps: safeParse(updated.steps, []),
          results: safeParse(updated.results, null),
        },
      });
    }

    // -------------------------------------------------------
    // STEP_WARGAME
    // -------------------------------------------------------
    if (action === 'STEP_WARGAME') {
      const { scenarioId, step, description, action: stepAction, outcome } = body;

      if (!scenarioId || step === undefined || !description || !stepAction || !outcome) {
        return NextResponse.json(
          { error: 'scenarioId, step, description, action, and outcome are required' },
          { status: 400 }
        );
      }

      const existing = await db.wargameScenario.findFirst({
        where: { id: scenarioId, tenantId },
      });
      if (!existing) {
        return NextResponse.json({ error: 'Scenario not found' }, { status: 404 });
      }

      if (existing.status !== 'RUNNING') {
        return NextResponse.json({ error: 'Scenario must be in RUNNING status to add steps' }, { status: 400 });
      }

      const currentSteps = safeParse(existing.steps, []) as Array<{
        step: number;
        description: string;
        action: string;
        outcome: string;
      }>;

      currentSteps.push({ step, description, action: stepAction, outcome });

      const updated = await db.wargameScenario.update({
        where: { id: scenarioId },
        data: {
          steps: JSON.stringify(currentSteps),
        },
      });

      return NextResponse.json({
        success: true,
        scenario: {
          ...updated,
          parameters: safeParse(updated.parameters, {}),
          steps: safeParse(updated.steps, []),
          results: safeParse(updated.results, null),
        },
      });
    }

    // -------------------------------------------------------
    // ARCHIVE_SCENARIO
    // -------------------------------------------------------
    if (action === 'ARCHIVE_SCENARIO') {
      const { scenarioId } = body;

      if (!scenarioId) {
        return NextResponse.json({ error: 'scenarioId is required' }, { status: 400 });
      }

      const existing = await db.wargameScenario.findFirst({
        where: { id: scenarioId, tenantId },
      });
      if (!existing) {
        return NextResponse.json({ error: 'Scenario not found' }, { status: 404 });
      }

      const updated = await db.wargameScenario.update({
        where: { id: scenarioId },
        data: { status: 'ARCHIVED' },
      });

      return NextResponse.json({
        success: true,
        scenario: {
          ...updated,
          parameters: safeParse(updated.parameters, {}),
          steps: safeParse(updated.steps, []),
          results: safeParse(updated.results, null),
        },
      });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to process flashpoint request' }, { status: 500 });
  }
}