/**
 * Mock for the web-vitals library.
 * Provides no-op callbacks that can be used in tests.
 */
export function onLCP(cb: (metric: { value: number; rating: string; delta: number; navigationType?: string }) => void) {
  return () => {};
}
export function onINP(cb: (metric: { value: number; rating: string; delta: number; navigationType?: string }) => void) {
  return () => {};
}
export function onCLS(cb: (metric: { value: number; rating: string; delta: number }) => void) {
  return () => {};
}
export function onFCP(cb: (metric: { value: number; rating: string; delta: number }) => void) {
  return () => {};
}
export function onTTFB(cb: (metric: { value: number; rating: string; delta: number; navigationType?: string }) => void) {
  return () => {};
}
