import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { KpiGrid } from './kpi-grid';

const meta: Meta<typeof KpiGrid> = {
  title: 'Dashboard/KPI Grid',
  component: KpiGrid,
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof KpiGrid>;

const mockData = {
  totalAgents: 500,
  onlineAgents: 342,
  totalIncidents: 47,
  pendingIncidents: 12,
  criticalIncidents: 3,
  quarantinedIncidents: 5,
  securityAlerts: 8,
  operationalAlerts: 15,
  unreadAlerts: 4,
  sosCount: 1,
};

const mockElection = {
  totalPollingUnits: 176846,
  openUnits: 165432,
  avgTurnout: 42.7,
  totalRegistered: 93467000,
  totalVotes: 39891000,
};

const mockTrends = {
  onlineAgents: { value: 5.2, up: true },
  incidents: { value: -12.3, up: false },
  turnout: { value: 2.1, up: true },
};

export const Default: Story = {
  args: {
    data: mockData,
    election: mockElection,
    trends: mockTrends,
  },
};

export const WithExtraStats: Story = {
  args: {
    data: mockData,
    election: mockElection,
    trends: mockTrends,
    extraStats: [
      { label: 'Security Alerts', value: 8, color: 'rose' },
      { label: 'Ops Alerts', value: 15, color: 'amber' },
      { label: 'Unread', value: 4, color: 'violet' },
      { label: 'Verified', value: 127, color: 'emerald' },
    ],
  },
};

export const NoTrends: Story = {
  args: {
    data: mockData,
    election: mockElection,
  },
};

export const HighIncidents: Story = {
  args: {
    data: {
      ...mockData,
      totalIncidents: 89,
      criticalIncidents: 12,
      sosCount: 5,
    },
    election: mockElection,
    trends: {
      onlineAgents: { value: 1.2, up: true },
      incidents: { value: 34.5, up: true },
      turnout: { value: -0.8, up: false },
    },
  },
};
