import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import {
  buildOrgTextWhere,
  looksLikeMetricKey,
  mapComplianceAssessmentToResult,
  mapComplianceObligationToResult,
  mapDatapointToResult,
  mapEvidenceToResult,
  mapReportToResult,
  mapSupplierToResult,
  mergeSearchResults,
  parseSearchParams,
  perTypeLimit,
  resolveSearchPhases,
  SEARCH_FIELDS,
  SEARCH_SELECT,
  type SearchResult,
  type SearchResultType,
} from "@/lib/search";
import config from "@/payload.config";

export async function GET(req: Request) {
  const started = Date.now();
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg || !ctx.role) {
    return NextResponse.json(
      { error: "No active organisation. Finish onboarding or switch organisation." },
      { status: 403 },
    );
  }

  const orgId = ctx.activeOrg.id;
  const { q, type, limit } = parseSearchParams(new URL(req.url));

  if (q.length < 2) {
    return NextResponse.json({
      results: [] as SearchResult[],
      totalCount: 0,
      tookMs: Date.now() - started,
    });
  }

  const { primary, secondary } = resolveSearchPhases(type);
  const payload = await getPayload({ config });

  const primarySize = perTypeLimit(limit, primary.length);
  const primaryGroups = await Promise.all(
    primary.map(async (t): Promise<SearchResult[]> => {
      try {
        return await searchType(payload, orgId, q, t, primarySize);
      } catch (err) {
        console.error(`[search] ${t} failed`, err);
        return [];
      }
    }),
  );

  let groups = primaryGroups;
  const mergedPrimary = mergeSearchResults(primaryGroups, limit);

  if (secondary.length > 0 && mergedPrimary.results.length < limit) {
    const remaining = limit - mergedPrimary.results.length;
    const secondarySize = perTypeLimit(remaining, secondary.length);
    const secondaryGroups = await Promise.all(
      secondary.map(async (t): Promise<SearchResult[]> => {
        try {
          return await searchType(payload, orgId, q, t, secondarySize);
        } catch (err) {
          console.error(`[search] ${t} failed`, err);
          return [];
        }
      }),
    );
    groups = [...primaryGroups, ...secondaryGroups];
  }

  const { results, totalCount } = mergeSearchResults(groups, limit);

  return NextResponse.json({
    results,
    totalCount,
    tookMs: Date.now() - started,
  });
}

async function searchType(
  payload: Awaited<ReturnType<typeof getPayload>>,
  orgId: string,
  q: string,
  type: SearchResultType,
  limit: number,
): Promise<SearchResult[]> {
  switch (type) {
    case "datapoint": {
      const equalsFields = looksLikeMetricKey(q) ? (["metricKey"] as const) : [];
      const found = await payload.find({
        collection: "datapoints",
        where: buildOrgTextWhere(orgId, q, SEARCH_FIELDS.datapoint, {
          equalsFields,
        }),
        limit,
        depth: 0,
        overrideAccess: true,
        sort: "-updatedAt",
        select: SEARCH_SELECT.datapoint,
      });
      return found.docs.map((d) => mapDatapointToResult(d));
    }
    case "report": {
      const found = await payload.find({
        collection: "reports",
        where: buildOrgTextWhere(orgId, q, SEARCH_FIELDS.report),
        limit,
        depth: 0,
        overrideAccess: true,
        sort: "-updatedAt",
        select: SEARCH_SELECT.report,
      });
      return found.docs.map((d) => mapReportToResult(d));
    }
    case "supplier": {
      const found = await payload.find({
        collection: "suppliers",
        where: buildOrgTextWhere(orgId, q, SEARCH_FIELDS.supplier),
        limit,
        depth: 0,
        overrideAccess: true,
        sort: "-updatedAt",
        select: SEARCH_SELECT.supplier,
      });
      return found.docs.map((d) => mapSupplierToResult(d));
    }
    case "compliance": {
      const half = Math.max(2, Math.ceil(limit / 2));
      const [assessments, obligations] = await Promise.all([
        payload.find({
          collection: "compliance-assessments",
          where: buildOrgTextWhere(orgId, q, SEARCH_FIELDS.complianceAssessment),
          limit: half,
          depth: 0,
          overrideAccess: true,
          sort: "-updatedAt",
          select: SEARCH_SELECT.complianceAssessment,
        }),
        payload.find({
          collection: "compliance-obligations",
          where: buildOrgTextWhere(orgId, q, SEARCH_FIELDS.complianceObligation),
          limit: half,
          depth: 0,
          overrideAccess: true,
          sort: "-updatedAt",
          select: SEARCH_SELECT.complianceObligation,
        }),
      ]);
      return [
        ...assessments.docs.map((d) => mapComplianceAssessmentToResult(d)),
        ...obligations.docs.map((d) => mapComplianceObligationToResult(d)),
      ];
    }
    case "evidence": {
      const found = await payload.find({
        collection: "evidence",
        where: buildOrgTextWhere(orgId, q, SEARCH_FIELDS.evidence),
        limit,
        depth: 0,
        overrideAccess: true,
        sort: "-updatedAt",
        select: SEARCH_SELECT.evidence,
      });
      return found.docs.map((d) => mapEvidenceToResult(d));
    }
    default: {
      const _exhaustive: never = type;
      return _exhaustive;
    }
  }
}
