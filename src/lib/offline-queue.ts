const DB_NAME = 'omnivote-offline';
const STORE_NAME = 'submission-queue';
const MAX_RETRIES = 3;

export interface QueuedSubmission {
  id?: number;
  url: string;
  method: string;
  body: string; // JSON string
  contentType: string;
  createdAt: number;
  retries: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function enqueue(
  submission: Omit<QueuedSubmission, 'id' | 'createdAt' | 'retries'>,
): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const fullItem: QueuedSubmission = {
      ...submission,
      createdAt: Date.now(),
      retries: 0,
    };
    const req = store.add(fullItem);
    req.onsuccess = () => resolve(req.result as number);
    req.onerror = () => reject(req.error);
  });
}

export async function dequeue(): Promise<QueuedSubmission | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.openCursor();
    req.onsuccess = () => {
      if (req.result) {
        resolve(req.result.value as QueuedSubmission);
      } else {
        resolve(null);
      }
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getQueueSize(): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function deleteItem(id: number, db: IDBDatabase): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function getAllItems(): Promise<QueuedSubmission[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function processQueue(): Promise<{ processed: number; failed: number }> {
  let processed = 0;
  let failed = 0;

  while (true) {
    const item = await dequeue();
    if (!item || item.id === undefined) break;

    try {
      const res = await fetch(item.url, {
        method: item.method,
        headers: { 'Content-Type': item.contentType },
        body: item.body,
      });

      if (res.ok) {
        const db = await openDB();
        await deleteItem(item.id, db);
        processed++;
      } else {
        // Non-ok response — retry or discard
        const db = await openDB();
        if (item.retries >= MAX_RETRIES - 1) {
          await deleteItem(item.id, db);
        } else {
          // Increment retry count
          const tx = db.transaction(STORE_NAME, 'readwrite');
          const store = tx.objectStore(STORE_NAME);
          store.put({ ...item, retries: item.retries + 1 });
        }
        failed++;
      }
    } catch {
      // Network error — retry or discard
      const db = await openDB();
      if (item.retries >= MAX_RETRIES - 1) {
        await deleteItem(item.id, db);
      } else {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.put({ ...item, retries: item.retries + 1 });
      }
      failed++;
    }
  }

  return { processed, failed };
}