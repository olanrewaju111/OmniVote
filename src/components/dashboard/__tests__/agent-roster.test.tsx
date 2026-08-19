/**
 * AgentRoster component — unit tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AgentRoster } from '@/components/dashboard/agent-roster';

// ── Mocks ──────────────────────────────────────────────────────────────
vi.mock('@/store/dashboard', () => {
  const state = {
    tenantId: 'tenant-1',
    user: { id: 'u1', name: 'Admin', role: 'TENANT_ADMIN', tenantId: 'tenant-1' },
    isAuthenticated: true,
  };
  return {
    useDashboardStore: (selector?: (s: typeof state) => unknown) =>
      selector ? selector(state) : state,
  };
});

vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => false }));

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(() => ({
    data: undefined, isLoading: true, isError: false, error: null,
    isFetching: false, isPending: true, isSuccess: false, isRefetching: false, refetch: vi.fn(),
  })),
  useMutation: vi.fn(() => ({
    mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false, isError: false, error: null, isSuccess: false,
  })),
  useQueryClient: vi.fn(() => ({ invalidateQueries: vi.fn(), setQueryData: vi.fn() })),
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

vi.mock('framer-motion', () => ({
  m: {
    div: (props: Record<string, unknown>) => <div {...props} />,
    tr: (props: Record<string, unknown>) => <tr {...props} />,
    button: (props: Record<string, unknown>) => <button {...props} />,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/lib/api', () => ({ fetchJson: vi.fn() }));

vi.mock('lucide-react', () => {
  const icons = [
    'Search', 'Users', 'UserCheck', 'UserX', 'Shield', 'ShieldAlert', 'Wrench',
    'Loader2', 'FileText', 'Trash2', 'Eye', 'ToggleLeft', 'X', 'Pencil',
    // Icons used internally by shadcn/ui components
    'XIcon', 'CheckIcon', 'ChevronDownIcon', 'ChevronUpIcon',
    'ChevronRightIcon', 'CircleIcon',
  ];
  const mod: Record<string, unknown> = {};
  for (const name of icons) {
    mod[name] = (props: Record<string, unknown>) => <span data-testid={`icon-${name}`} {...props} />;
  }
  return mod;
});

// Mock EmptyState since it's imported in agent-roster
vi.mock('@/components/dashboard/empty-state', () => ({
  EmptyState: ({ title, description }: { title: string; description: string }) => (
    <div data-testid="empty-state">
      <p>{title}</p>
      <p>{description}</p>
    </div>
  ),
}));

import { useQuery } from '@tanstack/react-query';
const mockedUseQuery = vi.mocked(useQuery);

const mockAgentsData = {
  users: [
    {
      id: 'a1', email: 'agent1@test.com', name: 'Agent One', role: 'FIELD_AGENT',
      isOnline: true, lastSeenAt: '2025-01-15T10:00:00Z', createdAt: '2025-01-01T00:00:00Z',
      _count: { incidents: 2, auditLogs: 5 },
    },
    {
      id: 'a2', email: 'agent2@test.com', name: 'Agent Two', role: 'ANALYST',
      isOnline: false, lastSeenAt: '2025-01-14T10:00:00Z', createdAt: '2025-01-01T00:00:00Z',
      _count: { incidents: 0, auditLogs: 3 },
    },
  ],
};

describe('AgentRoster', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    mockedUseQuery.mockReturnValue({
      data: mockAgentsData, isLoading: false, isError: false, error: null,
      isFetching: false, isPending: false, isSuccess: true, isRefetching: false, refetch: vi.fn(),
    } as ReturnType<typeof useQuery>);
    render(<AgentRoster />);
  });

  it('renders the main heading', () => {
    mockedUseQuery.mockReturnValue({
      data: mockAgentsData, isLoading: false, isError: false, error: null,
      isFetching: false, isPending: false, isSuccess: true, isRefetching: false, refetch: vi.fn(),
    } as ReturnType<typeof useQuery>);
    render(<AgentRoster />);
    expect(screen.getByText('Agent Roster')).toBeInTheDocument();
  });

  it('renders the subtitle', () => {
    mockedUseQuery.mockReturnValue({
      data: mockAgentsData, isLoading: false, isError: false, error: null,
      isFetching: false, isPending: false, isSuccess: true, isRefetching: false, refetch: vi.fn(),
    } as ReturnType<typeof useQuery>);
    render(<AgentRoster />);
    expect(screen.getByText('Manage field agents and organization users')).toBeInTheDocument();
  });

  it('renders Add Agent button', () => {
    mockedUseQuery.mockReturnValue({
      data: mockAgentsData, isLoading: false, isError: false, error: null,
      isFetching: false, isPending: false, isSuccess: true, isRefetching: false, refetch: vi.fn(),
    } as ReturnType<typeof useQuery>);
    render(<AgentRoster />);
    expect(screen.getByRole('button', { name: /add agent/i })).toBeInTheDocument();
  });

  it('renders summary cards', () => {
    mockedUseQuery.mockReturnValue({
      data: mockAgentsData, isLoading: false, isError: false, error: null,
      isFetching: false, isPending: false, isSuccess: true, isRefetching: false, refetch: vi.fn(),
    } as ReturnType<typeof useQuery>);
    render(<AgentRoster />);
    expect(screen.getByText('Total Agents')).toBeInTheDocument();
    expect(screen.getByText('Online Now')).toBeInTheDocument();
    // 'Offline' and 'All Users' text appear in the summary cards and table header
    expect(screen.getAllByText('Offline').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('All Users').length).toBeGreaterThanOrEqual(1);
  });

  it('shows loading spinner', () => {
    mockedUseQuery.mockReturnValue({
      data: undefined, isLoading: true, isError: false, error: null,
      isFetching: true, isPending: true, isSuccess: false, isRefetching: false, refetch: vi.fn(),
    } as ReturnType<typeof useQuery>);
    render(<AgentRoster />);
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('shows empty state when no agents', () => {
    mockedUseQuery.mockReturnValue({
      data: { users: [] }, isLoading: false, isError: false, error: null,
      isFetching: false, isPending: false, isSuccess: true, isRefetching: false, refetch: vi.fn(),
    } as ReturnType<typeof useQuery>);
    render(<AgentRoster />);
    expect(screen.getByText('No agents found')).toBeInTheDocument();
  });

  it('renders search input', () => {
    mockedUseQuery.mockReturnValue({
      data: mockAgentsData, isLoading: false, isError: false, error: null,
      isFetching: false, isPending: false, isSuccess: true, isRefetching: false, refetch: vi.fn(),
    } as ReturnType<typeof useQuery>);
    render(<AgentRoster />);
    expect(screen.getByPlaceholderText('Search agents...')).toBeInTheDocument();
  });

  it('renders agent names in the table', () => {
    mockedUseQuery.mockReturnValue({
      data: mockAgentsData, isLoading: false, isError: false, error: null,
      isFetching: false, isPending: false, isSuccess: true, isRefetching: false, refetch: vi.fn(),
    } as ReturnType<typeof useQuery>);
    render(<AgentRoster />);
    expect(screen.getByText('Agent One')).toBeInTheDocument();
    expect(screen.getByText('Agent Two')).toBeInTheDocument();
  });

  it('renders role filter badges', () => {
    mockedUseQuery.mockReturnValue({
      data: mockAgentsData, isLoading: false, isError: false, error: null,
      isFetching: false, isPending: false, isSuccess: true, isRefetching: false, refetch: vi.fn(),
    } as ReturnType<typeof useQuery>);
    render(<AgentRoster />);
    // Role counts are displayed as badges
    expect(screen.getByText(/FIELD AGENT: 1/i)).toBeInTheDocument();
    expect(screen.getByText(/ANALYST: 1/i)).toBeInTheDocument();
  });
});
