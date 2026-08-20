/**
 * SecurityCenter component — unit tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SecurityCenter } from '@/components/dashboard/security-center';

// ── Mocks ──────────────────────────────────────────────────────────────
vi.mock('@/store/dashboard', () => {
  const state = { tenantId: 'tenant-1', user: null, isAuthenticated: true };
  return {
    useDashboardStore: (selector?: (s: typeof state) => unknown) =>
      selector ? selector(state) : state,
  };
});

vi.mock('@tanstack/react-query', () => {
  let _queryData: unknown = null;
  const mockQuery = { data: _queryData, isLoading: false, isError: false, error: null };
  return {
    useQuery: vi.fn(({ queryKey }) => {
      // Default: return loading
      return { ...mockQuery, data: _queryData, isLoading: !_queryData, isError: false };
    }),
    useMutation: vi.fn(() => ({
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
      isSuccess: false,
    })),
    useQueryClient: vi.fn(() => ({
      invalidateQueries: vi.fn(),
      setQueryData: vi.fn(),
    })),
    __setSecurityData: (data: unknown) => { _queryData = data; },
  };
});

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock('framer-motion', () => ({
  m: {
    div: (props: Record<string, unknown>) => <div {...props} />,
    circle: (props: Record<string, unknown>) => <circle {...props} />,
    span: (props: Record<string, unknown>) => <span {...props} />,
    tr: (props: Record<string, unknown>) => <tr {...props} />,
    button: (props: Record<string, unknown>) => <button {...props} />,
    aside: (props: Record<string, unknown>) => <aside {...props} />,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/ui/virtualized-list', () => ({
  VirtualizedList: ({ children, items }: { children: (item: unknown, i: number) => React.ReactNode; items: unknown[] }) => (
    <div>{items.map((item, i) => children(item, i))}</div>
  ),
}));

vi.mock('@/lib/api', () => ({ fetchJson: vi.fn() }));

// Mock lucide-react icons as simple spans
vi.mock('lucide-react', () => {
  const icons = [
    'Shield', 'ShieldAlert', 'ShieldCheck', 'Lock', 'Key', 'Eye', 'Clock',
    'LogIn', 'Download', 'Fingerprint', 'Zap', 'Activity', 'User', 'Users',
    'CheckCircle2', 'XCircle', 'AlertTriangle', 'Info', 'Plus', 'Trash2',
    'ChevronDown', 'ChevronUp', 'Loader2', 'Settings', 'FileText',
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

// ── Mock Data ───────────────────────────────────────────────────────────
const mockSecurityData = {
  events: [
    {
      id: 'evt-1',
      eventType: 'LOGIN_SUCCESS',
      severity: 'INFO',
      userId: 'u1',
      ipAddress: '192.168.1.1',
      userAgent: 'Chrome',
      description: 'Successful login from admin',
      metadata: {},
      resolved: true,
      resolvedById: null,
      resolvedAt: null,
      createdAt: '2025-01-15T10:30:00Z',
    },
  ],
  counts: { total: 1, unresolved: 0, criticalUnresolved: 0, bySeverity: { INFO: 1 }, byType: { LOGIN_SUCCESS: 1 } },
  users: [
    {
      id: 'u1', name: 'Admin User', email: 'admin@test.com', role: 'TENANT_ADMIN',
      deviceTrustScore: 90, biometricRiskScore: 10, isLocked: false, lastSecurityAuditAt: '2025-01-15T10:00:00Z',
    },
  ],
  policies: {
    encryptionEnabled: true,
    twoFactorEnabled: true,
    sessionTimeoutMin: 30,
    ipWhitelist: ['10.0.0.1'],
    dataRetentionDays: 90,
    auditLogRetentionDays: 365,
  },
  securityScore: 85,
};

// We need to control the useQuery mock properly
import { useQuery } from '@tanstack/react-query';

const mockedUseQuery = vi.mocked(useQuery);

describe('SecurityCenter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    mockedUseQuery.mockReturnValue({
      data: undefined as unknown as typeof mockSecurityData,
      isLoading: true,
      isError: false,
      error: null,
      isFetching: false,
      isPending: true,
      isSuccess: false,
      isRefetching: false,
      refetch: vi.fn(),
    } as ReturnType<typeof useQuery>);
    render(<SecurityCenter />);
    expect(screen.getByText('Security Center')).toBeInTheDocument();
  });

  it('renders the main heading', () => {
    mockedUseQuery.mockReturnValue({
      data: mockSecurityData,
      isLoading: false,
      isError: false,
      error: null,
      isFetching: false,
      isPending: false,
      isSuccess: true,
      isRefetching: false,
      refetch: vi.fn(),
    } as ReturnType<typeof useQuery>);
    render(<SecurityCenter />);
    expect(screen.getByText('Security Center')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    mockedUseQuery.mockReturnValue({
      data: undefined as unknown as typeof mockSecurityData,
      isLoading: true,
      isError: false,
      error: null,
      isFetching: true,
      isPending: true,
      isSuccess: false,
      isRefetching: false,
      refetch: vi.fn(),
    } as ReturnType<typeof useQuery>);
    render(<SecurityCenter />);
    expect(screen.getByText('Loading security data...')).toBeInTheDocument();
  });

  it('shows error state', () => {
    mockedUseQuery.mockReturnValue({
      data: undefined as unknown as typeof mockSecurityData,
      isLoading: false,
      isError: true,
      error: new Error('fail'),
      isFetching: false,
      isPending: false,
      isSuccess: false,
      isRefetching: false,
      refetch: vi.fn(),
    } as ReturnType<typeof useQuery>);
    render(<SecurityCenter />);
    expect(screen.getByText('Failed to load security data')).toBeInTheDocument();
  });

  it('renders tab triggers when data is loaded', () => {
    mockedUseQuery.mockReturnValue({
      data: mockSecurityData,
      isLoading: false,
      isError: false,
      error: null,
      isFetching: false,
      isPending: false,
      isSuccess: true,
      isRefetching: false,
      refetch: vi.fn(),
    } as ReturnType<typeof useQuery>);
    render(<SecurityCenter />);
    expect(screen.getByRole('tab', { name: /overview/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /event log/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /users/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /policies/i })).toBeInTheDocument();
  });

  it('displays the security score badge when data is loaded', () => {
    mockedUseQuery.mockReturnValue({
      data: mockSecurityData,
      isLoading: false,
      isError: false,
      error: null,
      isFetching: false,
      isPending: false,
      isSuccess: true,
      isRefetching: false,
      refetch: vi.fn(),
    } as ReturnType<typeof useQuery>);
    render(<SecurityCenter />);
    expect(screen.getByText('Score: 85')).toBeInTheDocument();
  });

  it('renders KPI cards in overview tab', () => {
    mockedUseQuery.mockReturnValue({
      data: mockSecurityData,
      isLoading: false,
      isError: false,
      error: null,
      isFetching: false,
      isPending: false,
      isSuccess: true,
      isRefetching: false,
      refetch: vi.fn(),
    } as ReturnType<typeof useQuery>);
    render(<SecurityCenter />);
    expect(screen.getByText('Unresolved Events')).toBeInTheDocument();
    expect(screen.getByText('Critical Threats')).toBeInTheDocument();
    expect(screen.getByText('Locked Users')).toBeInTheDocument();
    expect(screen.getAllByText('Security Score').length).toBeGreaterThanOrEqual(2);
  });

  it('renders no content when neither loading nor data present', () => {
    mockedUseQuery.mockReturnValue({
      data: null as unknown as typeof mockSecurityData,
      isLoading: false,
      isError: false,
      error: null,
      isFetching: false,
      isPending: false,
      isSuccess: false,
      isRefetching: false,
      refetch: vi.fn(),
    } as ReturnType<typeof useQuery>);
    const { container } = render(<SecurityCenter />);
    // Header still renders but no tabs/content
    expect(screen.getByText('Security Center')).toBeInTheDocument();
    // No tabs should be present
    expect(container.querySelector('[role="tab"]')).not.toBeInTheDocument();
  });
});
