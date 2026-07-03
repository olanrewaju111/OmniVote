/**
 * Safely parse a JSON string field from the database.
 * Returns the fallback value if the input is null, undefined, or invalid JSON.
 */
export function safeParse<T = unknown>(
  val: string | null | undefined,
  fallback: T = [] as T,
): T {
  if (!val) return fallback;
  try {
    return JSON.parse(val) as T;
  } catch {
    return fallback;
  }
}