import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, CardAction } from './card';
import { Button } from './button';

const meta: Meta<typeof Card> = {
  title: 'UI/Card',
  component: Card,
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof Card>;

export const Default: Story = {
  render: () => (
    <Card>
      <CardHeader>
        <CardTitle>Card Title</CardTitle>
        <CardDescription>Card description goes here.</CardDescription>
      </CardHeader>
      <CardContent>
        <p>This is the card content area. You can place any content here.</p>
      </CardContent>
    </Card>
  ),
};

export const WithFooter: Story = {
  render: () => (
    <Card>
      <CardHeader>
        <CardTitle>Notification Settings</CardTitle>
        <CardDescription>Manage how you receive notifications.</CardDescription>
      </CardHeader>
      <CardContent>
        <p>You will receive email notifications for important events.</p>
      </CardContent>
      <CardFooter className="gap-2">
        <Button>Save</Button>
        <Button variant="outline">Cancel</Button>
      </CardFooter>
    </Card>
  ),
};

export const WithAction: Story = {
  render: () => (
    <Card>
      <CardHeader>
        <CardTitle>Monitoring</CardTitle>
        <CardDescription>System health overview.</CardDescription>
        <CardAction>
          <Button variant="outline" size="sm">View All</Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-muted-foreground text-sm">Uptime</p>
            <p className="text-2xl font-bold text-emerald">99.9%</p>
          </div>
          <div>
            <p className="text-muted-foreground text-sm">Latency</p>
            <p className="text-2xl font-bold">42ms</p>
          </div>
        </div>
      </CardContent>
    </Card>
  ),
};

export const Glassmorphism: Story = {
  render: () => (
    <Card className="glass card-lift">
      <CardHeader>
        <CardTitle>Glass Card</CardTitle>
        <CardDescription>With glassmorphism effect and hover lift.</CardDescription>
      </CardHeader>
      <CardContent>
        <p>This card uses the glass utility class for a frosted-glass effect.</p>
      </CardContent>
    </Card>
  ),
};

export const KPICard: Story = {
  render: () => (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {[
        { label: 'Total Votes', value: '1,234,567', change: '+12.3%', color: 'text-emerald' },
        { label: 'Active Polls', value: '342', change: '+5.1%', color: 'text-cyan' },
        { label: 'Incidents', value: '7', change: '-23%', color: 'text-rose' },
        { label: 'Agents Online', value: '128', change: '+2', color: 'text-violet' },
      ].map((kpi) => (
        <Card key={kpi.label} className="card-lift">
          <CardHeader className="pb-0">
            <CardDescription>{kpi.label}</CardDescription>
            <CardAction>
              <span className={`text-sm font-medium ${kpi.color}`}>{kpi.change}</span>
            </CardAction>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tracking-tight">{kpi.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  ),
};
