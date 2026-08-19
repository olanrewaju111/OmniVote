/**
 * FieldSafety component — unit tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FieldSafety } from '@/components/dashboard/field-safety';

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

const createQueryReturn = (overrides: Record<string, unknown> = {}) => ({
  data: undefined,
  isLoading: true,
  isError: false,
  error: null,
  isFetching: false,
  isPending: true,
  isSuccess: false,
  isRefetching: false,
  refetch: vi.fn(),
  ...overrides,
});

let _queryOverrides: Record<string, unknown> = { isLoading: true };

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(() => createQueryReturn(_queryOverrides)),
  useMutation: vi.fn(() => ({
    mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false, isError: false, error: null,
  })),
  useQueryClient: vi.fn(() => ({ invalidateQueries: vi.fn(), setQueryData: vi.fn() })),
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

vi.mock('framer-motion', () => ({
  m: {
    div: (props: Record<string, unknown>) => <div {...props} />,
    span: (props: Record<string, unknown>) => <span {...props} />,
    button: (props: Record<string, unknown>) => <button {...props} />,
    aside: (props: Record<string, unknown>) => <aside {...props} />,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/lib/api', () => ({ fetchJson: vi.fn() }));

vi.mock('lucide-react', () => {
  const icons = [
    'MapPin', 'ShieldAlert', 'Radio', 'Clock', 'Users', 'CheckCircle2',
    'AlertTriangle', 'AlertCircle', 'Wifi', 'WifiOff', 'Battery', 'BatteryLow', 'BatteryWarning',
    'BatteryFull', 'Satellite', 'Loader2', 'Plus', 'Eye', 'Activity',
    'Signal', 'Zap', 'Shield',
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

import { useQuery } from '@tanstack/react-query';
const mockedUseQuery = vi.mocked(useQuery);

const mockFieldSafetyData = {
  zones: [
    {
      id: 'z1', name: 'Ikeja PU-01', state: 'Lagos', lga: 'Ikeja',
      centerLat: 6.52, centerLng: 3.38, radiusMeters: 500,
      pollingUnitIds: ['pu1'], assignedAgentIds: ['a1'],
      isActive: true, checkInIntervalMin: 60, maxMissedCheckIns: 3, createdAt: '2025-01-01T00:00:00Z',
    },
  ],
  switches: [],
  agentSafety: [
    {
      id: 'a1', name: 'Agent One', isOnline: true, lastSeenAt: '2025-01-15T10:00:00Z',
      isLocked: false, biometricRiskScore: 10, deviceTrustScore: 90,
      hasActiveSwitch: false, switchEscalation: 0, isOverdue: false,
      lastCheckInAt: '2025-01-15T10:00:00Z', lastCheckInStatus: 'CHECKED_IN',
    },
  ],
  checkIns: [
    {
      id: 'ci1', agentId: 'a1', geofenceZoneId: 'z1', status: 'CHECKED_IN',
      latitude: 6.52, longitude: 3.38, isInsideZone: true,
      batteryLevel: 85, networkType: '4G', accuracyMeters: 10, notes: null,
      checkedInAt: '2025-01-15T10:00:00Z', checkedOutAt: null,
      agentName: 'Agent One', zoneName: 'Ikeja PU-01',
    },
  ],
  counts: { totalFieldAgents: 1, activeZones: 1, activeSwitches: 0, sosActive: 0, atRisk: 0 },
};

describe('FieldSafety', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _queryOverrides = { isLoading: true };
  });

  it('renders without crashing', () => {
    mockedUseQuery.mockReturnValue(createQueryReturn({ isLoading: true, data: undefined }) as ReturnType<typeof useQuery>);
    render(<FieldSafety />);
    // Just loading spinner
  });

  it('shows loading state', () => {
    mockedUseQuery.mockReturnValue(createQueryReturn({ isLoading: true, data: undefined }) as ReturnType<typeof useQuery>);
    render(<FieldSafety />);
    // The component shows a Loader2 spinner (no text, just the icon)
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('shows loading state when data is undefined (even if isError is true, loading guard runs first)', () => {
    // The component checks `if (isLoading || !data)` before `isError`,
    // so when data is undefined, the loading spinner renders regardless of isError.
    mockedUseQuery.mockReturnValue(createQueryReturn({ isLoading: false, isError: true, data: undefined }) as ReturnType<typeof useQuery>);
    render(<FieldSafety />);
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('renders heading when data is loaded', () => {
    mockedUseQuery.mockReturnValue(createQueryReturn({ isLoading: false, data: mockFieldSafetyData }) as ReturnType<typeof useQuery>);
    render(<FieldSafety />);
    expect(screen.getByText('Field Safety')).toBeInTheDocument();
  });

  it('renders tab triggers when data is loaded', () => {
    mockedUseQuery.mockReturnValue(createQueryReturn({ isLoading: false, data: mockFieldSafetyData }) as ReturnType<typeof useQuery>);
    render(<FieldSafety />);
    expect(screen.getByRole('tab', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Geofence Zones' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Agent Roster' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Check-in Log' })).toBeInTheDocument();
  });

  it('renders agent and zone counts in header', () => {
    mockedUseQuery.mockReturnValue(createQueryReturn({ isLoading: false, data: mockFieldSafetyData }) as ReturnType<typeof useQuery>);
    render(<FieldSafety />);
    expect(screen.getByText(/1 field agents/)).toBeInTheDocument();
    expect(screen.getByText(/1 zones/)).toBeInTheDocument();
  });

  it('renders dashboard tab content with KPI labels when data is loaded', () => {
    mockedUseQuery.mockReturnValue(createQueryReturn({ isLoading: false, data: mockFieldSafetyData }) as ReturnType<typeof useQuery>);
    render(<FieldSafety />);
    // Dashboard tab is the default active tab
    expect(screen.getByText('Active Zones')).toBeInTheDocument();
    expect(screen.getByText('Agents Checked In')).toBeInTheDocument();
    expect(screen.getByText('Overdue Switches')).toBeInTheDocument();
    expect(screen.getByText('SOS Alerts')).toBeInTheDocument();
    expect(screen.getByText('Escalated Cases')).toBeInTheDocument();
  });

  it('renders map placeholder text on dashboard tab', () => {
    mockedUseQuery.mockReturnValue(createQueryReturn({ isLoading: false, data: mockFieldSafetyData }) as ReturnType<typeof useQuery>);
    render(<FieldSafety />);
    expect(screen.getByText('Agent positions will appear on the map tab')).toBeInTheDocument();
  });
});
