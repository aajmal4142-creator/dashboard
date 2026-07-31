import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import {
  listReportEmbedTokens,
  mintReportShareLink,
} from "@/lib/reports/htmlReportShare";
import { clampShareTtlDays, SHARE_TOKEN_TTL_DAYS } from "@/lib/reports/htmlReport";
import type { ReportSnapshot } from "@/lib/reports";
import { requirePermission } from "@/lib/policy/protect";
import config from "@/payload.config";

type Ctx = { params: Promise<{ id: string }> };

function clientMeta(req: Request) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    null;
  const userAgent = req.headers.get("user-agent");
  return { ip, userAgent };
}

async function loadOwnedReport(reportId: string, organisationId: string) {
  const payload = await getPayload({ config });
  let report;
  try {
    report = await payload.findByID({
      collection: "reports",
      id: reportId,
      depth: 0,
      overrideAccess: true,
    });
  } catch {
    return { ok: false as const, status: 404 as const, error: "Not found" };
  }

  const orgId =
    typeof report.organisation === "object" && report.organisation !== null
      ? report.organisation.id
      : String(report.organisation);
  if (orgId !== organisationId) {
    return { ok: false as const, status: 404 as const, error: "Not found" };
  }

  const snapshot = report.snapshot as ReportSnapshot | null;
  if (!snapshot) {
    return {
      ok: false as const,
      status: 409 as const,
      error: "Report has no snapshot",
    };
  }

  return { ok: true as const, payload, report, snapshot };
}

/**
 * GET /api/app/reports/[id]/embed-token
 * List active embed tokens for this report.
 */
export async function GET(req: Request, ctx: Ctx) {
  const auth = await getCurrentContext();
  if (!auth.activeOrg) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const allowed = await requirePermission(
    auth.user.id,
    auth.activeOrg.id,
    "view",
    "report",
    auth.activeOrg.id,
    "organisation",
  );
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const loaded = await loadOwnedReport(id, auth.activeOrg.id);
  if (!loaded.ok) {
    return NextResponse.json({ error: loaded.error }, { status: loaded.status });
  }

  const includeInactive = new URL(req.url).searchParams.get("includeInactive") === "1";
  const tokens = await listReportEmbedTokens(loaded.payload, {
    reportId: id,
    organisationId: auth.activeOrg.id,
    origin: req.url,
    includeInactive,
  });

  return NextResponse.json({
    tokens,
    defaultTtlDays: SHARE_TOKEN_TTL_DAYS,
  });
}

/**
 * POST /api/app/reports/[id]/embed-token
 * Generate a cryptographically opaque embed token (default 7-day TTL).
 * Body: { ttlDays?: number }
 */
export async function POST(req: Request, ctx: Ctx) {
  const auth = await getCurrentContext();
  if (!auth.activeOrg) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const allowed = await requirePermission(
    auth.user.id,
    auth.activeOrg.id,
    "view",
    "report",
    auth.activeOrg.id,
    "organisation",
  );
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const loaded = await loadOwnedReport(id, auth.activeOrg.id);
  if (!loaded.ok) {
    return NextResponse.json({ error: loaded.error }, { status: loaded.status });
  }

  let ttlDays = SHARE_TOKEN_TTL_DAYS;
  try {
    const body = (await req.json()) as { ttlDays?: number };
    if (body.ttlDays != null) ttlDays = clampShareTtlDays(body.ttlDays);
  } catch {
    /* empty body ok */
  }

  const { ip, userAgent } = clientMeta(req);
  const minted = await mintReportShareLink(loaded.payload, {
    reportId: id,
    organisationId: auth.activeOrg.id,
    actorId: auth.user.id,
    origin: req.url,
    ip,
    userAgent,
    ttlDays,
  });

  if (!minted.ok) {
    return NextResponse.json({ error: minted.error }, { status: minted.status });
  }

  return NextResponse.json({
    token: minted.result.token,
    tokenId: minted.result.tokenId,
    shareUrl: minted.result.shareUrl,
    embedUrl: minted.result.embedUrl,
    embedCode: minted.result.embedCode,
    expiresAt: minted.result.expiresAt,
    ttlDays: minted.result.ttlDays,
    generatedAt: new Date().toISOString(),
  });
}
