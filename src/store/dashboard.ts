import { create } from 'zustand';

export type ViewTab = 'overview' | 'map' | 'feed' | 'alerts' | 'ai' | 'media' | 'agents' | 'submit' | 'my-reports' | 'system' | 'tenants';

export type UserRole = 'SUPER_ADMIN' | 'TENANT_ADMIN' | 'ANALYST' | 'TRUST_SAFETY' | 'FIELD_AGENT';

export interface UserInfo {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  tenantName: string;
}

// Role-based tab permissions
export const ROLE_TABS: Record<UserRole, ViewTab[]> = {
  SUPER_ADMIN: ['overview', 'map', 'feed', 'alerts', 'ai', 'media', 'agents', 'system', 'tenants'],
  TENANT_ADMIN: ['overview', 'map', 'feed', 'alerts', 'agents'],
  ANALYST: ['overview', 'map', 'feed', 'alerts', 'ai', 'media'],
  TRUST_SAFETY: ['alerts', 'media', 'ai', 'feed'],
  FIELD_AGENT: ['submit', 'my-reports', 'feed'],
};

interface DashboardState {
  // Auth
  user: UserInfo | null;
  isAuthenticated: boolean;
  login: (user: UserInfo) => void;
  logout: () => void;

  // Navigation
  activeTab: ViewTab;
  electionTier: 'LOCAL' | 'STATE' | 'PRESIDENTIAL';
  alertFilter: 'ALL' | 'OPERATIONAL' | 'SECURITY';
  incidentFilter: { type: string; severity: string; status: string };
  sidebarCollapsed: boolean;
  liveFeedPaused: boolean;
  setSelectedTab: (tab: ViewTab) => void;
  setElectionTier: (tier: 'LOCAL' | 'STATE' | 'PRESIDENTIAL') => void;
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
  logout: () => set({ user: null, isAuthenticated: false, activeTab: 'overview', alertFilter: 'ALL' }),

  // Navigation
  activeTab: 'overview',
  electionTier: 'PRESIDENTIAL',
  alertFilter: 'ALL',
  incidentFilter: { type: 'ALL', severity: 'ALL', status: 'ALL' },
  sidebarCollapsed: false,
  liveFeedPaused: false,
  setSelectedTab: (tab) => set({ activeTab: tab }),
  setElectionTier: (tier) => set({ electionTier: tier }),
  setAlertFilter: (filter) => set({ alertFilter: filter }),
  setIncidentFilter: (filter) => set({ incidentFilter: filter }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  toggleLiveFeed: () => set((s) => ({ liveFeedPaused: !s.liveFeedPaused })),
}));