import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext, type AuthContext } from "@/lib/auth";
import {
  BillingDeniedError,
  billingDeniedResponse,
  can,
  normalizePlan,
} from "@/lib/billing";
import {
  applySnapshotPlan,
  captureBeforeSnapshot,
  planUndoApply,
} from "@/lib/bulk/execute";
import { parseBulkSnapshot } from "@/lib/bulk/snapshot";
import { isBulkUpdateChangesPayload, writeDatapointById } from "@/lib/data";
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
 * POST — apply a pending bulk CSV update by bulkUpdateId.
 * On failure mid-apply, restores beforeSnapshot (rollback).
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

  let body: { bulkUpdateId?: string; proceed?: boolean };
  try {
    body = (await req.json()) as { bulkUpdateId?: string; proceed?: boolean };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.bulkUpdateId || typeof body.bulkUpdateId !== "string") {
    return NextResponse.json({ error: "bulkUpdateId required" }, { status: 400 });
  }
  if (body.proceed !== true) {
    return NextResponse.json(
      { error: "Set proceed: true to apply the previewed update" },
      { status: 400 },
    );
  }

  const payload = await getPayload({ config });
  const op = await payload.findByID({
    collection: "bulk-operations",
    id: body.bulkUpdateId,
    depth: 0,
    overrideAccess: true,
  });

  const orgId =
    typeof op.organisation === "object" && op.organisation
      ? String(op.organisation.id)
      : String(op.organisation);

  if (orgId !== ctx.activeOrg!.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const actorId =
    typeof op.actor === "object" && op.actor ? String(op.actor.id) : String(op.actor);
  if (actorId !== ctx.user.id && ctx.role !== "owner" && ctx.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (op.operationType !== "update" || op.resourceType !== "datapoints") {
    return NextResponse.json(
      { error: "Not a datapoint bulk CSV update operation" },
      { status: 400 },
    );
  }

  if (op.status !== "pending") {
    return NextResponse.json(
      {
        error:
          op.status === "completed"
            ? "This bulk update was already applied"
            : `Cannot apply bulk update in status ${op.status}`,
      },
      { status: 409 },
    );
  }

  if (!isBulkUpdateChangesPayload(op.changes)) {
    return NextResponse.json(
      { error: "Bulk update has no valid csv-value-update rows" },
      { status: 400 },
    );
  }

  const rows = op.changes.rows;
  if (rows.length === 0) {
    return NextResponse.json({ error: "Nothing to apply" }, { status: 400 });
  }

  const beforeSnapshot = parseBulkSnapshot(op.beforeSnapshot);

  await payload.update({
    collection: "bulk-operations",
    id: op.id,
    data: { status: "processing", progressPercent: 0 },
    overrideAccess: true,
  });

  const errors: Array<{ datapointId: string; error: string }> = [];
  let updated = 0;
  let approvalResets = 0;

  try {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const result = await writeDatapointById(payload, {
          organisationId: ctx.activeOrg!.id,
          datapointId: row.datapointId,
          value: row.value,
          quality: row.quality,
          unit: row.unit,
          source: "import",
          actorId: ctx.user.id,
          reason: row.reason,
        });
        updated += 1;
        if (result.approvalReset) approvalResets += 1;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Update failed";
        errors.push({ datapointId: row.datapointId, error: message });
        throw err;
      }
      const pct = Math.round(((i + 1) / rows.length) * 100);
      await payload.update({
        collection: "bulk-operations",
        id: op.id,
        data: { progressPercent: pct },
        overrideAccess: true,
      });
    }

    const itemIds = rows.map((r) => r.datapointId);
    const afterSnapshot = await captureBeforeSnapshot(
      payload,
      "datapoints",
      itemIds,
      ctx.activeOrg!.id,
    );

    const completed = await payload.update({
      collection: "bulk-operations",
      id: op.id,
      data: {
        status: "completed",
        progressPercent: 100,
        afterSnapshot,
        canUndo: true,
        canRedo: false,
        errorMessage: null,
      },
      overrideAccess: true,
    });

    return NextResponse.json({
      ok: true,
      updated,
      approvalResets,
      errors: [],
      bulkUpdateId: completed.id,
      canUndo: true,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bulk update failed";

    let rolledBack = false;
    let rollbackFailed = false;
    let rollbackMessage: string | null = null;

    if (beforeSnapshot && beforeSnapshot.length > 0) {
      try {
        await applySnapshotPlan(
          payload,
          "datapoints",
          planUndoApply("update", beforeSnapshot),
        );
        rolledBack = true;
      } catch (rollbackErr) {
        rollbackFailed = true;
        rollbackMessage =
          rollbackErr instanceof Error ? rollbackErr.message : "Rollback failed";
      }
    }

    await payload.update({
      collection: "bulk-operations",
      id: op.id,
      data: {
        status: "failed",
        errorMessage: rollbackFailed
          ? `${message}. Rollback also failed: ${rollbackMessage}`
          : rolledBack
            ? `${message}. Changes rolled back from beforeSnapshot.`
            : message,
        canUndo: false,
        progressPercent: 0,
      },
      overrideAccess: true,
    });

    return NextResponse.json(
      {
        error: message,
        rolledBack,
        rollbackFailed,
        updated: rolledBack ? 0 : updated,
        errors,
      },
      { status: 500 },
    );
  }
}
