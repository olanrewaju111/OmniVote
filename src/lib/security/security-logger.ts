/**
 * Security-specific audit logging.
 * Structured JSON output to console with severity-based routing.
 */

// ─── Types ───────────────────────────────────────────────────────────────

type SecuritySeverity = 'info' | 'warning' | 'critical';

export type SecurityEventType =
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILURE'
  | 'ACCOUNT_LOCKED'
  | 'CSRF_FAILURE'
  | 'RATE_LIMITED'
  | 'SUSPICIOUS_REQUEST'
  | 'PERMISSION_DENIED'
  | 'TOKEN_EXPIRED'
  | 'BRUTE_FORCE_DETECTED'
  | 'IP_BLOCKED';

interface SecurityEvent {
  type: SecurityEventType | string;
  severity: SecuritySeverity;
  userId?: string;
  tenantId?: string;
  ipAddress?: string;
  details: Record<string, unknown>;
  timestamp?: number;
}

// ─── Severity to log level mapping ───────────────────────────────────────

const SEVERITY_LOG_MAP: Record<SecuritySeverity, 'info' | 'warn' | 'error'> = {
  info: 'info',
  warning: 'warn',
  critical: 'error',
};

// ─── Public API ───────────────────────────────────────────────────────────

/**
 * Log a security event as structured JSON.
 *
 * - 'critical' → console.error
 * - 'warning' → console.warn
 * - 'info' → console.info
 *
 * Each entry includes a `securityEvent: true` marker for easy log filtering.
 */
export function logSecurityEvent(event: SecurityEvent): void {
  const logEntry = {
    securityEvent: true,
    type: event.type,
    severity: event.severity,
    userId: event.userId || null,
    tenantId: event.tenantId || null,
    ipAddress: event.ipAddress || null,
    details: event.details,
    timestamp: event.timestamp ?? Date.now(),
  };

  const logLevel = SEVERITY_LOG_MAP[event.severity] || 'info';
  const logFn = console[logLevel] as (message: string, ...args: unknown[]) => void;

  logFn(`[security:${event.type}] ${JSON.stringify(logEntry)}`);
}
