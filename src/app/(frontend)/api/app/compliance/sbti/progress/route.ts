import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import { buildTargetProgress, listOrgSbtiTargets, relationId } from "@/lib/compliance";
import { requirePermission } from "@/lib/policy/protect";
import config from "@/payload.config";

/**
 * GET /api/app/compliance/sbti/progress — dashboard: all targets + progress + scenarios
 */
export async function GET() {
  const ctx = await getCurrentContext();
  if (!ctx.user || !ctx.activeOrg) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allowed = await requirePermission(
    ctx.user.id,
    ctx.activeOrg.id,
    "view",
    "compliance",
    ctx.activeOrg.id,
    "organisation",
  );
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const payload = await getPayload({ config });
  const targets = await listOrgSbtiTargets(payload, ctx.activeOrg.id);

  const org = await payload.findByID({
    collection: "organisations",
    id: ctx.activeOrg.id,
    depth: 0,
    overrideAccess: true,
  });

  const activeTargetId = relationId(
    org.sbti && typeof org.sbti === "object" ? org.sbti.activeTarget : null,
  );

  const rows = await Promise.all(
    targets.map((target) =>
      buildTargetProgress({
        payload,
        organisationId: ctx.activeOrg!.id,
        orgName: ctx.activeOrg!.name,
        target,
        includeScenarios: true,
      }),
    ),
  );

  const primary = rows.find((r) => r.target.id === activeTargetId) ?? rows[0] ?? null;

  const summary = {
    totalTargets: rows.length,
    draft: rows.filter((r) => r.target.status === "draft").length,
    submitted: rows.filter((r) => r.target.status === "submitted").length,
    validated: rows.filter((r) => r.target.status === "validated").length,
    approved: rows.filter((r) => r.target.status === "approved").length,
    onTrackGreen: rows.filter((r) => r.progress.onTrackStatus === "green").length,
    onTrackYellow: rows.filter((r) => r.progress.onTrackStatus === "yellow").length,
    onTrackRed: rows.filter((r) => r.progress.onTrackStatus === "red").length,
  };

  return NextResponse.json({
    summary,
    primary: primary
      ? {
          target: primary.target,
          progress: primary.progress,
          asOfYear: primary.asOfYear,
          currentQuality: primary.currentQuality,
          currentMessage: primary.currentMessage ?? null,
          alignment: primary.alignment,
          registrySearchUrl: primary.registrySearchUrl,
          scenarios: primary.scenarios,
        }
      : null,
    targets: rows.map((row) => ({
      target: row.target,
      progress: row.progress,
      asOfYear: row.asOfYear,
      currentQuality: row.currentQuality,
      currentMessage: row.currentMessage ?? null,
      alignment: row.alignment,
      registrySearchUrl: row.registrySearchUrl,
      scenarios: row.scenarios,
    })),
  });
}
