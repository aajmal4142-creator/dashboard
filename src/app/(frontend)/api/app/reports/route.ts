import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit/write";
import { BillingDeniedError, billingDeniedResponse } from "@/lib/billing";
import { mayPublishReports, publishDenial } from "@/lib/launch/gates";
import { ensureOpenPeriod } from "@/lib/org/period";
import { buildReportSnapshot, diffSnapshots, type ReportSnapshot } from "@/lib/reports";
import { ensureAssuranceTokens } from "@/lib/reports/ensureAssuranceTokens";
import { requirePermission } from "@/lib/policy/protect";
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

    // Batch fetch assurance tokens (optimized - no N+1)
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
      })),
    });
  });
}

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
  };
  const framework = body.framework ?? "CSRD_SIMPLIFIED";

  if (!mayPublishReports()) {
    return NextResponse.json(publishDenial(), { status: 403 });
  }

  return withPeriod(async () => {
    const payload = await getPayload({ config });
    const periodId = await ensureOpenPeriod(
      ctx.activeOrg!.id,
      ctx.activeOrg!.plan,
      ctx.activeOrg!.subscriptionStatus,
    );

    const existing = await payload.find({
      collection: "reports",
      where: {
        and: [
          { organisation: { equals: ctx.activeOrg!.id } },
          { period: { equals: periodId } },
          { framework: { equals: framework } },
        ],
      },
      limit: 1,
      overrideAccess: true,
    });

    const prevVersion = existing.docs[0] ?? null;
    const nextVersion = (prevVersion?.version ?? 0) + 1;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prevSnapshot: ReportSnapshot | null = (prevVersion?.snapshot as any) ?? null;

    const snapshot = await buildReportSnapshot({
      organisationId: ctx.activeOrg!.id,
      periodId,
      framework,
      version: nextVersion,
    });

    // Calculate diff only if there's a previous snapshot
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const diff = prevSnapshot ? diffSnapshots(prevSnapshot as any, snapshot) : [];

    const report = await payload.create({
      collection: "reports",
      data: {
        organisation: ctx.activeOrg!.id,
        period: periodId,
        framework,
        version: nextVersion,
        status: "draft",
        scores: snapshot.scores,
        emissions: snapshot.emissions,
        snapshot,
      },
      overrideAccess: true,
    });

    await writeAuditLog(payload, {
      organisationId: ctx.activeOrg!.id,
      actorId: ctx.user.id,
      action: "report.created",
      entityType: "reports",
      entityId: report.id,
      after: {
        framework,
        version: nextVersion,
        status: "draft",
      },
    });

    return NextResponse.json({
      id: report.id,
      version: nextVersion,
      framework,
      status: "draft",
      changes: diff,
    });
  });
}
