import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StructuredLogger } from '../log-aggregator';

describe('StructuredLogger', () => {
  let log: StructuredLogger;

  beforeEach(() => {
    vi.clearAllMocks();
    log = new StructuredLogger();
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'debug').mockImplementation(() => {});
  });

  it('info logs to console.info with structured JSON', () => {
    log.info('hello world');
    const calls = (console.info as ReturnType<typeof vi.spyOn>).mock.calls;
    expect(calls).toHaveLength(1);
    const parsed = JSON.parse(calls[0][0] as string);
    expect(parsed.level).toBe('info');
    expect(parsed.message).toBe('hello world');
    expect(parsed.timestamp).toBeTruthy();
  });

  it('warn logs to console.warn', () => {
    log.warn('something suspicious');
    const calls = (console.warn as ReturnType<typeof vi.spyOn>).mock.calls;
    expect(calls).toHaveLength(1);
    const parsed = JSON.parse(calls[0][0] as string);
    expect(parsed.level).toBe('warn');
  });

  it('error logs to console.error', () => {
    log.error('something broke');
    const calls = (console.error as ReturnType<typeof vi.spyOn>).mock.calls;
    expect(calls).toHaveLength(1);
    const parsed = JSON.parse(calls[0][0] as string);
    expect(parsed.level).toBe('error');
  });

  it('debug logs to console.debug', () => {
    log.debug('tracing info');
    const calls = (console.debug as ReturnType<typeof vi.spyOn>).mock.calls;
    expect(calls).toHaveLength(1);
    const parsed = JSON.parse(calls[0][0] as string);
    expect(parsed.level).toBe('debug');
  });

  it('includes metadata when provided', () => {
    log.info('request served', { durationMs: 150, route: '/api/test' });
    const calls = (console.info as ReturnType<typeof vi.spyOn>).mock.calls;
    const parsed = JSON.parse(calls[0][0] as string);
    expect(parsed.metadata.durationMs).toBe(150);
    expect(parsed.metadata.route).toBe('/api/test');
  });

  it('setCorrelationId is included in output', () => {
    log.setCorrelationId('ov-abc-123');
    log.info('with correlation');
    const calls = (console.info as ReturnType<typeof vi.spyOn>).mock.calls;
    const parsed = JSON.parse(calls[0][0] as string);
    expect(parsed.correlationId).toBe('ov-abc-123');
  });

  it('withContext creates child with bound fields', () => {
    const child = log.withContext({ userId: 'user-1', route: '/api/data' });
    child.info('child log');
    const calls = (console.info as ReturnType<typeof vi.spyOn>).mock.calls;
    const parsed = JSON.parse(calls[0][0] as string);
    expect(parsed.userId).toBe('user-1');
    expect(parsed.route).toBe('/api/data');
  });

  it('withContext propagates correlationId', () => {
    log.setCorrelationId('ov-parent');
    const child = log.withContext({ route: '/child' });
    child.info('child with parent correlation');
    const calls = (console.info as ReturnType<typeof vi.spyOn>).mock.calls;
    const parsed = JSON.parse(calls[0][0] as string);
    expect(parsed.correlationId).toBe('ov-parent');
  });

  it('child metadata merges with parent metadata', () => {
    const parentWithMeta = log.withContext({ route: '/parent' });
    const child = parentWithMeta.withContext({ userId: 'u2' });
    child.info('nested child', { extra: true });
    const calls = (console.info as ReturnType<typeof vi.spyOn>).mock.calls;
    const parsed = JSON.parse(calls[0][0] as string);
    expect(parsed.route).toBe('/parent');
    expect(parsed.userId).toBe('u2');
    expect(parsed.metadata.extra).toBe(true);
  });
});
