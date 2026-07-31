import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext, type AuthContext } from "@/lib/auth";
import {
  BillingDeniedError,
  billingDeniedResponse,
  can,
  normalizePlan,
} from "@/lib/billing";
import { captureBeforeSnapshot } from "@/lib/bulk/execute";
import {
  applyRowsFromPreview,
  parseBulkUpdateCsv,
  previewBulkUpdate,
  type ExistingDatapointById,
} from "@/lib/data";
import type { Quality } from "@/lib/calc";
import { ensureOpenPeriod } from "@/lib/org/period";
import { requirePermission } from "@/lib/policy/protect";
import config from "@/payload.config";

async function requireBulkUpdateContext(): Promise<
  { ctx: AuthContext } | { response: NextResponse }
> {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg || !ctx.user || !ctx.role) {
    return {
      response: NextResponse.json(
        {
          error: "No active organisation. Finish onboarding or switch organisation.",
        },
        { status: 403 },
      ),
    };
  }
  if (ctx.role === "viewer") {
    return {
      response: NextResponse.json(
        { error: "Viewers cannot update datapoints" },
        { status: 403 },
      ),
    };
  }
  if (!can(ctx.activeOrg.plan, "bulk_actions")) {
    return {
      response: NextResponse.json(
        billingDeniedResponse(
          new BillingDeniedError(normalizePlan(ctx.activeOrg.plan), "bulk_actions"),
        ),
        { status: 402 },
      ),
    };
  }
  return { ctx };
}

/**
 * POST — parse CSV and return a preview. Creates a pending bulk-operation
 * when there is at least one change to apply. Distinct from /data/import (create).
 */
export async function POST(req: Request) {
  const gate = await requireBulkUpdateContext();
  if ("response" in gate) return gate.response;
  const { ctx } = gate;

  const allowed = await requirePermission(
    ctx.user.id,
    ctx.activeOrg!.id,
    "edit",
    "datapoint",
    ctx.activeOrg!.id,
    "organisation",
  );
  if (!allowed) {
    return NextResponse.json(
      { error: "Permission denied: you do not have permission to update datapoints" },
      { status: 403 },
    );
  }

  const contentType = req.headers.get("content-type") ?? "";
  let csvText = "";

  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json({ error: "file required" }, { status: 400 });
      }
      const name = file.name.toLowerCase();
      if (!name.endsWith(".csv") && file.type !== "text/csv") {
        return NextResponse.json(
          { error: "Bulk update accepts CSV only (use import for create-by-metric)" },
          { status: 400 },
        );
      }
      csvText = await file.text();
    } else {
      const body = (await req.json()) as { csv?: string };
      if (typeof body.csv !== "string" || !body.csv.trim()) {
        return NextResponse.json({ error: "csv required" }, { status: 400 });
      }
      csvText = body.csv;
    }
  } catch {
    return NextResponse.json(
      { error: "Could not parse bulk-update payload" },
      { status: 400 },
    );
  }

  let parsed;
  try {
    parsed = parseBulkUpdateCsv(csvText);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid CSV";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (parsed.length === 0) {
    return NextResponse.json(
      { error: "CSV has no data rows", validated: 0, preview: [] },
      { status: 400 },
    );
  }

  let periodId: string;
  try {
    periodId = await ensureOpenPeriod(
      ctx.activeOrg!.id,
      ctx.activeOrg!.plan,
      ctx.activeOrg!.subscriptionStatus,
    );
  } catch (err) {
    if (err instanceof BillingDeniedError) {
      return NextResponse.json(billingDeniedResponse(err), { status: 402 });
    }
    throw err;
  }

  const payload = await getPayload({ config });
  const period = await payload.findByID({
    collection: "reporting-periods",
    id: periodId,
    depth: 0,
    overrideAccess: true,
  });
  const periodLocked = period.status !== "open";

  const ids = [...new Set(parsed.map((r) => r.datapointId.trim()).filter(Boolean))];
  const found =
    ids.length === 0
      ? {
          docs: [] as Array<{
            id: string;
            metricKey: string;
            value?: number | null;
            unit?: string | null;
            quality: string;
            approvalState?: string | null;
          }>,
        }
      : await payload.find({
          collection: "datapoints",
          where: {
            and: [{ organisation: { equals: ctx.activeOrg!.id } }, { id: { in: ids } }],
          },
          limit: Math.min(ids.length, 500),
          depth: 0,
          overrideAccess: true,
        });

  const existing: ExistingDatapointById[] = found.docs.map((d) => ({
    id: String(d.id),
    metricKey: d.metricKey,
    value: typeof d.value === "number" ? d.value : null,
    unit: d.unit ?? null,
    quality: d.quality as Quality,
    approvalState: d.approvalState ?? null,
  }));

  const preview = previewBulkUpdate({
    rows: parsed,
    existing,
    periodLocked,
  });

  const applyRows = applyRowsFromPreview(preview);
  if (applyRows.length === 0) {
    return NextResponse.json({
      ok: true,
      bulkUpdateId: null,
      validated: preview.validated,
      changed: preview.changed,
      unchanged: preview.unchanged,
      rejected: preview.rejected,
      periodLocked: preview.periodLocked,
      preview: preview.rows,
      message:
        preview.rejected > 0 && preview.changed === 0
          ? "Nothing to apply — all rows rejected or unchanged"
          : "No changes to apply",
    });
  }

  const itemIds = applyRows.map((r) => r.datapointId);
  const beforeSnapshot = await captureBeforeSnapshot(
    payload,
    "datapoints",
    itemIds,
    ctx.activeOrg!.id,
  );

  const bulkOp = await payload.create({
    collection: "bulk-operations",
    data: {
      organisation: ctx.activeOrg!.id,
      actor: ctx.user.id,
      operationType: "update",
      resourceType: "datapoints",
      itemIds,
      itemCount: itemIds.length,
      changes: {
        kind: "csv-value-update",
        rows: applyRows,
      },
      beforeSnapshot,
      status: "pending",
      progressPercent: 0,
      canUndo: false,
      canRedo: false,
    },
  });

  return NextResponse.json({
    ok: true,
    bulkUpdateId: bulkOp.id,
    validated: preview.validated,
    changed: preview.changed,
    unchanged: preview.unchanged,
    rejected: preview.rejected,
    periodLocked: preview.periodLocked,
    preview: preview.rows,
  });
}
