import type { Where } from "payload";

import { actionFromActivityType } from "./map";

export type ActivityFeedFilters = {
  userId?: string | null;
  type?: string | null;
  resourceType?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  limit?: number;
  offset?: number;
};

export function parseActivityFeedParams(
  searchParams: URLSearchParams,
): ActivityFeedFilters {
  const limitRaw = Number.parseInt(searchParams.get("limit") || "50", 10);
  const offsetRaw = Number.parseInt(searchParams.get("offset") || "0", 10);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 50;
  const offset = Number.isFinite(offsetRaw) ? Math.max(offsetRaw, 0) : 0;

  return {
    userId: searchParams.get("userId") || searchParams.get("user"),
    type: searchParams.get("type") || searchParams.get("action"),
    resourceType: searchParams.get("resourceType") || searchParams.get("entityType"),
    dateFrom: searchParams.get("dateFrom") || searchParams.get("startDate"),
    dateTo: searchParams.get("dateTo") || searchParams.get("endDate"),
    limit,
    offset,
  };
}

export function buildActivityFeedWhere(
  organisationId: string,
  filters: ActivityFeedFilters,
): Where {
  const and: Where[] = [{ organisation: { equals: organisationId } }];

  if (filters.userId) {
    and.push({ actor: { equals: filters.userId } });
  }

  if (filters.type) {
    and.push({ action: { equals: actionFromActivityType(filters.type) } });
  }

  if (filters.resourceType) {
    and.push({ entityType: { equals: filters.resourceType } });
  }

  if (filters.dateFrom || filters.dateTo) {
    and.push({
      createdAt: {
        ...(filters.dateFrom ? { greater_than_equal: filters.dateFrom } : {}),
        ...(filters.dateTo ? { less_than_equal: filters.dateTo } : {}),
      },
    });
  }

  return { and };
}
