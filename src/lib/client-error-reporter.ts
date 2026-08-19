/**
 * Client-Side Error Reporter — Phase 15
 *
 * Provides a thin bridge for the ErrorBoundary (and any other client-side code)
 * to report errors to the server-side error tracker via a fire-and-forget fetch.
 *
 * This is a separate module (not importing from error-tracker.ts directly)
 * because the error tracker runs server-side only — the client reports
 * errors to an API endpoint instead.
 */

interface ClientErrorReport {
  message: string;
  stack?: string;
  componentStack?: string;
  severity?: 'error' | 'warning' | 'fatal';
  tags?: string[];
  route?: string;
}

/**
 * Report a client-side error to the server error tracker.
 * Fire-and-forget — does not block the UI.
 */
export function reportClientError(error: ClientErrorReport): void {
  if (typeof fetch === 'undefined') return;

  fetch('/api/metrics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'client-error',
      ...error,
      timestamp: Date.now(),
    }),
  }).catch(() => {
    // Silently ignore — fire and forget
  });
}

/**
 * Report a client error from a React ErrorBoundary.
 * Convenience wrapper that extracts error info from the boundary's catch.
 */
export function reportBoundaryError(
  error: Error,
  errorInfo?: React.ErrorInfo,
  componentName?: string,
): void {
  reportClientError({
    message: error.message,
    stack: error.stack,
    componentStack: errorInfo?.componentStack ?? undefined,
    severity: 'error',
    tags: componentName ? ['error-boundary', componentName] : ['error-boundary'],
    route: typeof window !== 'undefined' ? window.location.pathname : undefined,
  });
}
