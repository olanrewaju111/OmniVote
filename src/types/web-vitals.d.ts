declare module 'web-vitals' {
  interface Metric {
    value: number;
    rating: 'good' | 'needs-improvement' | 'poor';
    delta: number;
    navigationType?: string;
  }
  export function onLCP(callback: (metric: Metric) => void): () => void;
  export function onINP(callback: (metric: Metric) => void): () => void;
  export function onCLS(callback: (metric: Metric) => void): () => void;
  export function onFCP(callback: (metric: Metric) => void): () => void;
  export function onTTFB(callback: (metric: Metric) => void): () => void;
}
