/**
 * Structured Log Aggregation — Phase 13
 *
 * Provides a structured logger that outputs JSON to console.
 * Supports child loggers with bound context and correlation ID propagation.
 */

// ─── Types ─────────────────────────────────────────────────────────────

export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  correlationId?: string;
  userId?: string;
  tenantId?: string;
  route?: string;
  durationMs?: number;
  error?: string;
  metadata?: Record<string, unknown>;
}

// ─── Structured Logger ──────────────────────────────────────────────────

export class StructuredLogger {
  private correlationId?: string;
  private boundContext: Partial<LogEntry> = {};

  /**
   * Set the correlation ID for this logger instance and all children.
   */
  setCorrelationId(id: string): void {
    this.correlationId = id;
  }

  /**
   * Create a child logger with additional bound context.
   */
  withContext(context: Partial<LogEntry>): StructuredLogger {
    const child = new StructuredLogger();
    child.correlationId = this.correlationId;
    child.boundContext = { ...this.boundContext, ...context };
    return child;
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.log('info', message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.log('warn', message, meta);
  }

  error(message: string, meta?: Record<string, unknown>): void {
    this.log('error', message, meta);
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.log('debug', message, meta);
  }

  private log(level: string, message: string, meta?: Record<string, unknown>): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      correlationId: this.correlationId,
      ...this.boundContext,
      ...(meta ? { metadata: { ...(this.boundContext.metadata || {}), ...meta } } : {}),
    };

    const json = JSON.stringify(entry);

    switch (level) {
      case 'error':
        console.error(json);
        break;
      case 'warn':
        console.warn(json);
        break;
      case 'debug':
        console.debug(json);
        break;
      default:
        console.info(json);
    }
  }
}

// Singleton export
export const logger = new StructuredLogger();
