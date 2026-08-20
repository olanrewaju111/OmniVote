/**
 * Centralized fetch wrapper that:
 * 1. Checks res.ok — throws on 4xx/5xx instead of silently swallowing errors
 * 2. Returns parsed JSON on success
 * 3. Automatically includes credentials (cookies) for auth
 * 4. Automatically attaches CSRF token for mutating requests
 *
 * Usage:
 *   const data = await fetchJson('/api/dashboard?tenantId=X');
 *   const data = await fetchJson('/api/incidents', { method: 'POST', body: ... });
 */

const CSRF_COOKIE_NAME = 'omnivote-csrf';

/** Read CSRF token from the non-httpOnly cookie */
function getCsrfToken(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${CSRF_COOKIE_NAME}=([^;]*)`)
  );
  return match ? match[1] : null;
}

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export async function fetchJson<T = unknown>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const method = (init?.method || 'GET').toUpperCase();
  const isMutating = MUTATING_METHODS.has(method);

  // Auto-attach CSRF token for mutating requests
  const csrfHeaders: Record<string, string> = {};
  if (isMutating) {
    const csrfToken = getCsrfToken();
    if (csrfToken) {
      csrfHeaders['x-csrf-token'] = csrfToken;
    }
  }

  const res = await fetch(url, {
    ...init,
    credentials: 'include', // Always send cookies for auth
    headers: {
      ...csrfHeaders,
      ...init?.headers,
      // Don't override Content-Type if already set (e.g., for FormData)
      ...(init?.body && !(init?.headers instanceof Headers) && !Object(init?.headers as Record<string, unknown>).has?.('Content-Type')
        ? { 'Content-Type': 'application/json' }
        : {}),
    },
  });
  const data = await res.json();
  if (!res.ok) {
    // Handle 401 — trigger logout
    if (res.status === 401) {
      // Clear client-side state via store
      try {
        const { useDashboardStore } = await import('@/store/dashboard');
        useDashboardStore.getState().logout();
      } catch { /* non-critical */ }
    }
    throw new Error(data.error || data.message || `Request failed (${res.status})`);
  }
  return data as T;
}