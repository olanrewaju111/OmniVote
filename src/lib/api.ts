/**
 * Centralized fetch wrapper that:
 * 1. Checks res.ok — throws on 4xx/5xx instead of silently swallowing errors
 * 2. Returns parsed JSON on success
 * 3. Automatically includes credentials (cookies) for auth
 *
 * Usage:
 *   const data = await fetchJson('/api/dashboard?tenantId=X');
 *   const data = await fetchJson('/api/incidents', { method: 'POST', body: ... });
 */
export async function fetchJson<T = unknown>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(url, {
    ...init,
    credentials: 'include', // Always send cookies for auth
    headers: {
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