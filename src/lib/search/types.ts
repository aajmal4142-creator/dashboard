export const SEARCH_TYPES = [
  "datapoint",
  "report",
  "supplier",
  "compliance",
  "evidence",
] as const;

export type SearchResultType = (typeof SEARCH_TYPES)[number];

export type SearchResult = {
  id: string;
  type: SearchResultType;
  title: string;
  preview: string;
  href: string;
};

export type SearchResponse = {
  results: SearchResult[];
  totalCount: number;
  tookMs: number;
};

export type RecentSearch = {
  query: string;
  type: SearchResultType | null;
  at: string;
};

export function isSearchResultType(value: string): value is SearchResultType {
  return (SEARCH_TYPES as readonly string[]).includes(value);
}
