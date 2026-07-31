import type { RecentSearch, SearchResultType } from "@/lib/search/types";
import { isSearchResultType } from "@/lib/search/types";

const STORAGE_PREFIX = "clearesg-recent-searches";
const MAX_RECENT = 8;

function storageKey(organisationId: string): string {
  return `${STORAGE_PREFIX}:${organisationId}`;
}

function isRecentSearch(value: unknown): value is RecentSearch {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  if (typeof row.query !== "string" || !row.query.trim()) return false;
  if (typeof row.at !== "string") return false;
  if (row.type !== null && row.type !== undefined) {
    if (typeof row.type !== "string" || !isSearchResultType(row.type)) return false;
  }
  return true;
}

export function loadRecentSearches(organisationId: string): RecentSearch[] {
  if (typeof window === "undefined" || !organisationId) return [];
  try {
    const raw = window.localStorage.getItem(storageKey(organisationId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isRecentSearch).slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

export function pushRecentSearch(
  organisationId: string,
  query: string,
  type: SearchResultType | null = null,
): RecentSearch[] {
  const q = query.trim();
  if (typeof window === "undefined" || !organisationId || q.length < 2) {
    return loadRecentSearches(organisationId);
  }

  const next: RecentSearch = {
    query: q.slice(0, 100),
    type,
    at: new Date().toISOString(),
  };

  const prev = loadRecentSearches(organisationId).filter(
    (r) =>
      !(
        r.query.toLowerCase() === next.query.toLowerCase() &&
        (r.type ?? null) === (next.type ?? null)
      ),
  );

  const list = [next, ...prev].slice(0, MAX_RECENT);
  try {
    window.localStorage.setItem(storageKey(organisationId), JSON.stringify(list));
  } catch {
    // Quota / private mode — ignore; search still works.
  }
  return list;
}

export function clearRecentSearches(organisationId: string): void {
  if (typeof window === "undefined" || !organisationId) return;
  try {
    window.localStorage.removeItem(storageKey(organisationId));
  } catch {
    // ignore
  }
}
