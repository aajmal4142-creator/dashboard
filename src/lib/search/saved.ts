import { isSearchResultType, type SearchResultType } from "@/lib/search/types";

export type SavedSearchConditions = {
  query: string;
  type: SearchResultType | null;
};

export type SavedSearchSummary = {
  id: string;
  name: string;
  query: string;
  type: SearchResultType | null;
  createdAt: string;
  isOwner: boolean;
};

const MAX_NAME = 80;
const MAX_QUERY = 100;

export function normalizeSavedSearchConditions(
  raw: unknown,
): { ok: true; data: SavedSearchConditions } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "filterConditions must be an object." };
  }
  const obj = raw as Record<string, unknown>;
  const query =
    typeof obj.query === "string"
      ? obj.query.trim().slice(0, MAX_QUERY)
      : typeof obj.q === "string"
        ? obj.q.trim().slice(0, MAX_QUERY)
        : "";
  if (query.length < 2) {
    return { ok: false, error: "Query must be at least 2 characters." };
  }

  let type: SearchResultType | null = null;
  if (obj.type != null && obj.type !== "" && obj.type !== "all") {
    const t = String(obj.type).trim().toLowerCase();
    if (!isSearchResultType(t)) {
      return { ok: false, error: "Invalid search type." };
    }
    type = t;
  }

  return { ok: true, data: { query, type } };
}

export function normalizeSavedSearchName(
  raw: unknown,
): { ok: true; name: string } | { ok: false; error: string } {
  if (typeof raw !== "string" || !raw.trim()) {
    return { ok: false, error: "Name is required." };
  }
  return { ok: true, name: raw.trim().slice(0, MAX_NAME) };
}

export function conditionsFromQuery(
  query: string,
  type: SearchResultType | "all" | null,
): SavedSearchConditions {
  return {
    query: query.trim().slice(0, MAX_QUERY),
    type: type && type !== "all" && isSearchResultType(type) ? type : null,
  };
}
