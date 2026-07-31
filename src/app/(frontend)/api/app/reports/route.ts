import { randomBytes } from "node:crypto";

import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit/write";
import { BillingDeniedError, billingDeniedResponse } from "@/lib/billing";
import { mayPublishReports, publishDenial } from "@/lib/launch/gates";
import { ensureOpenPeriod } from "@/lib/org/period";
import { scheduleOrgDashboardBroadcast } from "@/lib/realtime";
import { buildReportSnapshot, diffSnapshots, type ReportSnapshot } from "@/lib/reports";
import { ensureAssuranceTokens } from "@/lib/reports/ensureAssuranceTokens";
import { requirePermission } from "@/lib/policy/protect";
import { recordJourneyEvent } from "@/lib/telemetry/journey";
import config from "@/payload.config";

async function withPeriod<T>(run: () => Promise<T>): Promise<T | NextResponse> {
  try {
    return await run();
  } catch (err) {
    if (err instanceof BillingDeniedError) {
      return NextResponse.json(billingDeniedResponse(err), { status: 402 });
    }
    throw err;
  }
}

function asSnapshot(value: unknown): ReportSnapshot | null {
  if (!value || typeof value !== "object") return null;
  return value as ReportSnapshot;
}

export async function GET() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) {
    return NextResponse.json({ error: "No active organisation" }, { status: 403 });
  }

  const allowed = await requirePermission(
    ctx.user.id,
    ctx.activeOrg.id,
    "view",
    "report",
    ctx.activeOrg.id,
    "organisation",
  );
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return withPeriod(async () => {
    const payload = await getPayload({ config });
    const periodId = await ensureOpenPeriod(
      ctx.activeOrg!.id,
      ctx.activeOrg!.plan,
      ctx.activeOrg!.subscriptionStatus,
    );
    const reports = await payload.find({
      collection: "reports",
      where: {
        and: [
          { organisation: { equals: ctx.activeOrg!.id } },
          { period: { equals: periodId } },
        ],
      },
      sort: "-version",
      limit: 20,
      overrideAccess: true,
    });

    const assuranceTokenMap = await ensureAssuranceTokens(payload, reports.docs);

    return NextResponse.json({
      periodId,
      reports: reports.docs.map((r) => ({
        id: r.id,
        version: r.version,
        status: r.status,
        framework: r.framework,
        shareToken: r.shareToken ?? null,
        assuranceToken: assuranceTokenMap.get(r.id) ?? null,
        publishedAt: r.publishedAt ?? null,
        scores: r.scores,
        viewCount: r.viewCount ?? 0,
        preparedBy: r.preparedBy ?? null,
        approvedBy: r.approvedBy ?? null,
        approvedAt: r.approvedAt ?? null,
        lockedAt: r.lockedAt ?? null,
        dataGapCount: Array.isArray((r.snapshot as ReportSnapshot | null)?.dataGaps)
          ? (r.snapshot as ReportSnapshot).dataGaps!.length
          : 0,
      })),
    });
  });
}

/**
 * POST /api/app/reports
 * mode=final (default): publish immutable CSRD/BRSR snapshot (existing simplified flow)
 * mode=draft: create or regenerate regenerable draft for the period+framework
 */
export async function POST(req: Request) {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg || !ctx.role) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const allowed = await requirePermission(
    ctx.user.id,
    ctx.activeOrg.id,
    "create",
    "report",
    ctx.activeOrg.id,
    "organisation",
  );
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as {
    framework?: "CSRD_SET1" | "CSRD_SIMPLIFIED" | "BRSR" | "VSME" | "GRI" | "CUSTOM";
    shareDays?: number;
    requireApproved?: boolean;
    mode?: "draft" | "final";
    preparerNotes?: string;
  };
  const framework = body.framework ?? "CSRD_SIMPLIFIED";
  const mode = body.mode === "draft" ? "draft" : "final";

  if (mode === "final" && !mayPublishReports()) {
    return NextResponse.json(publishDenial(), { status: 403 });
  }

  return withPeriod(async () => {
    const payload = await getPayload({ config });
    const periodId = await ensureOpenPeriod(
      ctx.activeOrg!.id,
      ctx.activeOrg!.plan,
      ctx.activeOrg!.subscriptionStatus,
    );

    if (body.requireApproved === true) {
      const pending = await payload.find({
        collection: "datapoints",
        where: {
          and: [
            { organisation: { equals: ctx.activeOrg!.id } },
            { period: { equals: periodId } },
            { approvalState: { not_equals: "approved" } },
            { quality: { not_equals: "missing" } },
          ],
        },
        limit: 1,
        overrideAccess: true,
      });
      if (pending.docs[0]) {
        return NextResponse.json(
          {
            error:
              "Publishing requires all material datapoints to be approved. Review pending figures first.",
          },
          { status: 409 },
        );
      }
    }

    const existingDraft = await payload.find({
      collection: "reports",
      where: {
        and: [
          { organisation: { equals: ctx.activeOrg!.id } },
          { period: { equals: periodId } },
          { framework: { equals: framework } },
          { status: { equals: "draft" } },
        ],
      },
      sort: "-version",
      limit: 1,
      overrideAccess: true,
    });

    const latestAny = await payload.find({
      collection: "reports",
      where: {
        and: [
          { organisation: { equals: ctx.activeOrg!.id } },
          { period: { equals: periodId } },
          { framework: { equals: framework } },
        ],
      },
      sort: "-version",
      limit: 1,
      overrideAccess: true,
    });

    const prevDoc = latestAny.docs[0] ?? null;
    const prevSnapshot = asSnapshot(prevDoc?.snapshot);
    const draftDoc = existingDraft.docs[0] ?? null;

    if (mode === "draft") {
      const version = draftDoc?.version ?? (prevDoc?.version ?? 0) + 1;
      const snapshot = await buildReportSnapshot({
        organisationId: ctx.activeOrg!.id,
        periodId,
        framework,
        version,
        preparedById: ctx.user.id,
        approvedById:
          typeof draftDoc?.approvedBy === "string"
            ? draftDoc.approvedBy
            : draftDoc?.approvedBy && typeof draftDoc.approvedBy === "object"
              ? draftDoc.approvedBy.id
              : null,
        approvedAt: draftDoc?.approvedAt ? String(draftDoc.approvedAt) : null,
        preparerNotes: body.preparerNotes ?? draftDoc?.preparerNotes ?? null,
      });

      const diff = prevSnapshot ? diffSnapshots(prevSnapshot, snapshot) : [];
      const historyEntry = {
        version,
        status: "draft" as const,
        at: new Date().toISOString(),
        actor: ctx.user.id,
        note: draftDoc ? "Draft regenerated" : "Draft created",
        changeSummary: diff,
      };

      const factorIds = [
        ...new Set(snapshot.factorsUsed.map((f) => f.factorId).filter(Boolean)),
      ];

      if (draftDoc) {
        const history = [...(draftDoc.versionHistory ?? []), historyEntry];
        const report = await payload.update({
          collection: "reports",
          id: draftDoc.id,
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
            preparedBy: ctx.user.id,
            preparerNotes: body.preparerNotes ?? draftDoc.preparerNotes ?? undefined,
            versionHistory: history,
          },
          overrideAccess: true,
        });

        await writeAuditLog(payload, {
          organisationId: ctx.activeOrg!.id,
          actorId: ctx.user.id,
          action: "report.created",
          entityType: "reports",
          entityId: report.id,
          after: { framework, version, status: "draft", regenerated: true },
        });

        scheduleOrgDashboardBroadcast(payload, ctx.activeOrg!.id, {
          kind: "report",
          id: String(report.id),
        });

        return NextResponse.json({
          id: report.id,
          version,
          framework,
          status: "draft",
          changes: diff,
          dataGapCount: snapshot.dataGaps?.length ?? 0,
        });
      }

      const report = await payload.create({
        collection: "reports",
        data: {
          organisation: ctx.activeOrg!.id,
          period: periodId,
          framework,
          version,
          status: "draft",
          scores: snapshot.scores,
          emissions: {
            scope1: snapshot.emissions.scope1,
            scope2: snapshot.emissions.scope2,
            scope3: snapshot.emissions.scope3,
          },
          dataQualityPct: snapshot.emissions.dataQualityPct,
          factorVersionsUsed: factorIds,
          snapshot,
          preparedBy: ctx.user.id,
          preparerNotes: body.preparerNotes ?? undefined,
          versionHistory: [historyEntry],
        },
        overrideAccess: true,
      });

      await writeAuditLog(payload, {
        organisationId: ctx.activeOrg!.id,
        actorId: ctx.user.id,
        action: "report.created",
        entityType: "reports",
        entityId: report.id,
        after: { framework, version, status: "draft" },
      });

      scheduleOrgDashboardBroadcast(payload, ctx.activeOrg!.id, {
        kind: "report",
        id: String(report.id),
      });

      return NextResponse.json({
        id: report.id,
        version,
        framework,
        status: "draft",
        changes: diff,
        dataGapCount: snapshot.dataGaps?.length ?? 0,
      });
    }

    // —— Final / publish (immutable) ——
    const nextVersion = (prevDoc?.version ?? 0) + 1;
    const approvedById =
      typeof draftDoc?.approvedBy === "string"
        ? draftDoc.approvedBy
        : draftDoc?.approvedBy && typeof draftDoc.approvedBy === "object"
          ? draftDoc.approvedBy.id
          : null;

    const snapshot = await buildReportSnapshot({
      organisationId: ctx.activeOrg!.id,
      periodId,
      framework,
      version: nextVersion,
      preparedById: ctx.user.id,
      approvedById,
      approvedAt: draftDoc?.approvedAt ? String(draftDoc.approvedAt) : null,
      preparerNotes: body.preparerNotes ?? draftDoc?.preparerNotes ?? null,
    });

    const diff = prevSnapshot ? diffSnapshots(prevSnapshot, snapshot) : [];
    const shareToken = randomBytes(18).toString("base64url");
    const assuranceToken = randomBytes(18).toString("base64url");
    const shareDays = body.shareDays ?? 90;
    const shareExpiresAt = new Date();
    shareExpiresAt.setUTCDate(shareExpiresAt.getUTCDate() + shareDays);
    const now = new Date().toISOString();

    const factorIds = [
      ...new Set(snapshot.factorsUsed.map((f) => f.factorId).filter(Boolean)),
    ];

    const historyEntry = {
      version: nextVersion,
      status: "published" as const,
      at: now,
      actor: ctx.user.id,
      note: "Final locked",
      changeSummary: diff,
    };

    const report = await payload.create({
      collection: "reports",
      data: {
        organisation: ctx.activeOrg!.id,
        period: periodId,
        framework,
        version: nextVersion,
        status: "published",
        scores: snapshot.scores,
        emissions: {
          scope1: snapshot.emissions.scope1,
          scope2: snapshot.emissions.scope2,
          scope3: snapshot.emissions.scope3,
        },
        dataQualityPct: snapshot.emissions.dataQualityPct,
        factorVersionsUsed: factorIds,
        snapshot,
        shareToken,
        assuranceToken,
        shareExpiresAt: shareExpiresAt.toISOString(),
        viewCount: 0,
        publishedAt: now,
        publishedBy: ctx.user.id,
        preparedBy: ctx.user.id,
        approvedBy: approvedById ?? undefined,
        approvedAt: draftDoc?.approvedAt ? String(draftDoc.approvedAt) : undefined,
        preparerNotes: body.preparerNotes ?? draftDoc?.preparerNotes ?? undefined,
        lockedAt: now,
        versionHistory: [...(draftDoc?.versionHistory ?? []), historyEntry],
      },
      overrideAccess: true,
    });

    // Retire regenerable draft once finalised so the next draft starts clean
    if (draftDoc) {
      try {
        await payload.delete({
          collection: "reports",
          id: draftDoc.id,
          overrideAccess: true,
        });
      } catch {
        /* draft cleanup best-effort */
      }
    }

    recordJourneyEvent(ctx.activeOrg!.id, "first_publish");
    await writeAuditLog(payload, {
      organisationId: ctx.activeOrg!.id,
      actorId: ctx.user.id,
      action: "report.publish",
      entityType: "reports",
      entityId: report.id,
      after: { framework, version: nextVersion, status: "published" },
    });

    scheduleOrgDashboardBroadcast(payload, ctx.activeOrg!.id, {
      kind: "report",
      id: String(report.id),
    });

    // S10.5 — outbound report.generated webhooks (published only)
    const { scheduleReportGeneratedWebhooks } =
      await import("@/lib/webhooks/reportDelivery");
    scheduleReportGeneratedWebhooks({
      reportId: String(report.id),
      organisationId: ctx.activeOrg!.id,
    });

    const { notifyOrganisationMembers } = await import("@/lib/notifications");
    const frameworkLabel = String(framework).toUpperCase();
    await notifyOrganisationMembers(payload, {
      organisationId: ctx.activeOrg!.id,
      excludeUserIds: [ctx.user.id],
      type: "report_ready",
      title: "Report ready",
      message: `${frameworkLabel} report ready for download`,
      resourceType: "report",
      resourceId: String(report.id),
    });

    const origin = new URL(req.url).origin;
    return NextResponse.json({
      ok: true,
      id: report.id,
      version: nextVersion,
      framework,
      status: "published",
      shareUrl: `${origin}/r/${shareToken}`,
      assuranceUrl: `${origin}/a/${assuranceToken}`,
      diff,
      changes: diff,
      dataGapCount: snapshot.dataGaps?.length ?? 0,
    });
  });
}
