/**
 * export-engine.ts — Advanced Data Export Engine
 *
 * Supports CSV (with BOM for Excel), structured JSON, and HTML report generation.
 * Each exporter returns { content, filename, mimeType } for streaming to the client.
 * A background job queue handles large/slow exports asynchronously.
 */

import { logger } from '@/lib/logger';

// ─── Types ───────────────────────────────────────────────────────

export type ExportFormat = 'csv' | 'json' | 'html' | 'pdf';

export interface ExportColumn {
  key: string;
  label: string;
  transform?: (value: unknown, row: Record<string, unknown>) => string;
}

export interface ExportOptions {
  format: ExportFormat;
  entityType: string;
  tenantId: string;
  tenantName?: string;
  filenamePrefix?: string;
  columns?: ExportColumn[];
  startDate?: Date;
  endDate?: Date;
  filters?: Record<string, string>;
  requestedBy: string;
  title?: string;
  subtitle?: string;
}

export interface ExportResult {
  content: string | Buffer;
  filename: string;
  mimeType: string;
  size: number;
  generatedAt: string;
  rowCount: number;
}

export interface ExportJob {
  id: string;
  tenantId: string;
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  format: ExportFormat;
  entityType: string;
  filename?: string;
  size?: number;
  rowCount?: number;
  error?: string;
  requestedBy: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  expiresAt: string;
}

// ─── CSV Exporter ────────────────────────────────────────────────

function escapeCsvField(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function generateCsv(
  rows: Record<string, unknown>[],
  columns: ExportColumn[]
): string {
  // BOM for Excel UTF-8 compatibility
  const bom = '\uFEFF';
  const header = columns.map(c => escapeCsvField(c.label)).join(',');
  const dataRows = rows.map(row =>
    columns.map(col => {
      const raw = row[col.key];
      return escapeCsvField(col.transform ? col.transform(raw, row) : raw);
    }).join(',')
  );
  return bom + [header, ...dataRows].join('\n');
}

// ─── JSON Exporter ───────────────────────────────────────────────

export function generateJson(
  rows: Record<string, unknown>[],
  columns?: ExportColumn[]
): string {
  const data = columns
    ? rows.map(row => {
        const obj: Record<string, string> = {};
        for (const col of columns) {
          obj[col.label] = col.transform
            ? col.transform(row[col.key], row)
            : String(row[col.key] ?? '');
        }
        return obj;
      })
    : rows;
  return JSON.stringify({
    exportedAt: new Date().toISOString(),
    totalRecords: rows.length,
    data,
  }, null, 2);
}

// ─── HTML Report Exporter ────────────────────────────────────────

export function generateHtmlReport(
  rows: Record<string, unknown>[],
  columns: ExportColumn[],
  options: {
    title: string;
    subtitle?: string;
    tenantName?: string;
    summaryStats?: Array<{ label: string; value: string | number }>;
    generatedBy?: string;
  }
): string {
  const { title, subtitle, tenantName, summaryStats, generatedBy } = options;
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

  const summaryHtml = summaryStats && summaryStats.length > 0
    ? `
    <div class="summary-grid">
      ${summaryStats.map(s => `
        <div class="stat-card">
          <div class="stat-value">${s.value}</div>
          <div class="stat-label">${s.label}</div>
        </div>
      `).join('')}
    </div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1f2937; background: #f9fafb; }
    .container { max-width: 1100px; margin: 0 auto; padding: 32px; }
    .header { background: linear-gradient(135deg, #059669, #10b981); color: white; padding: 32px; border-radius: 12px 12px 0 0; }
    .header h1 { font-size: 22px; font-weight: 700; margin-bottom: 4px; }
    .header .subtitle { font-size: 14px; opacity: 0.9; }
    .header .meta { font-size: 12px; opacity: 0.75; margin-top: 12px; }
    .body { background: white; padding: 24px; border-radius: 0 0 12px 12px; box-shadow: 0 1px 3px rgba(0,0,0,.1); }
    .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .stat-card { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; text-align: center; }
    .stat-value { font-size: 24px; font-weight: 700; color: #059669; }
    .stat-label { font-size: 12px; color: #6b7280; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    thead th { background: #f3f4f6; padding: 10px 12px; text-align: left; font-weight: 600; color: #374151; border-bottom: 2px solid #e5e7eb; position: sticky; top: 0; }
    tbody td { padding: 8px 12px; border-bottom: 1px solid #f3f4f6; }
    tbody tr:nth-child(even) { background: #f9fafb; }
    .footer { text-align: center; font-size: 11px; color: #9ca3af; padding: 24px; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 11px; font-weight: 600; }
    .badge-critical { background: #fef2f2; color: #dc2626; }
    .badge-high { background: #fff7ed; color: #ea580c; }
    .badge-medium { background: #fffbeb; color: #d97706; }
    .badge-low { background: #f0fdf4; color: #16a34a; }
    .badge-info { background: #eff6ff; color: #2563eb; }
    @media print {
      body { background: white; }
      .container { padding: 0; max-width: 100%; }
      .body { box-shadow: none; border-radius: 0; }
      .header { border-radius: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${title}</h1>
      ${subtitle ? `<div class="subtitle">${subtitle}</div>` : ''}
      <div class="meta">
        ${tenantName ? `Tenant: ${tenantName} &bull; ` : ''}
        Generated: ${now} UTC &bull; Records: ${rows.length.toLocaleString()}
        ${generatedBy ? ` &bull; By: ${generatedBy}` : ''}
      </div>
    </div>
    <div class="body">
      ${summaryHtml}
      <table>
        <thead>
          <tr>${columns.map(c => `<th>${c.label}</th>`).join('')}</tr>
        </thead>
        <tbody>
          ${rows.map((row, _i) => `
            <tr>${columns.map(col => {
              const raw = row[col.key];
              const val = col.transform ? col.transform(raw, row) : String(raw ?? '');
              if (col.key.toLowerCase().includes('severity') || col.key.toLowerCase().includes('risklevel')) {
                const cls = val === 'CRITICAL' ? 'critical' : val === 'HIGH' ? 'high' : val === 'MEDIUM' ? 'medium' : val === 'LOW' ? 'low' : 'info';
                return `<td><span class="badge badge-${cls}">${val}</span></td>`;
              }
              if (val.length > 120) {
                return `<td title="${val.replace(/"/g, '&quot;')}">${val.substring(0, 120)}...</td>`;
              }
              return `<td>${val}</td>`;
            }).join('')}</tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    <div class="footer">
      OmniVote Monitor &mdash; Secure Election Command Center &bull; Confidential
    </div>
  </div>
</body>
</html>`;
}

// ─── Master Export Function ──────────────────────────────────────

const MIME_TYPES: Record<ExportFormat, string> = {
  csv: 'text/csv; charset=utf-8',
  json: 'application/json',
  html: 'text/html; charset=utf-8',
  pdf: 'application/pdf',
};

export function exportData(
  rows: Record<string, unknown>[],
  options: ExportOptions
): ExportResult {
  const { format, entityType, tenantId, tenantName, filenamePrefix, columns, title, subtitle, requestedBy } = options;
  const cols = columns || autoDetectColumns(rows);
  const ts = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  const prefix = filenamePrefix || `omnivote-${entityType}`;
  const baseName = `${prefix}_${tenantId.substring(0, 8)}_${ts}`;

  let content: string | Buffer;
  let ext: string;

  switch (format) {
    case 'csv':
      content = generateCsv(rows, cols);
      ext = 'csv';
      break;
    case 'json':
      content = generateJson(rows, cols);
      ext = 'json';
      break;
    case 'html': {
      content = generateHtmlReport(rows, cols, {
        title: title || `OmniVote ${entityType} Report`,
        subtitle: subtitle || `Data export for ${tenantName || tenantId}`,
        tenantName,
        generatedBy: requestedBy,
      });
      ext = 'html';
      break;
    }
    default:
      content = generateCsv(rows, cols);
      ext = 'csv';
  }

  const filename = `${baseName}.${ext}`;
  const buf = typeof content === 'string' ? Buffer.from(content) : content;

  return {
    content,
    filename,
    mimeType: MIME_TYPES[format] || 'application/octet-stream',
    size: buf.length,
    generatedAt: new Date().toISOString(),
    rowCount: rows.length,
  };
}

// ─── Column Auto-Detection ──────────────────────────────────────

function autoDetectColumns(rows: Record<string, unknown>[]): ExportColumn[] {
  if (rows.length === 0) return [];
  const keys = Object.keys(rows[0]);
  const skip = new Set(['tenantId', 'passwordHash', 'encryptionKey', 'twoFactorSecret', 'deviceFingerprint']);
  return keys
    .filter(k => !skip.has(k))
    .map(key => ({
      key,
      label: key
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, s => s.toUpperCase())
        .replace(/_/g, ' ')
        .trim(),
    }));
}

// ─── Background Export Job Queue ────────────────────────────────

export class ExportJobQueue {
  private jobs: Map<string, ExportJob> = new Map();
  private maxConcurrent: number;
  private running: number = 0;
  private retentionMs: number;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(maxConcurrent = 3, retentionMinutes = 60) {
    this.maxConcurrent = maxConcurrent;
    this.retentionMs = retentionMinutes * 60 * 1000;
    this.cleanupInterval = setInterval(() => this.cleanup(), 10 * 60 * 1000);
  }

  /**
   * Enqueue an export job. Returns the job ID for status polling.
   */
  async enqueue(
    executor: () => Promise<ExportResult>,
    options: { tenantId: string; format: ExportFormat; entityType: string; requestedBy: string }
  ): Promise<ExportJob> {
    const id = `exp-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const now = new Date();
    const job: ExportJob = {
      id,
      tenantId: options.tenantId,
      status: 'QUEUED',
      format: options.format,
      entityType: options.entityType,
      requestedBy: options.requestedBy,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + this.retentionMs).toISOString(),
    };

    this.jobs.set(id, job);
    logger.info({ message: 'Export job queued', module: 'EXPORT', jobId: id, entityType: options.entityType });

    this.processQueue(executor, id);
    return job;
  }

  private async processQueue(executor: () => Promise<ExportResult>, jobId: string): Promise<void> {
    if (this.running >= this.maxConcurrent) return;

    const job = this.jobs.get(jobId);
    if (!job || job.status !== 'QUEUED') return;

    this.running++;
    job.status = 'RUNNING';
    job.startedAt = new Date().toISOString();

    try {
      const result = await executor();
      job.status = 'COMPLETED';
      job.filename = result.filename;
      job.size = result.size;
      job.rowCount = result.rowCount;
      job.completedAt = new Date().toISOString();
      logger.info({ message: 'Export job completed', module: 'EXPORT', jobId, filename: result.filename, rows: result.rowCount });
    } catch (err) {
      job.status = 'FAILED';
      job.error = err instanceof Error ? err.message : String(err);
      job.completedAt = new Date().toISOString();
      logger.error({ message: 'Export job failed', module: 'EXPORT', jobId, error: job.error });
    } finally {
      this.running--;
    }
  }

  getJob(id: string): ExportJob | undefined {
    return this.jobs.get(id);
  }

  getJobsByTenant(tenantId: string): ExportJob[] {
    return Array.from(this.jobs.values())
      .filter(j => j.tenantId === tenantId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [id, job] of this.jobs) {
      if (new Date(job.expiresAt).getTime() < now) {
        this.jobs.delete(id);
      }
    }
  }

  get stats() {
    const all = Array.from(this.jobs.values());
    return {
      total: all.length,
      queued: all.filter(j => j.status === 'QUEUED').length,
      running: all.filter(j => j.status === 'RUNNING').length,
      completed: all.filter(j => j.status === 'COMPLETED').length,
      failed: all.filter(j => j.status === 'FAILED').length,
    };
  }

  destroy(): void {
    if (this.cleanupInterval) clearInterval(this.cleanupInterval);
    this.jobs.clear();
  }
}

// Singleton
export const exportJobQueue = new ExportJobQueue();
