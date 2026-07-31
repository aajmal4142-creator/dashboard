const STORAGE_KEY = "clearesg-tours-completed";

function readIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === "string");
  } catch {
    return [];
  }
}

function writeIds(ids: string[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...new Set(ids)]));
  } catch {
    /* quota / private mode — ignore */
  }
}

export function getCompletedTourIds(): string[] {
  return readIds();
}

export function isTourCompleted(tourId: string): boolean {
  return readIds().includes(tourId);
}

export function markTourCompleted(tourId: string): void {
  const next = readIds();
  if (!next.includes(tourId)) {
    next.push(tourId);
    writeIds(next);
  }
}

export function clearTourCompleted(tourId: string): void {
  writeIds(readIds().filter((id) => id !== tourId));
}

export function clearAllTourCompletions(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** Test helper — parse stored JSON without touching window. */
export function parseCompletedTourIds(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === "string");
  } catch {
    return [];
  }
}
