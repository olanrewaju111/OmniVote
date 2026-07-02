import { create } from 'zustand';

export type ViewTab = 'overview' | 'situation' | 'map' | 'feed' | 'alerts' | 'ai' | 'media' | 'agents' | 'engagement' | 'submit' | 'my-reports' | 'system' | 'tenants';

export type UserRole = 'SUPER_ADMIN' | 'TENANT_ADMIN' | 'ANALYST' | 'TRUST_SAFETY' | 'FIELD_AGENT';

export type ElectionTier = 'LOCAL' | 'STATE' | 'PRESIDENTIAL';

export interface ElectionInfo {
  tier: ElectionTier;
  title: string;
  status: string;
  date: string | null;
}

export interface UserInfo {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
}

// Role-based tab permissions
export const ROLE_TABS: Record<UserRole, ViewTab[]> = {
  SUPER_ADMIN: ['overview', 'situation', 'map', 'feed', 'alerts', 'ai', 'media', 'agents', 'engagement', 'my-reports', 'system', 'tenants'],
  TENANT_ADMIN: ['overview', 'situation', 'map', 'feed', 'alerts', 'agents', 'engagement', 'my-reports'],
  ANALYST: ['overview', 'situation', 'map', 'feed', 'alerts', 'ai', 'media', 'engagement', 'my-reports'],
  TRUST_SAFETY: ['alerts', 'media', 'ai', 'feed', 'engagement', 'my-reports'],
  FIELD_AGENT: ['submit', 'my-reports', 'feed'],
};

// Display labels for election tiers
export const TIER_LABELS: Record<ElectionTier, string> = {
  PRESIDENTIAL: 'Presidential Election',
  STATE: 'Governorship Election',
  LOCAL: 'Local Government Election',
};

export const TIER_SHORT: Record<ElectionTier, string> = {
  PRESIDENTIAL: 'Presidential',
  STATE: 'Governorship',
  LOCAL: 'Local Gov',
};

interface DashboardState {
  // Auth
  user: UserInfo | null;
  isAuthenticated: boolean;
  login: (user: UserInfo) => void;
  logout: () => void;

  // Election — set from server only, one type per tenant
  electionTier: ElectionTier;
  electionInfo: ElectionInfo | null;
  setElectionInfo: (info: ElectionInfo) => void;

  // Tenant
  tenantId: string;
  setTenantId: (id: string) => void;

  // Navigation
  activeTab: ViewTab;
  unreadAlerts: number;
  alertFilter: 'ALL' | 'OPERATIONAL' | 'SECURITY';
  incidentFilter: { type: string; severity: string; status: string };
  sidebarCollapsed: boolean;
  liveFeedPaused: boolean;
  setSelectedTab: (tab: ViewTab) => void;
  setAlertFilter: (filter: 'ALL' | 'OPERATIONAL' | 'SECURITY') => void;
  setIncidentFilter: (filter: { type: string; severity: string; status: string }) => void;
  toggleSidebar: () => void;
  toggleLiveFeed: () => void;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  // Auth defaults
  user: null,
  isAuthenticated: false,
  login: (user) => {
    const defaultTab = ROLE_TABS[user.role]?.[0] || 'overview';
    set({ user, isAuthenticated: true, activeTab: defaultTab, alertFilter: 'ALL' });
  },
  logout: () => set({ user: null, isAuthenticated: false, activeTab: 'overview', alertFilter: 'ALL', electionInfo: null, electionTier: 'PRESIDENTIAL', tenantId: '' }),

  // Election — server-driven, one tier per tenant
  electionTier: 'PRESIDENTIAL',
  electionInfo: null,
  setElectionInfo: (info) => set({ electionInfo: info, electionTier: info.tier }),

  // Tenant
  tenantId: '',
  setTenantId: (id) => set({ tenantId: id }),

  // Navigation
  activeTab: 'overview',
  unreadAlerts: 0,
  alertFilter: 'ALL',
  incidentFilter: { type: 'ALL', severity: 'ALL', status: 'ALL' },
  sidebarCollapsed: false,
  liveFeedPaused: false,
  setSelectedTab: (tab) => set({ activeTab: tab }),
  setAlertFilter: (filter) => set({ alertFilter: filter }),
  setIncidentFilter: (filter) => set({ incidentFilter: filter }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  toggleLiveFeed: () => set((s) => ({ liveFeedPaused: !s.liveFeedPaused })),
}));