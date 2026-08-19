/**
 * Monitoring module barrel export — Phase 13
 */

export { generateCorrelationId, getCorrelationIdFromRequest, withCorrelationId } from './correlation';
export { errorTracker, ErrorTracker } from './error-tracker';
export type { ErrorEvent } from './error-tracker';
export { alertManager, AlertManager } from './alerting';
export type { AlertRule, Alert } from './alerting';
export { usePerformanceMetrics, reportWebVitals, createPerformanceMarker } from './performance-monitor';
export { logger, StructuredLogger } from './log-aggregator';
export type { LogEntry } from './log-aggregator';
