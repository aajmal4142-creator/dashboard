import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import { ensureOpenPeriod } from "@/lib/org/period";
import { questionnaireById } from "@/lib/questionnaires/catalog";
import config from "@/payload.config";

/**
 * Map canonical datapoints → evidenced questionnaire export.
 * Deterministic; no model. §13.2
 */
export async function POST(req: Request) {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) {
    return NextResponse.json(
      {
        error: "No active organisation. Finish onboarding or switch organisation.",
      },
      { status: 403 },
    );
  }

  const body = (await req.json()) as { questionnaireId?: string };
  const def = body.questionnaireId ? questionnaireById(body.questionnaireId) : undefined;
  if (!def) {
    return NextResponse.json({ error: "Unknown questionnaireId" }, { status: 400 });
  }

  const payload = await getPayload({ config });
  const periodId = await ensureOpenPeriod(
    ctx.activeOrg.id,
    ctx.activeOrg.plan,
    ctx.activeOrg.subscriptionStatus,
  );

  const responses = [];
  for (const field of def.fields) {
    const dp = await payload.find({
      collection: "datapoints",
      where: {
        and: [
          { organisation: { equals: ctx.activeOrg.id } },
          { period: { equals: periodId } },
          { metricKey: { equals: field.metricKey } },
        ],
      },
      limit: 1,
      depth: 1,
      overrideAccess: true,
    });
    const row = dp.docs[0];
    const evidenceSha = [];
    if (row?.evidence) {
      for (const e of row.evidence) {
        const id = typeof e === "string" ? e : e.id;
        const ev = await payload.findByID({
          collection: "evidence",
          id,
          depth: 0,
          overrideAccess: true,
        });
        evidenceSha.push(ev.sha256);
      }
    }
    responses.push({
      fieldId: field.id,
      label: field.label,
      metricKey: field.metricKey,
      value: row?.value ?? null,
      unit: row?.unit ?? null,
      quality: row?.quality ?? "missing",
      approvalState: row?.approvalState ?? null,
      evidenceSha256: evidenceSha,
      status: row ? "mapped" : "unmapped",
    });
  }

  return NextResponse.json({
    questionnaireId: def.id,
    name: def.name,
    organisation: ctx.activeOrg.name,
    periodId,
    exportedAt: new Date().toISOString(),
    note: "Deterministic mapping from ClearESG datapoints. Not an EcoVadis filing.",
    responses,
  });
}
