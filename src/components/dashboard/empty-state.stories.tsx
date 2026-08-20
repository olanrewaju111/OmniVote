import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { EmptyState } from './empty-state';
import { Inbox, AlertTriangle, Search, FileText } from 'lucide-react';

const meta: Meta<typeof EmptyState> = {
  title: 'Dashboard/Empty State',
  component: EmptyState,
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
    },
  },
};
export default meta;
type Story = StoryObj<typeof EmptyState>;

export const Default: Story = {
  args: {
    icon: Inbox,
    title: 'No incidents reported',
    description: 'When incidents are reported by field agents, they will appear here.',
    size: 'md',
  },
};

export const WithAction: Story = {
  args: {
    icon: Search,
    title: 'No results found',
    description: 'Try adjusting your search or filter criteria.',
    size: 'md',
    action: {
      label: 'Clear Filters',
      onClick: () => alert('Filters cleared'),
    },
  },
};

export const Small: Story = {
  args: {
    icon: FileText,
    title: 'No reports',
    description: 'Generate your first report.',
    size: 'sm',
  },
};

export const Large: Story = {
  args: {
    icon: AlertTriangle,
    title: 'No security alerts',
    description: 'Your security monitoring is active. Alerts will appear here when detected.',
    size: 'lg',
    action: {
      label: 'Run Security Scan',
      onClick: () => alert('Scanning...'),
    },
  },
};

export const AllSizes: Story = {
  render: () => (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <EmptyState icon={Inbox} title="Small" description="Small empty state" size="sm" />
      <EmptyState icon={Inbox} title="Medium" description="Medium empty state" size="md" />
      <EmptyState icon={Inbox} title="Large" description="Large empty state" size="lg" />
    </div>
  ),
};
