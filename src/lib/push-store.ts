/**
 * In-memory push subscription store with JSON file persistence.
 * 
 * Stores push subscriptions keyed by tenantId → array of subscriptions.
 * Each subscription includes the PushSubscription JSON plus metadata.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

export interface PushSubscriptionData {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

const DATA_DIR = join(process.cwd(), 'data');
const PERSIST_FILE = join(DATA_DIR, 'push-subscriptions.json');

interface StoredSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  userId: string;
  tenantId: string;
  createdAt: string;
}

// In-memory store: tenantId → StoredSubscription[]
let store: Record<string, StoredSubscription[]> = {};
let loaded = false;

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

function load() {
  if (loaded) return;
  loaded = true;
  try {
    if (existsSync(PERSIST_FILE)) {
      const raw = readFileSync(PERSIST_FILE, 'utf-8');
      const parsed: StoredSubscription[] = JSON.parse(raw);
      for (const sub of parsed) {
        if (!store[sub.tenantId]) store[sub.tenantId] = [];
        store[sub.tenantId].push(sub);
      }
    }
  } catch {
    // Corrupted file — start fresh
    store = {};
  }
}

function persist() {
  try {
    ensureDataDir();
    const all: StoredSubscription[] = Object.values(store).flat();
    writeFileSync(PERSIST_FILE, JSON.stringify(all, null, 2), 'utf-8');
  } catch {
    // Persistence failure is non-fatal
  }
}

/** Add a push subscription for a tenant/user */
export function addSubscription(
  tenantId: string,
  userId: string,
  sub: PushSubscriptionData,
): void {
  load();

  const stored: StoredSubscription = {
    endpoint: sub.endpoint,
    keys: sub.keys,
    userId,
    tenantId,
    createdAt: new Date().toISOString(),
  };

  if (!store[tenantId]) store[tenantId] = [];

  // Replace if same endpoint already exists (re-subscription)
  const idx = store[tenantId].findIndex((s) => s.endpoint === sub.endpoint);
  if (idx >= 0) {
    store[tenantId][idx] = stored;
  } else {
    store[tenantId].push(stored);
  }

  persist();
}

/** Get all subscriptions for a tenant */
export function getSubscriptions(tenantId: string): PushSubscriptionData[] {
  load();
  const subs = store[tenantId] || [];
  return subs.map(({ endpoint, keys }) => ({ endpoint, keys }));
}

/** Remove a subscription by endpoint */
export function removeSubscription(endpoint: string): void {
  load();
  for (const tenantId of Object.keys(store)) {
    const before = store[tenantId].length;
    store[tenantId] = store[tenantId].filter((s) => s.endpoint !== endpoint);
    if (store[tenantId].length < before) {
      persist();
      return;
    }
  }
}
