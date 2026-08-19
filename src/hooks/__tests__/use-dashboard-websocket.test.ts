/**
 * Tests for useDashboardWebSocket hook.
 */
import { renderHook, act } from '@testing-library/react';

// ── Hoisted mock values (accessible inside vi.mock factories) ──

const {
  mockSend,
  getCapturedHandlers,
  setCapturedHandlers,
  getCapturedOnConnectionChange,
  setCapturedOnConnectionChange,
  getMockWsConnected,
  setMockWsConnected,
  getMockWsTransport,
  setMockWsTransport,
  getMockOnlineCount,
  setMockOnlineCount,
} = vi.hoisted(() => {
  const mockSend = vi.fn();
  let capturedHandlers: Record<string, (event: unknown) => void> = {};
  let capturedOnConnectionChange: ((connected: boolean, transport: string) => void) | undefined;
  let mockWsConnected = false;
  let mockWsTransport: 'ws' | 'sse' | 'none' = 'none';
  let mockOnlineCount = 0;
  return {
    mockSend,
    getCapturedHandlers: () => capturedHandlers,
    setCapturedHandlers: (h: typeof capturedHandlers) => { capturedHandlers = h; },
    getCapturedOnConnectionChange: () => capturedOnConnectionChange,
    setCapturedOnConnectionChange: (cb: typeof capturedOnConnectionChange) => { capturedOnConnectionChange = cb; },
    getMockWsConnected: () => mockWsConnected,
    setMockWsConnected: (v: boolean) => { mockWsConnected = v; },
    getMockWsTransport: () => mockWsTransport,
    setMockWsTransport: (v: 'ws' | 'sse' | 'none') => { mockWsTransport = v; },
    getMockOnlineCount: () => mockOnlineCount,
    setMockOnlineCount: (v: number) => { mockOnlineCount = v; },
  };
});

const { mockToast, mockSetSelectedTab, mockSetWsConnected, mockSetSseConnected, mockSetWsOnlineCount, mockInvalidateQueries } = vi.hoisted(() => {
  const mockToast = { warning: vi.fn(), error: vi.fn(), success: vi.fn(), info: vi.fn() };
  const mockSetSelectedTab = vi.fn();
  const mockSetWsConnected = vi.fn();
  const mockSetSseConnected = vi.fn();
  const mockSetWsOnlineCount = vi.fn();
  const mockInvalidateQueries = vi.fn();
  return { mockToast, mockSetSelectedTab, mockSetWsConnected, mockSetSseConnected, mockSetWsOnlineCount, mockInvalidateQueries };
});

// ── Mocks ──

vi.mock('@/hooks/use-websocket', () => ({
  useWebSocket: vi.fn(() => {
    // We need to capture handlers in a way that doesn't use top-level vars.
    // Since the factory is re-executed per test file, use the hoisted getters/setters
    return {
      connected: getMockWsConnected(),
      transport: getMockWsTransport(),
      onlineCount: getMockOnlineCount(),
      send: mockSend,
    };
  }),
}));

// We need to capture the options passed to useWebSocket. Let's use a different approach -
// override the mock implementation after import.

vi.mock('@/hooks/use-sse', () => ({
  useSSE: vi.fn(),
}));

vi.mock('@/store/dashboard', () => ({
  useDashboardStore: vi.fn(() => ({
    setSelectedTab: mockSetSelectedTab,
    setWsConnected: mockSetWsConnected,
    setSseConnected: mockSetSseConnected,
    setWsOnlineCount: mockSetWsOnlineCount,
  })),
}));

vi.mock('sonner', () => ({
  toast: mockToast,
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: vi.fn(() => ({
    invalidateQueries: mockInvalidateQueries,
  })),
}));

// Import after mocks
import { useDashboardWebSocket } from '@/hooks/use-dashboard-websocket';
import { useWebSocket } from '@/hooks/use-websocket';
import { useSSE } from '@/hooks/use-sse';
import type { Incident } from '@/types/dashboard';

type WsEventLike = { type: string; action: string; data: unknown; tenantId: string; timestamp: string };

// Will hold captured values from the useWebSocket mock
let capturedHandlers: Record<string, (event: WsEventLike) => void> = {};
let capturedOnConnectionChange: ((connected: boolean, transport: 'ws' | 'sse' | 'none') => void) | undefined;

function makeIncident(overrides: Partial<Incident> = {}): Incident {
  return {
    id: 'inc-1',
    type: 'VIOLENCE',
    severity: 'CRITICAL',
    status: 'PENDING',
    description: 'Test incident',
    gpsLat: null,
    gpsLng: null,
    gpsAnomaly: false,
    aiSummary: null,
    aiFlags: [],
    isQuarantined: false,
    c2paVerified: false,
    submittedAt: '2025-01-01T00:00:00Z',
    reviewedAt: null,
    reporter: null,
    pollingUnit: null,
    ...overrides,
  };
}

function makeWsEvent(type: string, action: string, data: unknown): WsEventLike {
  return { type, action, data, tenantId: 'tenant-1', timestamp: '2025-01-01T00:00:00Z' };
}

describe('useDashboardWebSocket', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    setMockWsConnected(false);
    setMockWsTransport('none');
    setMockOnlineCount(0);
    capturedHandlers = {};
    capturedOnConnectionChange = undefined;

    // Override the useWebSocket mock to capture handlers
    vi.mocked(useWebSocket).mockImplementation((
      _tenantId: string | null,
      options: {
        handlers: Record<string, (event: unknown) => void>;
        enabled: boolean;
        onConnectionChange?: (connected: boolean, transport: 'ws' | 'sse' | 'none') => void;
      }
    ) => {
      capturedHandlers = options.handlers as Record<string, (event: WsEventLike) => void>;
      capturedOnConnectionChange = options.onConnectionChange;
      return {
        connected: getMockWsConnected(),
        transport: getMockWsTransport(),
        onlineCount: getMockOnlineCount(),
        send: mockSend,
      };
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── 1. Default state when disabled ──
  it('should return default state when disabled (enabled=false)', () => {
    const { result } = renderHook(() =>
      useDashboardWebSocket({ tenantId: 'tenant-1', enabled: false })
    );

    expect(result.current.liveIncidents).toEqual([]);
    expect(result.current.livePvtCount).toBe(0);
    expect(result.current.wsConnected).toBe(false);
    expect(result.current.wsTransport).toBe('none');
    expect(result.current.onlineCount).toBe(0);
  });

  // ── 2. Default state when no tenantId ──
  it('should return default state when no tenantId (tenantId="")', () => {
    const { result } = renderHook(() =>
      useDashboardWebSocket({ tenantId: '', enabled: true })
    );

    expect(result.current.liveIncidents).toEqual([]);
    expect(result.current.livePvtCount).toBe(0);
    expect(result.current.wsConnected).toBe(false);
    expect(result.current.wsTransport).toBe('none');
    expect(result.current.onlineCount).toBe(0);
  });

  // ── 3. Initializes with empty liveIncidents array and 0 pvtCount ──
  it('should initialize with empty liveIncidents array and 0 pvtCount', () => {
    const { result } = renderHook(() =>
      useDashboardWebSocket({ tenantId: 'tenant-1', enabled: true })
    );

    expect(result.current.liveIncidents).toEqual([]);
    expect(result.current.livePvtCount).toBe(0);
  });

  // ── 4. Calls useWebSocket with tenantId when enabled ──
  it('should call useWebSocket with tenantId when enabled', () => {
    renderHook(() =>
      useDashboardWebSocket({ tenantId: 'tenant-1', enabled: true })
    );

    expect(useWebSocket).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({ enabled: true })
    );
  });

  it('should call useWebSocket with null when tenantId is empty', () => {
    renderHook(() =>
      useDashboardWebSocket({ tenantId: '', enabled: true })
    );

    expect(useWebSocket).toHaveBeenCalledWith(
      null,
      expect.objectContaining({ enabled: true })
    );
  });

  // ── 5. Falls back to SSE when WS transport is not 'ws' ──
  it('should enable SSE when WS transport is not ws', () => {
    setMockWsTransport('none');
    renderHook(() =>
      useDashboardWebSocket({ tenantId: 'tenant-1', enabled: true })
    );

    expect(useSSE).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({ enabled: true })
    );
  });

  it('should not enable SSE when WS transport is ws', () => {
    setMockWsTransport('ws');
    renderHook(() =>
      useDashboardWebSocket({ tenantId: 'tenant-1', enabled: true })
    );

    expect(useSSE).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({ enabled: false })
    );
  });

  // ── 6. Toast debouncing: severity-based toast cooldown ──
  describe('toast debouncing', () => {
    it('should show toast for CRITICAL incidents via WS', () => {
      renderHook(() =>
        useDashboardWebSocket({ tenantId: 'tenant-1', enabled: true })
      );

      const incident = makeIncident({ id: 'inc-crit', severity: 'CRITICAL', type: 'VIOLENCE' });
      act(() => {
        capturedHandlers['incident:new']?.(makeWsEvent('incident', 'new', { incidents: [incident], count: 1 }));
      });

      expect(mockToast.warning).toHaveBeenCalledTimes(1);
      expect(mockToast.warning).toHaveBeenCalledWith(
        'CRITICAL: VIOLENCE',
        expect.objectContaining({
          description: 'Test incident',
          duration: 8000,
        })
      );
    });

    it('should show toast for HIGH incidents via WS', () => {
      renderHook(() =>
        useDashboardWebSocket({ tenantId: 'tenant-1', enabled: true })
      );

      const incident = makeIncident({ id: 'inc-high', severity: 'HIGH', type: 'BALLOT_STUFFING' });
      act(() => {
        capturedHandlers['incident:new']?.(makeWsEvent('incident', 'new', { incidents: [incident], count: 1 }));
      });

      expect(mockToast.warning).toHaveBeenCalledWith(
        'HIGH: BALLOT STUFFING',
        expect.any(Object)
      );
    });

    it('should not show toast for LOW severity incidents', () => {
      renderHook(() =>
        useDashboardWebSocket({ tenantId: 'tenant-1', enabled: true })
      );

      const incident = makeIncident({ id: 'inc-low', severity: 'LOW', type: 'INFO' });
      act(() => {
        capturedHandlers['incident:new']?.(makeWsEvent('incident', 'new', { incidents: [incident], count: 1 }));
      });

      expect(mockToast.warning).not.toHaveBeenCalled();
    });

    it('should debounce CRITICAL incident toasts (5s cooldown)', () => {
      renderHook(() =>
        useDashboardWebSocket({ tenantId: 'tenant-1', enabled: true })
      );

      const incident = makeIncident({ id: 'inc-c1', severity: 'CRITICAL', type: 'VIOLENCE' });
      const incident2 = makeIncident({ id: 'inc-c2', severity: 'CRITICAL', type: 'VIOLENCE' });

      // First toast
      act(() => {
        capturedHandlers['incident:new']?.(makeWsEvent('incident', 'new', { incidents: [incident], count: 1 }));
      });
      expect(mockToast.warning).toHaveBeenCalledTimes(1);

      // Second toast within 5s — should be debounced
      act(() => {
        capturedHandlers['incident:new']?.(makeWsEvent('incident', 'new', { incidents: [incident2], count: 1 }));
      });
      expect(mockToast.warning).toHaveBeenCalledTimes(1);

      // Advance past 5s cooldown
      act(() => {
        vi.advanceTimersByTime(6000);
      });

      // Third toast after cooldown
      const incident3 = makeIncident({ id: 'inc-c3', severity: 'CRITICAL', type: 'VIOLENCE' });
      act(() => {
        capturedHandlers['incident:new']?.(makeWsEvent('incident', 'new', { incidents: [incident3], count: 1 }));
      });
      expect(mockToast.warning).toHaveBeenCalledTimes(2);
    });

    it('should show toast for CRITICAL alerts with 8s cooldown', () => {
      renderHook(() =>
        useDashboardWebSocket({ tenantId: 'tenant-1', enabled: true })
      );

      const alert = { category: 'CRITICAL', type: 'SECURITY_BREACH', title: 'Breach detected' };

      act(() => {
        capturedHandlers['alert:new']?.(makeWsEvent('alert', 'new', { alerts: [alert], count: 1 }));
      });

      expect(mockToast.error).toHaveBeenCalledTimes(1);
      expect(mockToast.error).toHaveBeenCalledWith(
        'Critical SECURITY BREACH',
        expect.objectContaining({
          description: 'Breach detected',
          duration: 10000,
        })
      );

      // Second alert within 8s — debounced
      const alert2 = { category: 'CRITICAL', type: 'SECURITY_BREACH', title: 'Another breach' };
      act(() => {
        capturedHandlers['alert:new']?.(makeWsEvent('alert', 'new', { alerts: [alert2], count: 1 }));
      });
      expect(mockToast.error).toHaveBeenCalledTimes(1);

      // Advance past 8s
      act(() => {
        vi.advanceTimersByTime(9000);
      });

      const alert3 = { category: 'CRITICAL', type: 'SECURITY_BREACH', title: 'Yet another' };
      act(() => {
        capturedHandlers['alert:new']?.(makeWsEvent('alert', 'new', { alerts: [alert3], count: 1 }));
      });
      expect(mockToast.error).toHaveBeenCalledTimes(2);
    });

    it('should not show toast for non-CRITICAL alerts', () => {
      renderHook(() =>
        useDashboardWebSocket({ tenantId: 'tenant-1', enabled: true })
      );

      const alert = { category: 'WARNING', type: 'DELAY', title: 'Minor delay' };
      act(() => {
        capturedHandlers['alert:new']?.(makeWsEvent('alert', 'new', { alerts: [alert], count: 1 }));
      });

      expect(mockToast.error).not.toHaveBeenCalled();
    });
  });

  // ── 7. liveIncidents state management ──
  describe('liveIncidents state management', () => {
    it('should add new incidents to liveIncidents', () => {
      const { result } = renderHook(() =>
        useDashboardWebSocket({ tenantId: 'tenant-1', enabled: true })
      );

      const incident = makeIncident({ id: 'inc-1' });
      act(() => {
        capturedHandlers['incident:new']?.(makeWsEvent('incident', 'new', { incidents: [incident], count: 1 }));
      });

      expect(result.current.liveIncidents).toHaveLength(1);
      expect(result.current.liveIncidents[0].id).toBe('inc-1');
    });

    it('should deduplicate incidents by id', () => {
      const { result } = renderHook(() =>
        useDashboardWebSocket({ tenantId: 'tenant-1', enabled: true })
      );

      const incident = makeIncident({ id: 'inc-dupe' });

      act(() => {
        capturedHandlers['incident:new']?.(makeWsEvent('incident', 'new', { incidents: [incident], count: 1 }));
      });
      expect(result.current.liveIncidents).toHaveLength(1);

      // Send the same incident again
      act(() => {
        capturedHandlers['incident:new']?.(makeWsEvent('incident', 'new', { incidents: [incident], count: 1 }));
      });
      expect(result.current.liveIncidents).toHaveLength(1);
    });

    it('should cap liveIncidents at 100', () => {
      const { result } = renderHook(() =>
        useDashboardWebSocket({ tenantId: 'tenant-1', enabled: true })
      );

      // Send 105 incidents at once
      const incidents = Array.from({ length: 105 }, (_, i) => makeIncident({ id: `inc-${i}` }));

      act(() => {
        capturedHandlers['incident:new']?.(makeWsEvent('incident', 'new', { incidents, count: 105 }));
      });

      expect(result.current.liveIncidents).toHaveLength(100);
    });

    it('should prepend new incidents (newest first)', () => {
      const { result } = renderHook(() =>
        useDashboardWebSocket({ tenantId: 'tenant-1', enabled: true })
      );

      const incident1 = makeIncident({ id: 'inc-old' });
      const incident2 = makeIncident({ id: 'inc-new' });

      act(() => {
        capturedHandlers['incident:new']?.(makeWsEvent('incident', 'new', { incidents: [incident1], count: 1 }));
      });
      act(() => {
        capturedHandlers['incident:new']?.(makeWsEvent('incident', 'new', { incidents: [incident2], count: 1 }));
      });

      expect(result.current.liveIncidents[0].id).toBe('inc-new');
      expect(result.current.liveIncidents[1].id).toBe('inc-old');
    });

    it('should not add incidents when incidents array is empty', () => {
      const { result } = renderHook(() =>
        useDashboardWebSocket({ tenantId: 'tenant-1', enabled: true })
      );

      act(() => {
        capturedHandlers['incident:new']?.(makeWsEvent('incident', 'new', { incidents: [], count: 0 }));
      });

      expect(result.current.liveIncidents).toHaveLength(0);
      expect(mockInvalidateQueries).not.toHaveBeenCalled();
    });
  });

  // ── 8. livePvtCount increments by results.length on pvt:new event ──
  describe('pvt:new event handling', () => {
    it('should increment livePvtCount by results.length', () => {
      const { result } = renderHook(() =>
        useDashboardWebSocket({ tenantId: 'tenant-1', enabled: true })
      );

      expect(result.current.livePvtCount).toBe(0);

      act(() => {
        capturedHandlers['pvt:new']?.(makeWsEvent('pvt', 'new', { results: [{ id: '1' }, { id: '2' }, { id: '3' }], count: 3 }));
      });

      expect(result.current.livePvtCount).toBe(3);

      act(() => {
        capturedHandlers['pvt:new']?.(makeWsEvent('pvt', 'new', { results: [{ id: '4' }], count: 1 }));
      });

      expect(result.current.livePvtCount).toBe(4);
    });

    it('should invalidate pvt query on pvt:new', () => {
      renderHook(() =>
        useDashboardWebSocket({ tenantId: 'tenant-1', enabled: true })
      );

      act(() => {
        capturedHandlers['pvt:new']?.(makeWsEvent('pvt', 'new', { results: [{}], count: 1 }));
      });

      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['pvt'] });
    });
  });

  // ── 9. Chat messages from other users invalidate query cache ──
  describe('chat:new_message event', () => {
    it('should invalidate chat query for messages from other users', () => {
      renderHook(() =>
        useDashboardWebSocket({ tenantId: 'tenant-1', enabled: true, userId: 'user-1' })
      );

      act(() => {
        capturedHandlers['chat:new_message']?.(makeWsEvent('chat', 'new_message', {
          id: 'msg-1',
          senderId: 'user-2',
          senderName: 'Other',
          body: 'Hello',
        }));
      });

      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['chat'] });
    });

    it('should not invalidate chat query for own messages', () => {
      renderHook(() =>
        useDashboardWebSocket({ tenantId: 'tenant-1', enabled: true, userId: 'user-1' })
      );

      act(() => {
        capturedHandlers['chat:new_message']?.(makeWsEvent('chat', 'new_message', {
          id: 'msg-2',
          senderId: 'user-1',
          senderName: 'Me',
          body: 'Hello',
        }));
      });

      expect(mockInvalidateQueries).not.toHaveBeenCalledWith({ queryKey: ['chat'] });
    });

    it('should invalidate chat query when userId is undefined', () => {
      renderHook(() =>
        useDashboardWebSocket({ tenantId: 'tenant-1', enabled: true })
      );

      act(() => {
        capturedHandlers['chat:new_message']?.(makeWsEvent('chat', 'new_message', {
          id: 'msg-3',
          senderId: 'user-2',
          senderName: 'Other',
          body: 'Hello',
        }));
      });

      // When userId is undefined, senderId ('user-2') !== undefined, so it should invalidate
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['chat'] });
    });
  });

  // ── 10. OSINT and dashboard:kpi_update events invalidate their query keys ──
  it('should invalidate osint query on osint:new event', () => {
    renderHook(() =>
      useDashboardWebSocket({ tenantId: 'tenant-1', enabled: true })
    );

    act(() => {
      capturedHandlers['osint:new']?.(makeWsEvent('osint', 'new', { url: 'http://example.com' }));
    });

    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['osint'] });
  });

  it('should invalidate dashboard query on dashboard:kpi_update event', () => {
    renderHook(() =>
      useDashboardWebSocket({ tenantId: 'tenant-1', enabled: true })
    );

    act(() => {
      capturedHandlers['dashboard:kpi_update']?.(makeWsEvent('dashboard', 'kpi_update', { kpis: {} }));
    });

    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['dashboard'] });
  });

  // ── 11. Store sync: setWsConnected and setWsOnlineCount are called ──
  describe('store sync', () => {
    it('should call setWsOnlineCount with onlineCount from WS', () => {
      setMockOnlineCount(42);
      renderHook(() =>
        useDashboardWebSocket({ tenantId: 'tenant-1', enabled: true })
      );

      expect(mockSetWsOnlineCount).toHaveBeenCalledWith(42);
    });

    it('should call setWsConnected when WS connection change fires', () => {
      renderHook(() =>
        useDashboardWebSocket({ tenantId: 'tenant-1', enabled: true })
      );

      expect(capturedOnConnectionChange).toBeDefined();

      act(() => {
        capturedOnConnectionChange?.(true, 'ws');
      });

      expect(mockSetWsConnected).toHaveBeenCalledWith(true, 'ws');
    });

    // ── 12. Connection change callback updates store ──
    it('should update store on disconnection', () => {
      renderHook(() =>
        useDashboardWebSocket({ tenantId: 'tenant-1', enabled: true })
      );

      act(() => {
        capturedOnConnectionChange?.(false, 'none');
      });

      expect(mockSetWsConnected).toHaveBeenCalledWith(false, 'none');
    });
  });

  // ── SSE handler tests ──
  describe('SSE handlers', () => {
    it('should invalidate incidents and dashboard queries on SSE incidents event', () => {
      renderHook(() =>
        useDashboardWebSocket({ tenantId: 'tenant-1', enabled: true })
      );

      const sseCall = vi.mocked(useSSE).mock.calls[0];
      const sseHandlers = sseCall[1].handlers;

      act(() => {
        sseHandlers.incidents({
          incidents: [{ severity: 'LOW', type: 'INFO', description: 'test' }],
          count: 1,
        });
      });

      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['incidents'] });
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['dashboard'] });
    });

    it('should show toast for CRITICAL incidents via SSE', () => {
      renderHook(() =>
        useDashboardWebSocket({ tenantId: 'tenant-1', enabled: true })
      );

      const sseCall = vi.mocked(useSSE).mock.calls[0];
      const sseHandlers = sseCall[1].handlers;

      act(() => {
        sseHandlers.incidents({
          incidents: [{ severity: 'CRITICAL', type: 'VIOLENCE', description: 'SSE incident' }],
          count: 1,
        });
      });

      expect(mockToast.warning).toHaveBeenCalledWith(
        'CRITICAL: VIOLENCE',
        expect.objectContaining({ description: 'SSE incident' })
      );
    });

    it('should invalidate alerts and dashboard queries on SSE alerts event', () => {
      renderHook(() =>
        useDashboardWebSocket({ tenantId: 'tenant-1', enabled: true })
      );

      const sseCall = vi.mocked(useSSE).mock.calls[0];
      const sseHandlers = sseCall[1].handlers;

      act(() => {
        sseHandlers.alerts({
          alerts: [{ category: 'INFO', type: 'GENERAL', title: 'Info alert' }],
          count: 1,
        });
      });

      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['alerts'] });
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['dashboard'] });
    });

    it('should invalidate pvt query on SSE pvt event', () => {
      renderHook(() =>
        useDashboardWebSocket({ tenantId: 'tenant-1', enabled: true })
      );

      const sseCall = vi.mocked(useSSE).mock.calls[0];
      const sseHandlers = sseCall[1].handlers;

      act(() => {
        sseHandlers.pvt({});
      });

      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['pvt'] });
    });
  });

  // ── incident:new invalidates queries ──
  it('should invalidate incidents and dashboard queries on incident:new WS event', () => {
    renderHook(() =>
      useDashboardWebSocket({ tenantId: 'tenant-1', enabled: true })
    );

    const incident = makeIncident({ id: 'inc-q' });
    act(() => {
      capturedHandlers['incident:new']?.(makeWsEvent('incident', 'new', { incidents: [incident], count: 1 }));
    });

    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['incidents'] });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['dashboard'] });
  });

  // ── alert:new invalidates queries ──
  it('should invalidate alerts and dashboard queries on alert:new WS event', () => {
    renderHook(() =>
      useDashboardWebSocket({ tenantId: 'tenant-1', enabled: true })
    );

    act(() => {
      capturedHandlers['alert:new']?.(makeWsEvent('alert', 'new', {
        alerts: [{ category: 'WARNING', type: 'DELAY', title: 'test' }],
        count: 1,
      }));
    });

    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['alerts'] });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['dashboard'] });
  });

  // ── Toast action clicks setSelectedTab ──
  it('should call setSelectedTab when incident toast View is clicked', () => {
    renderHook(() =>
      useDashboardWebSocket({ tenantId: 'tenant-1', enabled: true })
    );

    const incident = makeIncident({ id: 'inc-toast', severity: 'CRITICAL', type: 'VIOLENCE' });
    act(() => {
      capturedHandlers['incident:new']?.(makeWsEvent('incident', 'new', { incidents: [incident], count: 1 }));
    });

    const toastCall = mockToast.warning.mock.calls[0];
    const action = toastCall[1]?.action;
    expect(action).toBeDefined();

    act(() => {
      action?.onClick?.();
    });

    expect(mockSetSelectedTab).toHaveBeenCalledWith('feed');
  });

  it('should call setSelectedTab("alerts") when alert toast View Alerts is clicked', () => {
    renderHook(() =>
      useDashboardWebSocket({ tenantId: 'tenant-1', enabled: true })
    );

    act(() => {
      capturedHandlers['alert:new']?.(makeWsEvent('alert', 'new', {
        alerts: [{ category: 'CRITICAL', type: 'SECURITY_BREACH', title: 'Breach' }],
        count: 1,
      }));
    });

    const toastCall = mockToast.error.mock.calls[0];
    const action = toastCall[1]?.action;
    expect(action).toBeDefined();

    act(() => {
      action?.onClick?.();
    });

    expect(mockSetSelectedTab).toHaveBeenCalledWith('alerts');
  });

  // ── SSE connection change ──
  it('should call setWsConnected(true, "sse") on SSE connect when WS is not ws', () => {
    setMockWsTransport('none');
    renderHook(() =>
      useDashboardWebSocket({ tenantId: 'tenant-1', enabled: true })
    );

    const sseCall = vi.mocked(useSSE).mock.calls[0];
    const sseOptions = sseCall[1];

    act(() => {
      sseOptions.onConnectionChange?.(true);
    });

    expect(mockSetWsConnected).toHaveBeenCalledWith(true, 'sse');
    expect(mockSetSseConnected).toHaveBeenCalledWith(true);
  });

  it('should not call setWsConnected on SSE connect when WS transport is ws', () => {
    setMockWsTransport('ws');
    renderHook(() =>
      useDashboardWebSocket({ tenantId: 'tenant-1', enabled: true })
    );

    const sseCall = vi.mocked(useSSE).mock.calls[0];
    const sseOptions = sseCall[1];

    act(() => {
      sseOptions.onConnectionChange?.(true);
    });

    // Should only call setSseConnected, not setWsConnected
    expect(mockSetWsConnected).not.toHaveBeenCalled();
    expect(mockSetSseConnected).toHaveBeenCalledWith(true);
  });

  // ── Presence handler does nothing ──
  it('should handle presence event without crashing', () => {
    renderHook(() =>
      useDashboardWebSocket({ tenantId: 'tenant-1', enabled: true })
    );

    act(() => {
      capturedHandlers['presence']?.(makeWsEvent('presence', 'update', { onlineCount: 10 }));
    });

    // No crash = pass, no queries invalidated
    expect(mockInvalidateQueries).not.toHaveBeenCalled();
  });
});
