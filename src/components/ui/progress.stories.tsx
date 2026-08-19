import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Progress } from './progress';

const meta: Meta<typeof Progress> = {
  title: 'UI/Progress',
  component: Progress,
  tags: ['autodocs'],
  argTypes: {
    value: { control: 'number', min: 0, max: 100 },
  },
};
export default meta;
type Story = StoryObj<typeof Progress>;

export const Default: Story = {
  args: { value: 60 },
};

export const Zero: Story = {
  args: { value: 0 },
};

export const Complete: Story = {
  args: { value: 100 },
};

export const Striped: Story = {
  render: () => (
    <div className="space-y-4 w-full max-w-md">
      <div>
        <div className="flex justify-between mb-1">
          <span className="text-sm">Uploading evidence...</span>
          <span className="text-sm text-muted-foreground">73%</span>
        </div>
        <Progress value={73} className="h-3 [&>div]:bg-primary [&>div]:progress-bar-striped rounded-full overflow-hidden" />
      </div>
    </div>
  ),
};

export const VotingProgress: Story = {
  render: () => (
    <div className="space-y-4 w-full max-w-md">
      {[
        { name: 'Candidate A', pct: 45, color: 'bg-emerald' },
        { name: 'Candidate B', pct: 32, color: 'bg-cyan' },
        { name: 'Candidate C', pct: 23, color: 'bg-violet' },
      ].map((c) => (
        <div key={c.name}>
          <div className="flex justify-between mb-1">
            <span className="text-sm font-medium">{c.name}</span>
            <span className="text-sm text-muted-foreground">{c.pct}%</span>
          </div>
          <Progress value={c.pct} className="h-2 [&>[data-slot=progress-indicator]]:" />
        </div>
      ))}
    </div>
  ),
};
