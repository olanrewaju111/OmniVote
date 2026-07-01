import { create } from 'zustand';

export type ViewTab = 'overview' | 'map' | 'feed' | 'alerts' | 'ai' | 'media';

interface DashboardState {
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