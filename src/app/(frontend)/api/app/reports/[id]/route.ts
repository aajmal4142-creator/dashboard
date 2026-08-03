import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit/write";
import { isEmissionsStandard } from "@/lib/factors";
import { buildReportSnapshot, diffSnapshots, type ReportSnapshot } from "@/lib/reports";
import { requirePermission } from "@/lib/policy/protect";
import config from "@/payload.config";

type Ctx = { params: Promise<{ id: string }> };

function asSnapshot(value: unknown): ReportSnapshot | null {
  if (!value || typeof value !== "object") return null;
  return value as ReportSnapshot;
}

function orgIdOf(value: unknown): string {
  if (typeof value === "object" && value !== null && "id" in value) {
    return String((value as { id: string }).id);
  }
  return String(value);
}

function periodIdOf(value: unknown): string {
  return orgIdOf(value);
}

/**
 * PATCH /api/app/reports/[id]
 * actions: regenerate (draft only) | approve | notes
 */
export async function PATCH(req: Request, ctx: Ctx) {
  const auth = await getCurrentContext();
  if (!auth.activeOrg || !auth.role) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const allowed = await requirePermission(
    auth.user.id,
    auth.activeOrg.id,
    "edit",
    "report",
    auth.activeOrg.id,
    "organisation",
  );
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const body = (await req.json()) as {
    action?: "regenerate" | "approve" | "notes";
    preparerNotes?: string;
    /** Optional override when regenerating under a different methodology. */
    emissionsStandard?: string;
  };
  const action = body.action ?? "notes";

  const payload = await getPayload({ config });
  let report;
  try {
    report = await payload.findByID({
      collection: "reports",
      id,
      depth: 0,
      overrideAccess: true,
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (orgIdOf(report.organisation) !== auth.activeOrg.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (report.status === "published") {
    return NextResponse.json(
      {
        error:
          "Published reports are immutable. Generate a new draft or publish a new version.",
      },
      { status: 409 },
    );
  }

  if (action === "approve") {
    const { advanceTo, readChainState } = await import("@/lib/approvals");
    const before = readChainState(report);
    const advanced = advanceTo(before, "approve", {
      note: "Approved for final lock",
    });
    if (!advanced.ok) {
      return NextResponse.json({ error: advanced.error }, { status: 409 });
    }

    const now = new Date().toISOString();
    const priorHistory = Array.isArray(report.approvalHistory)
      ? report.approvalHistory
      : [];
    const updated = await payload.update({
      collection: "reports",
      id,
      data: {
        approvedBy: auth.user.id,
        approvedAt: now,
        preparerNotes: body.preparerNotes ?? report.preparerNotes ?? undefined,
        approvalStep: advanced.next.step,
        approvalChainStatus: advanced.next.status,
        approvalHistory: [
          ...priorHistory,
          {
            fromStep: advanced.historyEntry.fromStep,
            toStep: advanced.historyEntry.toStep,
            action: "advance",
            at: now,
            actor: auth.user.id,
            note: "Approved for final lock",
          },
        ],
        versionHistory: [
          ...(report.versionHistory ?? []),
          {
            version: report.version,
            status: "draft",
            at: now,
            actor: auth.user.id,
            note: "Approved for final lock",
          },
        ],
      },
      overrideAccess: true,
    });

    await writeAuditLog(payload, {
      organisationId: auth.activeOrg.id,
      actorId: auth.user.id,
      action: "report.approval.advance",
      entityType: "reports",
      entityId: id,
      before: {
        approvalStep: before.step,
        approvalChainStatus: before.status,
      },
      after: {
        action: "approve",
        approvedAt: now,
        approvalStep: advanced.next.step,
        approvalChainStatus: advanced.next.status,
      },
    });

    return NextResponse.json({
      id: updated.id,
      status: updated.status,
      approvedBy: updated.approvedBy,
      approvedAt: updated.approvedAt,
      approvalStep: advanced.next.step,
      approvalChainStatus: advanced.next.status,
    });
  }

  if (action === "notes") {
    if (typeof body.preparerNotes !== "string") {
      return NextResponse.json({ error: "preparerNotes is required" }, { status: 400 });
    }
    const updated = await payload.update({
      collection: "reports",
      id,
      data: { preparerNotes: body.preparerNotes },
      overrideAccess: true,
    });
    return NextResponse.json({
      id: updated.id,
      preparerNotes: updated.preparerNotes,
    });
  }

  // regenerate draft snapshot (optional emissionsStandard override for historical recalc)
  const periodId = periodIdOf(report.period);
  const prevSnapshot = asSnapshot(report.snapshot);
  const standardOverride =
    typeof body.emissionsStandard === "string" ? body.emissionsStandard : null;
  const snapshot = await buildReportSnapshot({
    organisationId: auth.activeOrg.id,
    periodId,
    framework: report.framework,
    version: report.version,
    preparedById: auth.user.id,
    approvedById:
      typeof report.approvedBy === "string"
        ? report.approvedBy
        : report.approvedBy && typeof report.approvedBy === "object"
          ? report.approvedBy.id
          : null,
    approvedAt: report.approvedAt ? String(report.approvedAt) : null,
    preparerNotes: body.preparerNotes ?? report.preparerNotes ?? null,
    emissionsStandard: isEmissionsStandard(standardOverride)
      ? standardOverride
      : undefined,
  });

  const diff = prevSnapshot ? diffSnapshots(prevSnapshot, snapshot) : [];
  const factorIds = [
    ...new Set(snapshot.factorsUsed.map((f) => f.factorId).filter(Boolean)),
  ];

  const updated = await payload.update({
    collection: "reports",
    id,
    data: {
      scores: snapshot.scores,
      emissions: {
        scope1: snapshot.emissions.scope1,
        scope2: snapshot.emissions.scope2,
        scope3: snapshot.emissions.scope3,
      },
      dataQualityPct: snapshot.emissions.dataQualityPct,
      factorVersionsUsed: factorIds,
      snapshot,
      preparedBy: auth.user.id,
      preparerNotes: body.preparerNotes ?? report.preparerNotes ?? undefined,
      versionHistory: [
        ...(report.versionHistory ?? []),
        {
          version: report.version,
          status: "draft",
          at: new Date().toISOString(),
          actor: auth.user.id,
          note: "Draft regenerated",
          changeSummary: diff,
        },
      ],
    },
    overrideAccess: true,
  });

  await writeAuditLog(payload, {
    organisationId: auth.activeOrg.id,
    actorId: auth.user.id,
    action: "report.created",
    entityType: "reports",
    entityId: id,
    after: { action: "regenerate", version: report.version },
  });

  return NextResponse.json({
    id: updated.id,
    version: updated.version,
    status: "draft",
    changes: diff,
    dataGapCount: snapshot.dataGaps?.length ?? 0,
  });
}

export async function GET(_req: Request, ctx: Ctx) {
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
  const payload = await getPayload({ config });
  let report;
  try {
    report = await payload.findByID({
      collection: "reports",
      id,
      depth: 0,
      overrideAccess: true,
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (orgIdOf(report.organisation) !== auth.activeOrg.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: report.id,
    version: report.version,
    status: report.status,
    framework: report.framework,
    scores: report.scores,
    emissions: report.emissions,
    publishedAt: report.publishedAt ?? null,
    preparedBy: report.preparedBy ?? null,
    approvedBy: report.approvedBy ?? null,
    approvedAt: report.approvedAt ?? null,
    preparerNotes: report.preparerNotes ?? null,
    lockedAt: report.lockedAt ?? null,
    versionHistory: report.versionHistory ?? [],
    snapshot: report.snapshot ?? null,
  });
}
