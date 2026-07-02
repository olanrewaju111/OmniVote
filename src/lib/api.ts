/**
 * Centralized fetch wrapper that:
 * 1. Checks res.ok — throws on 4xx/5xx instead of silently swallowing errors
 * 2. Returns parsed JSON on success
 *
 * Usage:
 *   const data = await fetchJson('/api/dashboard?tenantId=X');
 *   const data = await fetchJson('/api/incidents', { method: 'POST', body: ... });
 */
export async function fetchJson<T = unknown>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(url, init);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || data.message || `Request failed (${res.status})`);
  }
  return data as T;
}