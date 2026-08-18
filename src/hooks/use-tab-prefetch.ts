/**
 * useTabPrefetch — prefetches adjacent tab bundles when the user
 * dwells on a tab for a short delay, reducing perceived tab switch latency.
 *
 * Phase 10: Performance Optimization
 */

'use client';

import { useEffect, useRef, useCallback } from 'react';

// Adjacency map: for each tab, which tabs are likely to be visited next
const ADJACENT_TABS: Record<string, string[]> = {
  'overview': ['feed', 'alerts', 'situation'],
  'feed': ['overview', 'alerts', 'incidents'],
  'alerts': ['feed', 'overview', 'security'],
  'situation': ['feed', 'map', 'alerts'],
  'map': ['situation', 'feed', 'pvt'],
  'osint': ['ai', 'feed', 'alerts'],
  'ai': ['osint', 'feed', 'alerts'],
  'campaigns': ['campaign-analytics', 'voter-suppression'],
  'campaign-analytics': ['campaigns', 'social-cards'],
  'social-cards': ['campaign-analytics', 'narrative'],
  'security': ['alerts', 'field-safety', 'honeypot'],
  'field-safety': ['security', 'feed'],
  'pvt': ['map', 'victory-roadmap', 'results'],
  'victory-roadmap': ['pvt', 'campaigns'],
  'evidence': ['reports', 'my-reports'],
  'flashpoint': ['security', 'situation'],
  'honeypot': ['security', 'agents'],
  'audit-logs': ['security', 'system'],
  'agents': ['engagement', 'honeypot'],
  'engagement': ['agents', 'mobilization'],
  'mobilization': ['engagement', 'campaigns'],
  'narrative': ['reports', 'social-cards'],
  'reports': ['narrative', 'evidence', 'my-reports'],
};

// Map tab keys to their dynamic component chunk paths
const TAB_CHUNK_MAP: Record<string, string> = {
  'situation': '/dashboard/situation-room',
  'map': '/dashboard/geo-map',
  'feed': '/dashboard/live-feed',
  'alerts': '/dashboard/alert-triage',
  'osint': '/dashboard/osint-monitor',
  'ai': '/dashboard/ai-insights',
  'media': '/dashboard/media-gallery',
  'mobilization': '/dashboard/mobilization',
  'campaigns': '/dashboard/campaign-monitor',
  'campaign-analytics': '/dashboard/campaign-analytics',
  'social-cards': '/dashboard/social-cards',
  'security': '/dashboard/security-center',
  'field-safety': '/dashboard/field-safety',
  'pvt': '/dashboard/pvt-quick-count',
  'victory-roadmap': '/dashboard/victory-roadmap',
  'evidence': '/dashboard/evidence-dossier',
  'flashpoint': '/dashboard/flashpoint-wargame',
  'honeypot': '/dashboard/honeypot-biometrics',
  'audit-logs': '/dashboard/audit-log-viewer',
  'agents': '/dashboard/agent-roster',
  'engagement': '/dashboard/agent-engagement',
  'system': '/dashboard/system-health',
  'tenants': '/dashboard/tenant-mgmt',
  'narrative': '/dashboard/narrative-builder',
  'reports': '/dashboard/reports-center',
  'data-explorer': '/dashboard/data-explorer',
};

const PREFETCH_DELAY = 2000; // ms after tab switch before prefetching
const alreadyPrefetched = new Set<string>();

/**
 * Prefetch the JS chunks for the given tab keys.
 * Uses Next.js router.prefetch under the hood for route-based chunks,
 * and direct import() for component chunks.
 */
function prefetchTabs(tabKeys: string[]) {
  for (const key of tabKeys) {
    if (alreadyPrefetched.has(key)) continue;
    alreadyPrefetched.add(key);

    // Use dynamic import to trigger webpack/turbopack to prefetch the chunk
    // The import is fire-and-forget; we don't use the result
    const chunkPath = TAB_CHUNK_MAP[key];
    if (chunkPath) {
      import(`@/components${chunkPath}`).catch(() => {
        // Chunk may fail to load in some edge cases — that's fine
        alreadyPrefetched.delete(key);
      });
    }
  }
}

/**
 * Hook that prefetches adjacent tab component bundles after a dwell delay.
 *
 * @param activeTab - The currently active tab key
 * @param enabled - Whether prefetching is enabled (disable on low-end devices / Save-Data)
 */
export function useTabPrefetch(activeTab: string, enabled = true) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    clearTimer();

    const adjacent = ADJACENT_TABS[activeTab];
    if (!adjacent || adjacent.length === 0) return;

    timerRef.current = setTimeout(() => {
      prefetchTabs(adjacent);
    }, PREFETCH_DELAY);

    return clearTimer;
  }, [activeTab, enabled, clearTimer]);
}