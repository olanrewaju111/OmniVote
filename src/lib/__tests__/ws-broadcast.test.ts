/**
 * Tests for ws-broadcast module.
 */
import { broadcastEvent, broadcastIncident, broadcastAlert, broadcastPvt, broadcastChat, broadcastDashboard, broadcastWebVitals } from '@/lib/ws-broadcast';

describe('ws-broadcast', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('broadcastEvent should POST to WS_INTERNAL_URL', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true });

    await broadcastEvent({
      type: 'incident',
      action: 'new',
      data: { id: '1' },
      tenantId: 'tenant-1',
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, options] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toContain('localhost:3003/broadcast');
    expect(options.method).toBe('POST');
    expect(options.headers['Content-Type']).toBe('application/json');
    expect(options.headers['X-Internal-Secret']).toBeDefined();

    const body = JSON.parse(options.body);
    expect(body.type).toBe('incident');
    expect(body.action).toBe('new');
    expect(body.tenantId).toBe('tenant-1');
  });

  it('broadcastEvent should silently catch errors', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('WS server not running'));

    // Should not throw
    await broadcastEvent({
      type: 'incident',
      action: 'new',
      data: {},
      tenantId: 'tenant-1',
    });
  });

  it('broadcastEvent should silently catch abort errors', async () => {
    global.fetch = vi.fn().mockRejectedValue(new DOMException('Aborted', 'AbortError'));

    await broadcastEvent({
      type: 'incident',
      action: 'new',
      data: {},
      tenantId: 'tenant-1',
    });

    // Should not throw
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('broadcastIncident should use type=incident', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true });
    await broadcastIncident('t1', 'new', { id: '1' });
    const body = JSON.parse((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body.type).toBe('incident');
    expect(body.action).toBe('new');
  });

  it('broadcastAlert should use type=alert', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true });
    await broadcastAlert('t1', 'triggered', { id: '1' });
    const body = JSON.parse((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body.type).toBe('alert');
  });

  it('broadcastPvt should use type=pvt', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true });
    await broadcastPvt('t1', 'new', { count: 5 });
    const body = JSON.parse((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body.type).toBe('pvt');
  });

  it('broadcastChat should use type=chat', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true });
    await broadcastChat('t1', 'new_message', { body: 'hi' });
    const body = JSON.parse((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body.type).toBe('chat');
  });

  it('broadcastDashboard should use type=dashboard, action=kpi_update', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true });
    await broadcastDashboard('t1', { kpi: 42 });
    const body = JSON.parse((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body.type).toBe('dashboard');
    expect(body.action).toBe('kpi_update');
  });

  it('broadcastWebVitals should use type=web-vitals, action=update', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true });
    await broadcastWebVitals('t1', {
      stats: {},
      healthScore: 95,
      anomalies: [],
      anomalyCounts: { total: 0, warning: 0, critical: 0 },
      totalEvents: 42,
      budgetCompliance: {},
      routes: ['/dashboard'],
      bufferUtilization: 0.1,
    });
    const body = JSON.parse((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body.type).toBe('web-vitals');
    expect(body.action).toBe('update');
    expect(body.data.healthScore).toBe(95);
    expect(body.data.totalEvents).toBe(42);
  });
});
