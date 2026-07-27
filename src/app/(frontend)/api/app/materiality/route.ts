import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { writeAuditLog } from "@/lib/audit/write";
import { getCurrentContext } from "@/lib/auth";
import { BillingDeniedError, billingDeniedResponse } from "@/lib/billing";
import {
  buildMatrixSnapshot,
  ESRS_TOPICS,
  financialScoreOf,
  impactScoreOf,
  materialityNarrative,
  sectorDefaults,
  topicOriginAgainstDefault,
  type TopicOrigin,
} from "@/lib/materiality";
import { ensureOpenPeriod } from "@/lib/org/period";
import config from "@/payload.config";

type TopicBody = {
  esrsTopic: string;
  impactSeverity?: number;
  impactScope?: number;
  impactIrremediability?: number;
  financialMagnitude?: number;
  financialLikelihood?: number;
  impactScore?: number;
  financialScore?: number;
  rationale?: string;
  origin?: TopicOrigin;
};

export async function GET() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) {
    return NextResponse.json({ error: "No active organisation" }, { status: 403 });
  }

  const payload = await getPayload({ config });
  let periodId: string;
  try {
    periodId = await ensureOpenPeriod(
      ctx.activeOrg.id,
      ctx.activeOrg.plan,
      ctx.activeOrg.subscriptionStatus,
    );
  } catch (err) {
    if (err instanceof BillingDeniedError) {
      return NextResponse.json(billingDeniedResponse(err), { status: 402 });
    }
    throw err;
  }
  const found = await payload.find({
    collection: "materiality-assessments",
    where: {
      and: [
        { organisation: { equals: ctx.activeOrg.id } },
        { period: { equals: periodId } },
      ],
    },
    limit: 1,
    overrideAccess: true,
  });

  return NextResponse.json({
    topicsCatalog: ESRS_TOPICS,
    periodId,
    assessment: found.docs[0] ?? null,
    sectorDefaults: sectorDefaults(ctx.activeOrg.sector ?? ""),
  });
}

export async function PUT(req: Request) {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg || !ctx.role) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (ctx.role === "viewer" || ctx.role === "contributor") {
    return NextResponse.json(
      { error: "Admin required to score materiality" },
      { status: 403 },
    );
  }

  const body = (await req.json()) as {
    topics?: TopicBody[];
    finalise?: boolean;
  };

  const payload = await getPayload({ config });
  let periodId: string;
  try {
    periodId = await ensureOpenPeriod(
      ctx.activeOrg.id,
      ctx.activeOrg.plan,
      ctx.activeOrg.subscriptionStatus,
    );
  } catch (err) {
    if (err instanceof BillingDeniedError) {
      return NextResponse.json(billingDeniedResponse(err), { status: 402 });
    }
    throw err;
  }

  const baselines = sectorDefaults(ctx.activeOrg.sector ?? "");
  const baselineByTopic = new Map(baselines.map((b) => [b.esrsTopic, b]));

  const topics = (body.topics ?? []).map((t) => {
    const impact =
      t.impactScore ??
      impactScoreOf({
        severity: t.impactSeverity ?? 0,
        scope: t.impactScope ?? 0,
        irremediability: t.impactIrremediability ?? 0,
      });
    const financial =
      t.financialScore ??
      financialScoreOf({
        magnitude: t.financialMagnitude ?? 0,
        likelihood: t.financialLikelihood ?? 0,
      });
    const baseline = baselineByTopic.get(t.esrsTopic);
    const origin: TopicOrigin =
      t.origin ??
      (baseline
        ? topicOriginAgainstDefault(
            {
              esrsTopic: t.esrsTopic,
              impactSeverity: t.impactSeverity ?? 0,
              impactScope: t.impactScope ?? 0,
              impactIrremediability: t.impactIrremediability ?? 0,
              financialMagnitude: t.financialMagnitude ?? 0,
              financialLikelihood: t.financialLikelihood ?? 0,
              rationale: t.rationale ?? "",
            },
            baseline,
          )
        : "adjusted");
    return {
      esrsTopic: t.esrsTopic,
      impactSeverity: t.impactSeverity,
      impactScope: t.impactScope,
      impactIrremediability: t.impactIrremediability,
      financialMagnitude: t.financialMagnitude,
      financialLikelihood: t.financialLikelihood,
      impactScore: impact,
      financialScore: financial,
      rationale: t.rationale,
      origin,
      decidedBy: ctx.user.id,
      decidedAt: new Date().toISOString(),
    };
  });

  const snapshot = buildMatrixSnapshot(topics);
  const narrative = materialityNarrative(
    ctx.activeOrg.name,
    snapshot.points,
    [ctx.user.firstName, ctx.user.lastName].filter(Boolean).join(" ") || ctx.user.email,
  );

  const existing = await payload.find({
    collection: "materiality-assessments",
    where: {
      and: [
        { organisation: { equals: ctx.activeOrg.id } },
        { period: { equals: periodId } },
      ],
    },
    limit: 1,
    overrideAccess: true,
  });

  const data = {
    organisation: ctx.activeOrg.id,
    period: periodId,
    topics,
    matrixSnapshot: snapshot,
    narrative,
    status: body.finalise ? ("final" as const) : ("draft" as const),
    finalisedAt: body.finalise ? new Date().toISOString() : undefined,
  };

  let doc;
  if (existing.docs[0]) {
    if (existing.docs[0].status === "final" && !body.finalise) {
      return NextResponse.json(
        { error: "Assessment is final. Create a new period to revise." },
        { status: 409 },
      );
    }
    doc = await payload.update({
      collection: "materiality-assessments",
      id: existing.docs[0].id,
      data,
      overrideAccess: true,
    });
  } else {
    doc = await payload.create({
      collection: "materiality-assessments",
      data,
      overrideAccess: true,
    });
  }

  if (body.finalise) {
    await writeAuditLog(payload, {
      organisationId: ctx.activeOrg.id,
      actorId: ctx.user.id,
      action: "materiality.finalised",
      entityType: "materiality-assessments",
      entityId: doc.id,
      after: {
        periodId,
        status: "final",
        topicCount: topics.length,
        materialCount: snapshot.points.filter((p) => p.material).length,
      },
    });
  }

  return NextResponse.json({ ok: true, assessment: doc });
}
