import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import {
  DashboardSkeleton,
  KpiCardSkeleton,
  ActionCardSkeleton,
  FeedSkeleton,
  TableSkeleton,
  CardGridSkeleton,
  MapSkeleton,
  FormSkeleton,
  ChartSkeleton,
  ListDetailSkeleton,
} from './dashboard-skeleton';

const meta = {
  title: 'Dashboard/Skeletons',
  tags: ['autodocs'],
};
export default meta;

type CardStory = StoryObj;

export const KPICard: CardStory = {
  render: () => (
    <div className="max-w-[200px]">
      <KpiCardSkeleton />
    </div>
  ),
};

export const ActionCard: CardStory = {
  render: () => (
    <div className="max-w-[200px]">
      <ActionCardSkeleton />
    </div>
  ),
};

export const Feed: CardStory = {
  render: () => (
    <div className="h-80 w-full max-w-md">
      <FeedSkeleton />
    </div>
  ),
};

export const Table: CardStory = {
  render: () => (
    <div className="w-full max-w-lg">
      <TableSkeleton rows={5} cols={4} />
    </div>
  ),
};

export const CardGrid: CardStory = {
  render: () => (
    <div className="w-full">
      <CardGridSkeleton cols={2} rows={2} />
    </div>
  ),
};

export const Map: CardStory = {
  render: () => (
    <div className="h-64 w-full">
      <MapSkeleton />
    </div>
  ),
};

export const Form: CardStory = {
  render: () => <FormSkeleton />,
};

export const Chart: CardStory = {
  render: () => <ChartSkeleton />,
};

export const ListDetail: CardStory = {
  render: () => (
    <div className="h-80 w-full">
      <ListDetailSkeleton />
    </div>
  ),
};

export const FullDashboard: CardStory = {
  render: () => (
    <div className="h-[600px] w-full">
      <DashboardSkeleton />
    </div>
  ),
};
