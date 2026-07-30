import { getPayload } from "payload";
import { NextResponse } from "next/server";
import { getCurrentContext, isNextRedirectError } from "@/lib/auth";
import { requirePermission } from "@/lib/policy/protect";
import config from "@/payload.config";
import {
  mapToSpendLedgerCategory,
  validateSpendData,
  type SpendEmissionsInput,
} from "@/lib/calc/spendBasedEmissions";
import {
  calculateSpendBasedEmissionsForInput,
  commitSpendBatch,
} from "@/lib/emissions/spendBasedService";
import { incrementApiUsage } from "@/lib/billing/freeTierGates";

/**
 * POST /api/app/emissions/calculate-spend
 * Body: SpendEmissionsInput & { commit?: boolean; periodId?: string }
 * Default commit=false (preview). Set commit=true to persist.
 */
export async function POST(request: Request) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const allowed = await requirePermission(
      ctx.user.id,
      ctx.activeOrg.id,
      "create",
      "datapoints",
      ctx.activeOrg.id,
      "organisation",
    );
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = (await request.json()) as SpendEmissionsInput & {
      commit?: boolean;
      periodId?: string;
      writeDatapoints?: boolean;
    };

    const validation = validateSpendData(body);
    if (!validation.valid) {
      return NextResponse.json(
        { error: "Validation failed", errors: validation.errors },
        { status: 400 },
      );
    }

    const ledger = mapToSpendLedgerCategory(body.category);
    const input: SpendEmissionsInput = { ...body, category: ledger };

    if (!body.commit) {
      const result = await calculateSpendBasedEmissionsForInput(input, ctx.activeOrg.id);
      await incrementApiUsage(ctx.activeOrg.id);
      return NextResponse.json({
        mode: "preview",
        result,
        quality: "estimated",
        provenance: "spend_estimate",
      });
    }

    const committed = await commitSpendBatch(ctx.activeOrg.id, [input], {
      actorId: ctx.user.id,
      periodId: body.periodId,
      writeDatapoints: Boolean(body.writeDatapoints && body.periodId),
    });

    await incrementApiUsage(ctx.activeOrg.id);

    return NextResponse.json({
      mode: "commit",
      result: committed.preview[0]?.result,
      createdId: committed.createdIds[0],
      datapointId: committed.datapointIds[0] ?? null,
      quality: "estimated",
      provenance: "spend_estimate",
    });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error calculating spend-based emissions:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * GET /api/app/emissions/calculate-spend
 * Recent spend-based emissions calculations for the active org.
 */
export async function GET(_request: Request) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const allowed = await requirePermission(
      ctx.user.id,
      ctx.activeOrg.id,
      "view",
      "datapoints",
      ctx.activeOrg.id,
      "organisation",
    );
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const payload = await getPayload({ config });

    const results = await payload.find({
      collection: "spend-based-emissions",
      where: {
        organisation: { equals: ctx.activeOrg.id },
      },
      sort: "-createdAt",
      limit: 50,
      overrideAccess: true,
    });

    await incrementApiUsage(ctx.activeOrg.id);

    return NextResponse.json({
      total: results.totalDocs,
      calculations: results.docs,
    });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error fetching spend-based emissions:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
