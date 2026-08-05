import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext, isNextRedirectError } from "@/lib/auth";
import {
  buildOffsetClaimPack,
  buildResidualLedgerSummary,
  listOrgPeriods,
  parseOptionalNonNeg,
} from "@/lib/offsets";
import { requirePermission } from "@/lib/policy/protect";
import config from "@/payload.config";

/**
 * GET /api/app/compliance/residual/summary
 * Query: periodId?, grossInventoryTco2e?, reductionsTco2e?
 *
 * Net position = inventory − reductions − retired credits.
 * Missing gross / reductions → quality missing (never silent zero).
 */
export async function GET(req: Request) {
  try {
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

    const url = new URL(req.url);
    const periodId = url.searchParams.get("periodId");
    const grossRaw = url.searchParams.get("grossInventoryTco2e");
    const reductionsRaw = url.searchParams.get("reductionsTco2e");

    if (grossRaw !== null && grossRaw !== "" && parseOptionalNonNeg(grossRaw) === null) {
      return NextResponse.json(
        { error: "grossInventoryTco2e must be a non-negative number when provided" },
        { status: 400 },
      );
    }
    if (
      reductionsRaw !== null &&
      reductionsRaw !== "" &&
      parseOptionalNonNeg(reductionsRaw) === null
    ) {
      return NextResponse.json(
        { error: "reductionsTco2e must be a non-negative number when provided" },
        { status: 400 },
      );
    }

    const payload = await getPayload({ config });
    const [summary, periods] = await Promise.all([
      buildResidualLedgerSummary(payload, ctx.activeOrg.id, {
        periodId: periodId || null,
        grossInventoryTco2e: parseOptionalNonNeg(grossRaw),
        reductionsTco2e: parseOptionalNonNeg(reductionsRaw),
      }),
      listOrgPeriods(payload, ctx.activeOrg.id),
    ]);

    const includePack =
      url.searchParams.get("pack") === "1" ||
      url.searchParams.get("pack") === "true" ||
      url.searchParams.get("pack") === "yes";

    const pack = includePack
      ? buildOffsetClaimPack({
          lots: summary.credits.map((c) => ({
            id: c.id,
            label: c.label,
            status: c.status,
            volumeTco2e: c.volumeTco2e,
            registryName: c.registryName,
            serial: c.serial,
            projectName: c.projectName,
            projectId: c.projectId,
            methodology: c.methodology,
          })),
          residualTco2e: summary.position.residualTco2e,
          retiredOffsetsTco2e: summary.position.retiredOffsetsTco2e,
          periodLabel: summary.periodLabel,
        })
      : null;

    return NextResponse.json({ ...summary, periods, pack: pack ?? undefined });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Residual summary error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
