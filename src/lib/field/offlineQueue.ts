/**
 * Offline field queue — IndexedDB, zero server I/O.
 * Sync flushes to POST /api/app/data/ingest (+ optional evidence).
 */

const DB_NAME = "clearesg-field-queue";
const STORE = "pending";
const DB_VERSION = 1;

export type FieldQueueItem = {
  id: string;
  createdAt: string;
  metricKey: string;
  value: number;
  unit: string;
  quality: "measured" | "calculated" | "estimated" | "missing";
  note?: string;
  meterId?: string;
  /** Base64 evidence blob (optional camera capture) */
  evidenceDataUrl?: string;
  evidenceFileName?: string;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
  });
}

export async function listFieldQueue(): Promise<FieldQueueItem[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => {
      const rows = (req.result as FieldQueueItem[]) ?? [];
      rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      resolve(rows);
    };
    req.onerror = () => reject(req.error ?? new Error("list failed"));
  });
}

export async function enqueueFieldItem(
  item: Omit<FieldQueueItem, "id" | "createdAt"> & { id?: string },
): Promise<FieldQueueItem> {
  const row: FieldQueueItem = {
    ...item,
    id: item.id ?? `fq_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
  };
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(row);
    tx.oncomplete = () => resolve(row);
    tx.onerror = () => reject(tx.error ?? new Error("enqueue failed"));
  });
}

export async function removeFieldItem(id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("remove failed"));
  });
}

export async function clearFieldQueue(): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("clear failed"));
  });
}

/** Register field service worker when supported. */
export function registerFieldServiceWorker(): void {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  void navigator.serviceWorker.register("/sw-field.js").catch(() => {
    /* non-blocking */
  });
}
