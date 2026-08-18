import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { resolveTenant } from '@/lib/tenant';
import { getAuthUser } from '@/lib/auth';
import { requireTenantMatch } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

// In-file report template definitions (no schema change needed)
const BUILTIN_TEMPLATES = [
  {
    id: 'tpl-incidents-hourly',
    name: 'Hourly Incident Summary',
    description: 'All incidents in the last hour, grouped by severity and type',
    category: 'INCIDENTS',
    format: 'PDF',
    scheduleInterval: 'HOURLY',
    sections: ['executive_summary', 'incidents_by_severity', 'incidents_by_type', 'incidents_by_state', 'timeline'],
  },
  {
    id: 'tpl-pvt-progress',
    name: 'PVT Progress Report',
    description: 'Quick count verification progress, coverage stats, and anomaly summary',
    category: 'PVT',
    format: 'PDF',
    scheduleInterval: 'EVERY_30MIN',
    sections: ['coverage_stats', 'verification_progress', 'anomaly_summary', 'party_comparison'],
  },
  {
    id: 'tpl-osint-digest',
    name: 'OSINT Daily Digest',
    description: 'Social media monitoring summary with sentiment analysis and CIB detections',
    category: 'OSINT',
    format: 'PDF',
    scheduleInterval: 'DAILY',
    sections: ['platform_breakdown', 'sentiment_analysis', 'viral_content', 'cib_detections', 'disinformation_tracker'],
  },
  {
    id: 'tpl-security-brief',
    name: 'Security Situation Brief',
    description: 'Security events, agent safety status, geofence compliance, and dead-man switch status',
    category: 'SECURITY',
    format: 'PDF',
    scheduleInterval: 'EVERY_2HOURS',
    sections: ['security_events', 'agent_safety', 'geofence_status', 'deadman_switches', 'threat_level'],
  },
  {
    id: 'tpl-election-overview',
    name: 'Election Day Overview',
    description: 'Comprehensive election day status including results, turnout, incidents, and PVT comparison',
    category: 'ELECTION',
    format: 'PDF',
    scheduleInterval: 'EVERY_4HOURS',
    sections: ['turnout_stats', 'results_summary', 'pvt_comparison', 'incident_hotspots', 'media_evidence'],
  },
  {
    id: 'tpl-field-operations',
    name: 'Field Operations Report',
    description: 'Agent engagement, check-in compliance, message delivery stats, and field coverage',
    category: 'OPERATIONS',
    format: 'EXCEL',
    scheduleInterval: 'DAILY',
    sections: ['agent_status', 'checkin_compliance', 'message_delivery', 'field_coverage'],
  },
  {
    id: 'tpl-honeypot-analysis',
    name: 'Honeypot & Integrity Analysis',
    description: 'Honeypot detection results, deviation analysis, and result integrity assessment',
    category: 'INTEGRITY',
    format: 'PDF',
    scheduleInterval: 'EVERY_2HOURS',
    sections: ['honeypot_results', 'deviation_analysis', 'stego_scan_results', 'integrity_score'],
  },
  {
    id: 'tpl-flashpoint-assessment',
    name: 'Flashpoint Risk Assessment',
    description: 'Violence risk forecasts, hot spot analysis, and wargame scenario results',
    category: 'INTELLIGENCE',
    format: 'PDF',
    scheduleInterval: 'EVERY_6HOURS',
    sections: ['risk_forecast', 'hotspot_map', 'wargame_results', 'recommendations'],
  },
];

// GET /api/report-templates?tenantId=...
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

    return NextResponse.json({ templates: BUILTIN_TEMPLATES });
  } catch (err) {
    console.error('[report-templates] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
