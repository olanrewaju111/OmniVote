/**
 * Shared dashboard types extracted from page.tsx.
 * Used by tab-renderer, overview-tab, and various dashboard components.
 */

import type { ElectionInfo } from '@/store/dashboard';

export interface Incident {
  id: string;
  type: string;
  severity: string;
  status: string;
  description: string;
  gpsLat: number | null;
  gpsLng: number | null;
  gpsAnomaly: boolean;
  aiSummary: string | null;
  aiFlags: string[];
  isQuarantined: boolean;
  c2paVerified: boolean;
  submittedAt: string;
  reviewedAt: string | null;
  reporter: { id: string; name: string; role: string } | null;
  pollingUnit: { id: string; name: string; code: string; state: string; lga: string } | null;
}

export interface MapBoundsData {
  minLat: number; maxLat: number; minLng: number; maxLng: number; label: string;
}

export interface DashboardData {
  mapBounds?: MapBoundsData | null;
  electionInfo: ElectionInfo;
  kpis: {
    totalAgents: number; onlineAgents: number; totalIncidents: number;
    pendingIncidents: number; criticalIncidents: number; quarantinedIncidents: number;
    securityAlerts: number; operationalAlerts: number; unreadAlerts: number; sosCount: number;
  };
  election: {
    totalPollingUnits: number; openUnits: number; closedUnits: number; flaggedUnits: number;
    totalRegistered: number; totalVotes: number; avgTurnout: number;
    stateAgg: Record<string, { units: number; votes: number; registered: number; turnout: number }>;
  };
  trends?: {
    onlineAgents?: { value: number; up: boolean };
    incidents?: { value: number; up: boolean };
    turnout?: { value: number; up: boolean };
  };
  pollingUnits: {
    id: string; name: string; code: string; state: string; lga: string;
    lat: number; lng: number; registered: number; votes: number;
    turnout: number; status: string;
  }[];
}

export interface AlertsData {
  alerts: {
    id: string; type: 'OPERATIONAL' | 'SECURITY'; category: 'INFO' | 'WARNING' | 'CRITICAL';
    title: string; description: string; isRead: boolean; createdAt: string;
    incident: { severity: string; status: string; type: string } | null;
  }[];
  unreadCount: number; operationalCount: number; securityCount: number; criticalCount: number;
}

/** Props needed by TabContent to render every tab view */
export interface TabContentProps {
  activeTab: string;
  dashData: DashboardData;
  incidents: Incident[];
  alertsData: AlertsData | undefined;
  liveIncidents: Incident[];
}
