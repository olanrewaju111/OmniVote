'use client';

import { useEffect, useRef } from 'react';
import { useSound } from '@/hooks/use-sound';
import { useDashboardStore } from '@/store/dashboard';

/**
 * ToastSoundEnhancer — intercepts sonner toast events and plays appropriate sounds.
 * This is a renderless component that should be placed once in the app tree.
 * It observes DOM mutations for sonner toast containers and plays sounds
 * based on the toast type (error, warning, success, info).
 */
export function ToastSoundEnhancer() {
  const { play, isSoundEnabled } = useSound();
  const { isAuthenticated } = useDashboardStore();
  const observerRef = useRef<MutationObserver | null>(null);
  const processedRef = useRef<Set<Element>>(new Set());

  useEffect(() => {
    if (!isAuthenticated || typeof document === 'undefined') return;

    const getToastType = (el: Element): 'success' | 'error' | 'warning' | 'info' | null => {
      const classList = el.className || '';
      if (classList.includes('[data-type=success]') || el.querySelector('[data-type=success]')) return 'success';
      if (classList.includes('[data-type=error]') || el.querySelector('[data-type=error]')) return 'error';
      // Sonner doesn't always add data attributes — infer from icon/text
      const html = el.innerHTML || '';
      if (html.includes('check-circle') || html.includes('CheckCircle')) return 'success';
      if (html.includes('alert-circle') || html.includes('AlertCircle') || html.includes('x-circle')) return 'error';
      if (html.includes('alert-triangle') || html.includes('AlertTriangle')) return 'warning';
      return 'info';
    };

    observerRef.current = new MutationObserver((mutations) => {
      if (!isSoundEnabled()) return;

      for (const mutation of mutations) {
        for (const node of Array.from(mutation.addedNodes)) {
          if (!(node instanceof Element)) continue;

          // Check if this is a toast or contains toasts
          const toastEl = node.hasAttribute('data-sonner-toast')
            ? node
            : node.querySelector('[data-sonner-toast]');

          if (!toastEl) continue;
          if (processedRef.current.has(toastEl)) continue;
          processedRef.current.add(toastEl);

          const type = getToastType(toastEl);
          switch (type) {
            case 'success': play('success'); break;
            case 'error': play('critical'); break;
            case 'warning': play('notification'); break;
            default: play('notification'); break;
          }
        }
      }
    });

    // Observe the body for sonner toast container
    const sonnerRoot = document.querySelector('[data-sonner-toaster]') || document.body;
    observerRef.current.observe(sonnerRoot, { childList: true, subtree: true });

    // Cleanup processed refs periodically to avoid memory leaks
    const interval = setInterval(() => {
      if (processedRef.current.size > 50) {
        processedRef.current = new Set();
      }
    }, 30_000);

    return () => {
      observerRef.current?.disconnect();
      clearInterval(interval);
    };
  }, [isAuthenticated, play, isSoundEnabled]);

  return null; // Renderless
}
