import { randomBytes } from "node:crypto";

import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit/write";
import { BillingDeniedError, billingDeniedResponse } from "@/lib/billing";
import { mayPublishReports, publishDenial } from "@/lib/launch/gates";
import { ensureOpenPeriod } from "@/lib/org/period";
import { buildReportSnapshot, diffSnapshots, type ReportSnapshot } from "@/lib/reports";
import { ensureAssuranceToken } from "@/lib/reports/ensureAssuranceToken";
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

export async function GET() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) {
    return NextResponse.json({ error: "No active organisation" }, { status: 403 });
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

    return NextResponse.json({
      periodId,
      reports: await Promise.all(
        reports.docs.map(async (r) => ({
          id: r.id,
          version: r.version,
          status: r.status,
          framework: r.framework,
          shareToken: r.shareToken ?? null,
          assuranceToken: await ensureAssuranceToken(payload, r),
          publishedAt: r.publishedAt ?? null,
          scores: r.scores,
          viewCount: r.viewCount ?? 0,
        })),
      ),
    });
  });
}

export async function POST(req: Request) {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg || !ctx.role) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (ctx.role === "viewer" || ctx.role === "contributor") {
    return NextResponse.json(
      { error: "Admin required to publish reports" },
      { status: 403 },
    );
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

    const requireApproved = body.requireApproved === true;
    if (requireApproved) {
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

    const existing = await payload.find({
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
    const nextVersion = (existing.docs[0]?.version ?? 0) + 1;

    const snapshot = await buildReportSnapshot({
      organisationId: ctx.activeOrg!.id,
      periodId,
      framework,
      version: nextVersion,
    });

    const shareToken = randomBytes(18).toString("base64url");
    const assuranceToken = randomBytes(18).toString("base64url");
    const shareDays = body.shareDays ?? 90;
    const shareExpiresAt = new Date();
    shareExpiresAt.setUTCDate(shareExpiresAt.getUTCDate() + shareDays);

    const factorIds = [
      ...new Set(snapshot.factorsUsed.map((f) => f.factorId).filter(Boolean)),
    ];

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
        publishedAt: new Date().toISOString(),
        publishedBy: ctx.user.id,
      },
      overrideAccess: true,
    });

    recordJourneyEvent(ctx.activeOrg!.id, "first_publish");
    await writeAuditLog(payload, {
      organisationId: ctx.activeOrg!.id,
      actorId: ctx.user.id,
      action: "report.publish",
      entityType: "reports",
      entityId: report.id,
      after: { framework, version: nextVersion },
    });

    let diff: ReturnType<typeof diffSnapshots> = [];
    if (existing.docs[0]?.snapshot) {
      diff = diffSnapshots(existing.docs[0].snapshot as ReportSnapshot, snapshot);
    }

    const origin = new URL(req.url).origin;
    return NextResponse.json({
      ok: true,
      id: report.id,
      version: nextVersion,
      shareUrl: `${origin}/r/${shareToken}`,
      assuranceUrl: `${origin}/a/${assuranceToken}`,
      diff,
    });
  });
}
