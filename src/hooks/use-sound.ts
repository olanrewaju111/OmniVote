'use client';

import { useCallback, useRef, useEffect } from 'react';
import { useDashboardStore } from '@/store/dashboard';

// ─── Web Audio API synth — no external audio files needed ─────────────────────

type SoundType = 'notification' | 'critical' | 'success' | 'click' | 'message' | 'victory';

const SOUND_DISABLED_KEY = 'omnivote-sound-disabled';

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    return new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  } catch {
    return null;
  }
}

function playTone(
  ctx: AudioContext,
  frequency: number,
  duration: number,
  type: OscillatorType = 'sine',
  volume = 0.15,
  detune = 0,
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, ctx.currentTime);
  osc.detune.setValueAtTime(detune, ctx.currentTime);
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + duration);
}

function playSound(type: SoundType) {
  if (typeof window === 'undefined') return;
  if (localStorage.getItem(SOUND_DISABLED_KEY) === 'true') return;

  const ctx = getAudioContext();
  if (!ctx) return;

  // Resume if suspended (autoplay policy)
  if (ctx.state === 'suspended') ctx.resume();

  const now = ctx.currentTime;

  switch (type) {
    case 'notification':
      // Two-tone ascending chime
      playTone(ctx, 880, 0.12, 'sine', 0.12);
      setTimeout(() => playTone(ctx, 1100, 0.15, 'sine', 0.1), 120);
      break;

    case 'critical':
      // Urgent three-tone alert
      playTone(ctx, 600, 0.1, 'square', 0.08);
      setTimeout(() => playTone(ctx, 600, 0.1, 'square', 0.08), 150);
      setTimeout(() => playTone(ctx, 800, 0.2, 'square', 0.1), 300);
      break;

    case 'success':
      // Pleasant ascending arpeggio
      playTone(ctx, 523, 0.1, 'sine', 0.1); // C5
      setTimeout(() => playTone(ctx, 659, 0.1, 'sine', 0.1), 80); // E5
      setTimeout(() => playTone(ctx, 784, 0.15, 'sine', 0.1), 160); // G5
      break;

    case 'click':
      // Subtle click
      playTone(ctx, 1200, 0.03, 'sine', 0.04);
      break;

    case 'message':
      // Chat message ping — friendly two-tone
      playTone(ctx, 700, 0.08, 'sine', 0.1);
      setTimeout(() => playTone(ctx, 900, 0.12, 'sine', 0.08), 100);
      break;

    case 'victory':
      // Triumphant fanfare
      playTone(ctx, 523, 0.15, 'sine', 0.12); // C5
      setTimeout(() => playTone(ctx, 659, 0.15, 'sine', 0.12), 120); // E5
      setTimeout(() => playTone(ctx, 784, 0.15, 'sine', 0.12), 240); // G5
      setTimeout(() => playTone(ctx, 1047, 0.3, 'sine', 0.15), 360); // C6
      break;

    default:
      break;
  }
}

// ─── Haptic feedback (vibration API) ──────────────────────────────────────────

function vibrate(pattern: number | number[]) {
  if (typeof navigator === 'undefined' || !navigator.vibrate) return;
  navigator.vibrate(pattern);
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useSound() {
  const soundEnabledRef = useRef(true);
  const prevTabRef = useRef<string>('');
  const { isAuthenticated, activeTab } = useDashboardStore();

  // Check stored preference
  useEffect(() => {
    soundEnabledRef.current = localStorage.getItem(SOUND_DISABLED_KEY) !== 'true';
  }, []);

  // Play click sound on tab change
  useEffect(() => {
    if (!isAuthenticated || !prevTabRef.current) {
      prevTabRef.current = activeTab;
      return;
    }
    if (activeTab !== prevTabRef.current) {
      playSound('click');
      prevTabRef.current = activeTab;
    }
  }, [activeTab, isAuthenticated]);

  const play = useCallback((type: SoundType) => {
    playSound(type);
  }, []);

  const haptic = useCallback((type: 'light' | 'medium' | 'heavy') => {
    switch (type) {
      case 'light': vibrate(10); break;
      case 'medium': vibrate([20, 10, 20]); break;
      case 'heavy': vibrate([30, 10, 30, 10, 50]); break;
    }
  }, []);

  const toggleSound = useCallback(() => {
    soundEnabledRef.current = !soundEnabledRef.current;
    localStorage.setItem(SOUND_DISABLED_KEY, String(!soundEnabledRef.current));
    return soundEnabledRef.current;
  }, []);

  const isSoundEnabled = useCallback(() => {
    return localStorage.getItem(SOUND_DISABLED_KEY) !== 'true';
  }, []);

  return { play, haptic, toggleSound, isSoundEnabled };
}
