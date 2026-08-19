/**
 * column-definitions.ts — Pre-defined export column layouts for each entity type.
 * Ensures consistent, well-labeled exports across the platform.
 */

import type { ExportColumn } from './export-engine';

// ─── Helpers ─────────────────────────────────────────────────────

const dateFmt = (v: unknown): string => {
  if (!v) return '';
  try { return new Date(v as string).toISOString().replace('T', ' ').substring(0, 19); }
  catch { return String(v); }
};

const jsonFmt = (v: unknown): string => {
  if (!v) return '';
  try {
    const parsed = JSON.parse(v as string);
    return Array.isArray(parsed) ? parsed.map((p: Record<string, unknown>) => `${p.party || p.name}: ${p.votes || p.count}`).join('; ') : JSON.stringify(parsed);
  } catch { return String(v); }
};

const pctFmt = (v: unknown): string => {
  if (v === null || v === undefined) return '0%';
  return `${Number(v).toFixed(1)}%`;
};

const boolFmt = (v: unknown): string => v ? 'Yes' : 'No';

// ─── Incidents ───────────────────────────────────────────────────

export const INCIDENT_COLUMNS: ExportColumn[] = [
  { key: 'id', label: 'ID' },
  { key: 'type', label: 'Type', transform: v => String(v).replace(/_/g, ' ') },
  { key: 'severity', label: 'Severity' },
  { key: 'status', label: 'Status' },
  { key: 'description', label: 'Description' },
  { key: 'state', label: 'State' },
  { key: 'lga', label: 'LGA' },
  { key: 'gpsLatitude', label: 'Latitude' },
  { key: 'gpsLongitude', label: 'Longitude' },
  { key: 'gpsAnomaly', label: 'GPS Anomaly', transform: boolFmt },
  { key: 'c2paVerified', label: 'C2PA Verified', transform: boolFmt },
  { key: 'isQuarantined', label: 'Quarantined', transform: boolFmt },
  { key: 'reporterName', label: 'Reporter' },
  { key: 'submittedAt', label: 'Submitted At', transform: dateFmt },
  { key: 'reviewedAt', label: 'Reviewed At', transform: dateFmt },
];

// ─── Election Results ────────────────────────────────────────────

export const RESULT_COLUMNS: ExportColumn[] = [
  { key: 'id', label: 'ID' },
  { key: 'pollingUnitName', label: 'Polling Unit' },
  { key: 'pollingUnitCode', label: 'PU Code' },
  { key: 'state', label: 'State' },
  { key: 'lga', label: 'LGA' },
  { key: 'ward', label: 'Ward' },
  { key: 'accreditedVoters', label: 'Accredited Voters' },
  { key: 'totalValidVotes', label: 'Valid Votes' },
  { key: 'rejectedBallots', label: 'Rejected Ballots' },
  { key: 'totalVotesCast', label: 'Total Votes Cast' },
  { key: 'partyResults', label: 'Party Results', transform: jsonFmt },
  { key: 'bvasUsed', label: 'BVAS Used', transform: boolFmt },
  { key: 'materialsArrivedOnTime', label: 'Materials On Time', transform: boolFmt },
  { key: 'securityPresent', label: 'Security Present', transform: boolFmt },
  { key: 'violenceOccurred', label: 'Violence', transform: boolFmt },
  { key: 'verified', label: 'Verified', transform: boolFmt },
  { key: 'submittedAt', label: 'Submitted At', transform: dateFmt },
];

// ─── PVT Submissions ─────────────────────────────────────────────

export const PVT_COLUMNS: ExportColumn[] = [
  { key: 'id', label: 'ID' },
  { key: 'pollingUnitName', label: 'Polling Unit' },
  { key: 'pollingUnitCode', label: 'PU Code' },
  { key: 'accreditedVoters', label: 'Accredited Voters' },
  { key: 'totalValidVotes', label: 'Valid Votes' },
  { key: 'rejectedBallots', label: 'Rejected Ballots' },
  { key: 'totalVotesCast', label: 'Total Votes Cast' },
  { key: 'partyResults', label: 'Party Results', transform: jsonFmt },
  { key: 'source', label: 'Source' },
  { key: 'isVerified', label: 'Verified', transform: boolFmt },
  { key: 'submittedAt', label: 'Submitted At', transform: dateFmt },
];

// ─── Audit Logs ──────────────────────────────────────────────────

export const AUDIT_LOG_COLUMNS: ExportColumn[] = [
  { key: 'id', label: 'ID' },
  { key: 'userName', label: 'User' },
  { key: 'userEmail', label: 'Email' },
  { key: 'action', label: 'Action' },
  { key: 'entityType', label: 'Entity Type' },
  { key: 'entityId', label: 'Entity ID' },
  { key: 'ipAddress', label: 'IP Address' },
  { key: 'metadata', label: 'Details', transform: jsonFmt },
  { key: 'createdAt', label: 'Timestamp', transform: dateFmt },
];

// ─── Security Events ─────────────────────────────────────────────

export const SECURITY_EVENT_COLUMNS: ExportColumn[] = [
  { key: 'id', label: 'ID' },
  { key: 'eventType', label: 'Event Type', transform: v => String(v).replace(/_/g, ' ') },
  { key: 'severity', label: 'Severity' },
  { key: 'userName', label: 'User' },
  { key: 'ipAddress', label: 'IP Address' },
  { key: 'userAgent', label: 'User Agent' },
  { key: 'description', label: 'Description' },
  { key: 'resolved', label: 'Resolved', transform: boolFmt },
  { key: 'createdAt', label: 'Timestamp', transform: dateFmt },
];

// ─── OSINT Posts ─────────────────────────────────────────────────

export const OSINT_COLUMNS: ExportColumn[] = [
  { key: 'id', label: 'ID' },
  { key: 'platform', label: 'Platform' },
  { key: 'author', label: 'Author' },
  { key: 'authorFollowers', label: 'Followers' },
  { key: 'content', label: 'Content' },
  { key: 'sentiment', label: 'Sentiment' },
  { key: 'category', label: 'Category', transform: v => String(v).replace(/_/g, ' ') },
  { key: 'isFakeNews', label: 'Fake News', transform: boolFmt },
  { key: 'isBotSuspect', label: 'Bot Suspect', transform: boolFmt },
  { key: 'cibScore', label: 'CIB Score', transform: pctFmt },
  { key: 'viralityScore', label: 'Virality' },
  { key: 'location', label: 'Location' },
  { key: 'publishedAt', label: 'Published At', transform: dateFmt },
];

// ─── Alerts ──────────────────────────────────────────────────────

export const ALERT_COLUMNS: ExportColumn[] = [
  { key: 'id', label: 'ID' },
  { key: 'type', label: 'Type' },
  { key: 'category', label: 'Category' },
  { key: 'title', label: 'Title' },
  { key: 'description', label: 'Description' },
  { key: 'incidentId', label: 'Incident ID' },
  { key: 'isRead', label: 'Read', transform: boolFmt },
  { key: 'createdAt', label: 'Created At', transform: dateFmt },
];

// ─── Agent Check-Ins ─────────────────────────────────────────────

export const CHECKIN_COLUMNS: ExportColumn[] = [
  { key: 'id', label: 'ID' },
  { key: 'agentName', label: 'Agent' },
  { key: 'zoneName', label: 'Geofence Zone' },
  { key: 'status', label: 'Status', transform: v => String(v).replace(/_/g, ' ') },
  { key: 'isInsideZone', label: 'Inside Zone', transform: boolFmt },
  { key: 'latitude', label: 'Latitude' },
  { key: 'longitude', label: 'Longitude' },
  { key: 'batteryLevel', label: 'Battery %' },
  { key: 'networkType', label: 'Network' },
  { key: 'checkedInAt', label: 'Check-In At', transform: dateFmt },
];

// ─── Campaign Events ─────────────────────────────────────────────

export const CAMPAIGN_EVENT_COLUMNS: ExportColumn[] = [
  { key: 'id', label: 'ID' },
  { key: 'eventType', label: 'Event Type', transform: v => String(v).replace(/_/g, ' ') },
  { key: 'title', label: 'Title' },
  { key: 'party', label: 'Party' },
  { key: 'state', label: 'State' },
  { key: 'lga', label: 'LGA' },
  { key: 'venue', label: 'Venue' },
  { key: 'estimatedCrowd', label: 'Est. Crowd' },
  { key: 'tone', label: 'Tone' },
  { key: 'incidentCount', label: 'Incidents' },
  { key: 'eventDate', label: 'Event Date', transform: dateFmt },
];

// ─── Voter Suppression Reports ───────────────────────────────────

export const VOTER_SUPPRESSION_COLUMNS: ExportColumn[] = [
  { key: 'id', label: 'ID' },
  { key: 'reportType', label: 'Type', transform: v => String(v).replace(/_/g, ' ') },
  { key: 'title', label: 'Title' },
  { key: 'description', label: 'Description' },
  { key: 'state', label: 'State' },
  { key: 'severity', label: 'Severity' },
  { key: 'status', label: 'Status' },
  { key: 'isDisinformation', label: 'Disinformation', transform: boolFmt },
  { key: 'affectedVoters', label: 'Affected Voters' },
  { key: 'source', label: 'Source' },
  { key: 'createdAt', label: 'Reported At', transform: dateFmt },
];

// ─── Column Registry ─────────────────────────────────────────────

export const EXPORT_COLUMNS: Record<string, ExportColumn[]> = {
  incidents: INCIDENT_COLUMNS,
  results: RESULT_COLUMNS,
  pvt: PVT_COLUMNS,
  'audit-logs': AUDIT_LOG_COLUMNS,
  'security-events': SECURITY_EVENT_COLUMNS,
  osint: OSINT_COLUMNS,
  alerts: ALERT_COLUMNS,
 'agent-checkins': CHECKIN_COLUMNS,
  'campaign-events': CAMPAIGN_EVENT_COLUMNS,
  'voter-suppression': VOTER_SUPPRESSION_COLUMNS,
};

export function getColumnsForType(entityType: string): ExportColumn[] {
  return EXPORT_COLUMNS[entityType] || [];
}
