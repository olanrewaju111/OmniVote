import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './tabs';

const meta: Meta<typeof Tabs> = {
  title: 'UI/Tabs',
  component: Tabs,
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof Tabs>;

export const Default: Story = {
  render: () => (
    <Tabs defaultValue="overview">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="analytics">Analytics</TabsTrigger>
        <TabsTrigger value="settings">Settings</TabsTrigger>
      </TabsList>
      <TabsContent value="overview">
        <div className="rounded-lg border p-4">
          <h3 className="font-semibold">Overview</h3>
          <p className="text-muted-foreground mt-1">This is the overview panel with election summary data.</p>
        </div>
      </TabsContent>
      <TabsContent value="analytics">
        <div className="rounded-lg border p-4">
          <h3 className="font-semibold">Analytics</h3>
          <p className="text-muted-foreground mt-1">Charts and graphs showing voting trends.</p>
        </div>
      </TabsContent>
      <TabsContent value="settings">
        <div className="rounded-lg border p-4">
          <h3 className="font-semibold">Settings</h3>
          <p className="text-muted-foreground mt-1">Configuration options for the election.</p>
        </div>
      </TabsContent>
    </Tabs>
  ),
};

export const DashboardTabs: Story = {
  render: () => (
    <Tabs defaultValue="live">
      <TabsList>
        <TabsTrigger value="live">Live Feed</TabsTrigger>
        <TabsTrigger value="incidents">Incidents</TabsTrigger>
        <TabsTrigger value="map">Map</TabsTrigger>
        <TabsTrigger value="analytics">Analytics</TabsTrigger>
      </TabsList>
      <TabsContent value="live">
        <div className="rounded-lg border p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="animate-pulse-dot size-2 rounded-full bg-emerald" />
            <span className="text-sm font-medium">Live Updates</span>
          </div>
          <p className="text-muted-foreground text-sm">Real-time election feed with 42 active streams.</p>
        </div>
      </TabsContent>
      <TabsContent value="incidents">
        <div className="rounded-lg border p-4">
          <p className="text-muted-foreground">3 active incidents, 1 critical.</p>
        </div>
      </TabsContent>
      <TabsContent value="map">
        <div className="map-grid rounded-lg border p-8 text-center">
          <p className="text-muted-foreground">Geographic visualization placeholder.</p>
        </div>
      </TabsContent>
      <TabsContent value="analytics">
        <div className="rounded-lg border p-4">
          <p className="text-muted-foreground">Voting analytics and trends.</p>
        </div>
      </TabsContent>
    </Tabs>
  ),
};
