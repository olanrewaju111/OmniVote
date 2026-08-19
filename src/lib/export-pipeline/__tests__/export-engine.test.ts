/**
 * Unit tests for the export engine.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock logger to avoid noise
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { generateCsv, generateJson, generateHtmlReport, exportData, ExportJobQueue } from '../export-engine';
import type { ExportColumn } from '../export-engine';

const SAMPLE_ROWS: Record<string, unknown>[] = [
  { id: '1', name: 'Lagos PU', severity: 'HIGH', count: 42, isActive: true, createdAt: '2025-03-01T10:00:00Z' },
  { id: '2', name: 'Abuja PU', severity: 'LOW', count: 7, isActive: false, createdAt: '2025-03-02T14:30:00Z' },
  { id: '3', name: 'Rivers PU', severity: 'CRITICAL', count: 99, isActive: true, createdAt: '2025-03-03T09:15:00Z' },
];

const SAMPLE_COLS: ExportColumn[] = [
  { key: 'id', label: 'ID' },
  { key: 'name', label: 'Name' },
  { key: 'severity', label: 'Severity' },
  { key: 'count', label: 'Count' },
  { key: 'isActive', label: 'Active' },
  { key: 'createdAt', label: 'Date' },
];

describe('generateCsv', () => {
  it('produces BOM-prefixed CSV with header row', () => {
    const csv = generateCsv(SAMPLE_ROWS, SAMPLE_COLS);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    const lines = csv.split('\n');
    expect(lines[0].includes('ID,Name,Severity,Count,Active,Date')).toBe(true);
  });

  it('escapes fields with commas and quotes', () => {
    const rows = [{ text: 'Hello, "world"', num: 1 }];
    const cols: ExportColumn[] = [
      { key: 'text', label: 'Text' },
      { key: 'num', label: 'Num' },
    ];
    const csv = generateCsv(rows, cols);
    expect(csv).toContain('"Hello, ""world"""');
  });

  it('applies column transforms', () => {
    const cols: ExportColumn[] = [
      { key: 'isActive', label: 'Active', transform: v => v ? 'Yes' : 'No' },
    ];
    const csv = generateCsv(SAMPLE_ROWS, cols);
    expect(csv).toContain('Yes');
    expect(csv).toContain('No');
  });

  it('handles empty rows', () => {
    const csv = generateCsv([], SAMPLE_COLS);
    expect(csv.split('\n').length).toBe(1); // BOM + header, no trailing newline for empty rows
  });

  it('handles null/undefined values', () => {
    const rows = [{ a: null, b: undefined, c: 'ok' }];
    const cols: ExportColumn[] = [
      { key: 'a', label: 'A' },
      { key: 'b', label: 'B' },
      { key: 'c', label: 'C' },
    ];
    const csv = generateCsv(rows, cols);
    const dataLine = csv.split('\n')[1];
    expect(dataLine).toBe(',,ok');
  });
});

describe('generateJson', () => {
  it('produces structured JSON with metadata', () => {
    const json = generateJson(SAMPLE_ROWS, SAMPLE_COLS);
    const parsed = JSON.parse(json);
    expect(parsed.totalRecords).toBe(3);
    expect(parsed.data[0].ID).toBe('1');
    expect(parsed.exportedAt).toBeDefined();
  });

  it('without columns uses raw row keys', () => {
    const json = generateJson(SAMPLE_ROWS);
    const parsed = JSON.parse(json);
    expect(parsed.data[0].name).toBe('Lagos PU');
    expect(parsed.data[0].count).toBe(42);
  });

  it('applies column transforms', () => {
    const cols: ExportColumn[] = [
      { key: 'severity', label: 'Level', transform: v => `[${v}]` },
    ];
    const json = generateJson(SAMPLE_ROWS, cols);
    const parsed = JSON.parse(json);
    expect(parsed.data[0].Level).toBe('[HIGH]');
  });
});

describe('generateHtmlReport', () => {
  it('produces valid HTML with title, table, and footer', () => {
    const html = generateHtmlReport(SAMPLE_ROWS, SAMPLE_COLS, {
      title: 'Test Report',
      tenantName: 'OmniVote',
      generatedBy: 'admin',
    });
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Test Report');
    expect(html).toContain('OmniVote');
    expect(html).toContain('admin');
    expect(html).toContain('<table>');
    expect(html).toContain('OmniVote Monitor');
  });

  it('includes summary stats when provided', () => {
    const html = generateHtmlReport(SAMPLE_ROWS, SAMPLE_COLS, {
      title: 'Stats Report',
      summaryStats: [
        { label: 'Total', value: 148 },
        { label: 'Avg', value: 49.3 },
      ],
    });
    expect(html).toContain('148');
    expect(html).toContain('Avg');
    expect(html).toContain('summary-grid');
  });

  it('renders severity badges in HTML', () => {
    const html = generateHtmlReport(SAMPLE_ROWS, SAMPLE_COLS, { title: 'Badge Test' });
    expect(html).toContain('badge-critical');
    expect(html).toContain('badge-high');
    expect(html).toContain('badge-low');
  });

  it('truncates long text cells', () => {
    const longRows = [{ id: '1', text: 'A'.repeat(200) }];
    const cols: ExportColumn[] = [
      { key: 'id', label: 'ID' },
      { key: 'text', label: 'Text' },
    ];
    const html = generateHtmlReport(longRows, cols, { title: 'Truncation Test' });
    expect(html).toContain('...');
  });
});

describe('exportData', () => {
  const baseOpts = {
    format: 'csv' as const,
    entityType: 'incidents',
    tenantId: 'tenant123',
    requestedBy: 'user1',
  };

  it('returns CSV by default', () => {
    const result = exportData(SAMPLE_ROWS, baseOpts);
    expect(result.mimeType).toBe('text/csv; charset=utf-8');
    expect(result.filename).toContain('.csv');
    expect(result.rowCount).toBe(3);
    expect(result.size).toBeGreaterThan(0);
  });

  it('returns JSON for json format', () => {
    const result = exportData(SAMPLE_ROWS, { ...baseOpts, format: 'json' });
    expect(result.mimeType).toBe('application/json');
    expect(result.filename).toContain('.json');
  });

  it('returns HTML for html format', () => {
    const result = exportData(SAMPLE_ROWS, { ...baseOpts, format: 'html' });
    expect(result.mimeType).toBe('text/html; charset=utf-8');
    expect(result.filename).toContain('.html');
    expect(result.content).toContain('<!DOCTYPE html>');
  });

  it('uses custom title and subtitle in HTML', () => {
    const result = exportData(SAMPLE_ROWS, {
      ...baseOpts,
      format: 'html',
      title: 'Custom Title',
      subtitle: 'Custom Subtitle',
      tenantName: 'TestOrg',
    });
    expect(result.content).toContain('Custom Title');
    expect(result.content).toContain('Custom Subtitle');
    expect(result.content).toContain('TestOrg');
  });

  it('uses filenamePrefix when provided', () => {
    const result = exportData(SAMPLE_ROWS, { ...baseOpts, filenamePrefix: 'my-export' });
    expect(result.filename).toContain('my-export');
  });

  it('generates timestamp and size metadata', () => {
    const result = exportData(SAMPLE_ROWS, baseOpts);
    expect(result.generatedAt).toBeDefined();
    expect(result.size).toBeGreaterThan(0);
  });
});

describe('ExportJobQueue', () => {
  let queue: ExportJobQueue;

  beforeEach(() => {
    vi.useFakeTimers();
    queue = new ExportJobQueue(2, 60);
  });

  afterEach(() => {
    queue.destroy();
    vi.useRealTimers();
  });

  it('enqueues a job and returns it', async () => {
    const executor = vi.fn().mockResolvedValue({
      content: 'test', filename: 'test.csv', mimeType: 'text/csv',
      size: 4, generatedAt: new Date().toISOString(), rowCount: 1,
    });
    const job = await queue.enqueue(executor, {
      tenantId: 't1', format: 'csv', entityType: 'incidents', requestedBy: 'u1',
    });
    expect(job.id).toMatch(/^exp-/);
    expect(queue.getJob(job.id)).toBeDefined();
    // Job may have already completed (immediate mock resolution)
    expect(['QUEUED', 'RUNNING', 'COMPLETED']).toContain(job.status);
  });

  it('processes job and transitions to COMPLETED', async () => {
    let resolveExecutor: (v: unknown) => void;
    const executor = vi.fn().mockImplementation(() => new Promise(r => { resolveExecutor = r; }));

    const job = await queue.enqueue(executor, {
      tenantId: 't1', format: 'csv', entityType: 'incidents', requestedBy: 'u1',
    });
    // Job may transition to RUNNING immediately (processQueue is sync up to first await)
    expect(['QUEUED', 'RUNNING']).toContain(queue.getJob(job.id)?.status);

    await vi.advanceTimersByTimeAsync(0);
    expect(queue.getJob(job.id)?.status).toBe('RUNNING');

    resolveExecutor!({
      content: 'data', filename: 'out.csv', mimeType: 'text/csv',
      size: 4, generatedAt: new Date().toISOString(), rowCount: 10,
    });
    await vi.advanceTimersByTimeAsync(0);

    expect(queue.getJob(job.id)?.status).toBe('COMPLETED');
    expect(queue.getJob(job.id)?.rowCount).toBe(10);
    expect(queue.getJob(job.id)?.filename).toBe('out.csv');
  });

  it('marks job as FAILED on executor error', async () => {
    let rejectExecutor: (err: Error) => void;
    const executor = vi.fn().mockImplementation(() => new Promise((_, reject) => { rejectExecutor = reject; }));

    const job = await queue.enqueue(executor, {
      tenantId: 't1', format: 'csv', entityType: 'incidents', requestedBy: 'u1',
    });
    await vi.advanceTimersByTimeAsync(0);

    rejectExecutor!(new Error('DB timeout'));
    await vi.advanceTimersByTimeAsync(0);

    expect(queue.getJob(job.id)?.status).toBe('FAILED');
    expect(queue.getJob(job.id)?.error).toBe('DB timeout');
  });

  it('respects maxConcurrent limit', async () => {
    const executors = Array.from({ length: 4 }, () => {
      let resolveEx: (v: unknown) => void;
      const executor = vi.fn().mockImplementation(() => new Promise(r => { resolveEx = r; }));
      return { executor, resolveEx: () => resolveEx!({ content: '', filename: 'f.csv', mimeType: 'text/csv', size: 0, generatedAt: '', rowCount: 0 }) };
    });

    for (const e of executors) {
      await queue.enqueue(e.executor, { tenantId: 't1', format: 'csv', entityType: 'test', requestedBy: 'u1' });
    }
    await vi.advanceTimersByTimeAsync(0);

    const allJobs = queue.getJobsByTenant('t1');
    const running = allJobs.filter(j => j.status === 'RUNNING');
    expect(running.length).toBeLessThanOrEqual(2);
  });

  it('returns jobs filtered by tenant', async () => {
    const executor = vi.fn().mockResolvedValue({ content: '', filename: 'f.csv', mimeType: 'text/csv', size: 0, generatedAt: '', rowCount: 0 });
    await queue.enqueue(executor, { tenantId: 't1', format: 'csv', entityType: 'a', requestedBy: 'u1' });
    await queue.enqueue(executor, { tenantId: 't2', format: 'csv', entityType: 'b', requestedBy: 'u2' });

    const t1Jobs = queue.getJobsByTenant('t1');
    expect(t1Jobs.length).toBe(1);
    expect(t1Jobs[0].tenantId).toBe('t1');
  });

  it('returns queue stats', async () => {
    const executor = vi.fn().mockResolvedValue({ content: '', filename: 'f.csv', mimeType: 'text/csv', size: 0, generatedAt: '', rowCount: 0 });
    await queue.enqueue(executor, { tenantId: 't1', format: 'csv', entityType: 'a', requestedBy: 'u1' });
    await queue.enqueue(executor, { tenantId: 't1', format: 'csv', entityType: 'b', requestedBy: 'u1' });

    const stats = queue.stats;
    expect(stats.total).toBeGreaterThanOrEqual(2);
    expect(typeof stats.queued).toBe('number');
    expect(typeof stats.running).toBe('number');
  });
});