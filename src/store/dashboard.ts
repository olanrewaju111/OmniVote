import { create } from 'zustand';

export type ViewTab = 'overview' | 'situation' | 'map' | 'feed' | 'alerts' | 'osint' | 'ai' | 'media' | 'mobilization' | 'campaigns' | 'campaign-analytics' | 'social-cards' | 'security' | 'field-safety' | 'agents' | 'engagement' | 'submit' | 'my-reports' | 'system' | 'tenants' | 'pvt' | 'evidence' | 'flashpoint' | 'honeypot' | 'audit-logs' | 'victory-roadmap' | 'narrative' | 'reports' | 'activity-stream' | 'data-explorer';

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
  SUPER_ADMIN: ['overview', 'situation', 'map', 'feed', 'alerts', 'osint', 'ai', 'media', 'mobilization', 'campaigns', 'campaign-analytics', 'social-cards', 'data-explorer', 'security', 'field-safety', 'agents', 'engagement', 'pvt', 'evidence', 'flashpoint', 'honeypot', 'audit-logs', 'my-reports', 'system', 'tenants', 'victory-roadmap', 'narrative', 'reports', 'activity-stream'],
  TENANT_ADMIN: ['overview', 'situation', 'map', 'feed', 'alerts', 'osint', 'mobilization', 'campaigns', 'campaign-analytics', 'social-cards', 'data-explorer', 'security', 'field-safety', 'agents', 'engagement', 'pvt', 'evidence', 'flashpoint', 'honeypot', 'audit-logs', 'my-reports', 'tenants', 'victory-roadmap', 'narrative', 'reports', 'activity-stream'],
  ANALYST: ['overview', 'situation', 'map', 'feed', 'alerts', 'osint', 'ai', 'media', 'data-explorer', 'engagement', 'pvt', 'evidence', 'flashpoint', 'audit-logs', 'campaign-analytics', 'my-reports', 'victory-roadmap', 'narrative', 'reports', 'activity-stream'],
  TRUST_SAFETY: ['alerts', 'osint', 'media', 'ai', 'feed', 'security', 'engagement', 'evidence', 'honeypot', 'audit-logs', 'my-reports', 'reports', 'activity-stream'],
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
  globalSearch: string;
  navHistory: ViewTab[];
  navHistoryIndex: number;
  setSelectedTab: (tab: ViewTab) => void;
  goBack: () => void;
  goForward: () => void;
  setAlertFilter: (filter: 'ALL' | 'OPERATIONAL' | 'SECURITY') => void;
  setIncidentFilter: (filter: { type: string; severity: string; status: string }) => void;
  toggleSidebar: () => void;
  toggleLiveFeed: () => void;
  setUnreadAlerts: (n: number) => void;
  setGlobalSearch: (q: string) => void;

  // SSE/WebSocket connection state
  sseConnected: boolean;
  wsConnected: boolean;
  wsTransport: 'ws' | 'sse' | 'none';
  wsOnlineCount: number;
  setSseConnected: (v: boolean) => void;
  setWsConnected: (v: boolean, transport: 'ws' | 'sse' | 'none') => void;
  setWsOnlineCount: (n: number) => void;
}

export const useDashboardStore = create<DashboardState>((set, get) => ({
  // Auth defaults
  user: null,
  isAuthenticated: false,
  login: (user) => {
    const defaultTab = ROLE_TABS[user.role]?.[0] || 'overview';
    set({ user, isAuthenticated: true, activeTab: defaultTab, alertFilter: 'ALL' });
  },
  logout: () => {
    const currentSlug = get().user?.tenantSlug || '';
    // Clear server-side session
    fetch('/api/auth', { method: 'DELETE', credentials: 'include' }).catch(() => {});
    set({ user: null, isAuthenticated: false, activeTab: 'overview', alertFilter: 'ALL', electionInfo: null, electionTier: 'PRESIDENTIAL', tenantId: '', unreadAlerts: 0, globalSearch: '' });
    // Redirect to tenant-specific login page
    if (currentSlug) {
      window.location.href = `/t/${currentSlug}`;
    }
  },

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
  globalSearch: '',
  navHistory: ['overview'],
  navHistoryIndex: 0,
  setSelectedTab: (tab) => {
    const { navHistory, navHistoryIndex, activeTab } = get();
    // Don't push duplicates of the current position
    if (tab === activeTab) return;
    // If we navigated back and then pick a new tab, truncate forward history
    const newHistory = navHistory.slice(0, navHistoryIndex + 1);
    newHistory.push(tab);
    set({ activeTab: tab, navHistory: newHistory, navHistoryIndex: newHistory.length - 1 });
  },
  goBack: () => {
    const { navHistory, navHistoryIndex } = get();
    if (navHistoryIndex > 0) {
      const newIndex = navHistoryIndex - 1;
      set({ activeTab: navHistory[newIndex], navHistoryIndex: newIndex });
    }
  },
  goForward: () => {
    const { navHistory, navHistoryIndex } = get();
    if (navHistoryIndex < navHistory.length - 1) {
      const newIndex = navHistoryIndex + 1;
      set({ activeTab: navHistory[newIndex], navHistoryIndex: newIndex });
    }
  },
  setAlertFilter: (filter) => set({ alertFilter: filter }),
  setIncidentFilter: (filter) => set({ incidentFilter: filter }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  toggleLiveFeed: () => set((s) => ({ liveFeedPaused: !s.liveFeedPaused })),
  setUnreadAlerts: (n) => set({ unreadAlerts: n }),
  setGlobalSearch: (q) => set({ globalSearch: q }),

  // SSE/WebSocket connection state
  sseConnected: false,
  wsConnected: false,
  wsTransport: 'none' as 'ws' | 'sse' | 'none',
  wsOnlineCount: 0,
  setSseConnected: (v) => set({ sseConnected: v }),
  setWsConnected: (v, transport) => set({ wsConnected: v, wsTransport: transport }),
  setWsOnlineCount: (n) => set({ wsOnlineCount: n }),
}));