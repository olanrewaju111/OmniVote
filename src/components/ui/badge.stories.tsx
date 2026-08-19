import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Badge } from './badge';

const meta: Meta<typeof Badge> = {
  title: 'UI/Badge',
  component: Badge,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'secondary', 'destructive', 'outline'],
    },
  },
};
export default meta;
type Story = StoryObj<typeof Badge>;

export const Default: Story = {
  args: { children: 'Badge' },
};

export const Secondary: Story = {
  args: { variant: 'secondary', children: 'Secondary' },
};

export const Destructive: Story = {
  args: { variant: 'destructive', children: 'Critical' },
};

export const Outline: Story = {
  args: { variant: 'outline', children: 'Outline' },
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3">
      <Badge variant="default">Default</Badge>
      <Badge variant="secondary">Secondary</Badge>
      <Badge variant="destructive">Destructive</Badge>
      <Badge variant="outline">Outline</Badge>
    </div>
  ),
};

export const StatusBadges: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3">
      <Badge className="bg-emerald/20 text-emerald border-emerald/30">Active</Badge>
      <Badge className="bg-amber/20 text-amber border-amber/30">Pending</Badge>
      <Badge className="bg-rose/20 text-rose border-rose/30">Critical</Badge>
      <Badge className="bg-cyan/20 text-cyan border-cyan/30">Info</Badge>
      <Badge className="bg-violet/20 text-violet border-violet/30">New</Badge>
    </div>
  ),
};

export const WithDot: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3">
      <Badge className="badge-dot bg-emerald/20 text-emerald border-emerald/30">Live</Badge>
      <Badge className="badge-pulse bg-rose/20 text-rose border-rose/30">Alert</Badge>
    </div>
  ),
};
