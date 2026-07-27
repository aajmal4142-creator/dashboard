import { createHash } from "node:crypto";

import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { writeAuditLog } from "@/lib/audit/write";
import { getCurrentContext } from "@/lib/auth";
import {
  BillingDeniedError,
  billingDeniedResponse,
  can,
  resolveEffectivePlan,
} from "@/lib/billing";
import config from "@/payload.config";

/**
 * Evidence vault — sha256 is the audit anchor; Media holds the binary.
 * When datapointId is provided, bind both linkedDatapoints and datapoint.evidence.
 */
export async function POST(req: Request) {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg || !ctx.role) {
    return NextResponse.json({ error: "No active organisation" }, { status: 403 });
  }
  if (ctx.role === "viewer") {
    return NextResponse.json(
      { error: "Viewers cannot upload evidence" },
      { status: 403 },
    );
  }
  if (
    !can(
      resolveEffectivePlan({
        plan: ctx.activeOrg.plan,
        subscriptionStatus: ctx.activeOrg.subscriptionStatus,
      }),
      "evidence_vault",
    )
  ) {
    const err = new BillingDeniedError(
      resolveEffectivePlan({
        plan: ctx.activeOrg.plan,
        subscriptionStatus: ctx.activeOrg.subscriptionStatus,
      }),
      "evidence_vault",
    );
    return NextResponse.json(billingDeniedResponse(err), { status: 402 });
  }

  const form = await req.formData();
  const file = form.get("file");
  const metricKey = String(form.get("metricKey") ?? "");
  const whyNote = String(form.get("whyNote") ?? "").trim();
  const datapointId = form.get("datapointId")
    ? String(form.get("datapointId"))
    : undefined;
  const coverageStart = form.get("coverageStart")
    ? String(form.get("coverageStart"))
    : undefined;
  const coverageEnd = form.get("coverageEnd")
    ? String(form.get("coverageEnd"))
    : undefined;

  if (!(file instanceof File) || !metricKey) {
    return NextResponse.json({ error: "file and metricKey required" }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const sha256 = createHash("sha256").update(buf).digest("hex");

  const payload = await getPayload({ config });

  if (datapointId) {
    const dp = await payload.findByID({
      collection: "datapoints",
      id: datapointId,
      overrideAccess: true,
    });
    const orgId =
      typeof dp.organisation === "string" ? dp.organisation : dp.organisation?.id;
    if (orgId !== ctx.activeOrg.id) {
      return NextResponse.json({ error: "Datapoint not found" }, { status: 404 });
    }
  }

  const media = await payload.create({
    collection: "media",
    data: { alt: `${metricKey} evidence: ${file.name}` },
    file: {
      data: buf,
      mimetype: file.type || "application/octet-stream",
      name: file.name,
      size: buf.byteLength,
    },
    overrideAccess: true,
  });

  const evidence = await payload.create({
    collection: "evidence",
    data: {
      organisation: ctx.activeOrg.id,
      file: media.id,
      filename: file.name,
      mimeType: file.type || "application/octet-stream",
      size: buf.byteLength,
      sha256,
      uploadedBy: ctx.user.id,
      uploadedAt: new Date().toISOString(),
      linkedDatapoints: datapointId ? [datapointId] : undefined,
      coverageStart: coverageStart || undefined,
      coverageEnd: coverageEnd || undefined,
      whyNote: whyNote || undefined,
      extractedData: { metricKey, whyNote: whyNote || undefined },
      ocrStatus: "skipped",
    },
    overrideAccess: true,
  });

  if (datapointId) {
    const dp = await payload.findByID({
      collection: "datapoints",
      id: datapointId,
      overrideAccess: true,
    });
    const existing = (dp.evidence ?? []).map((e) => (typeof e === "string" ? e : e.id));
    if (!existing.includes(evidence.id)) {
      await payload.update({
        collection: "datapoints",
        id: datapointId,
        data: { evidence: [...existing, evidence.id] },
        overrideAccess: true,
      });
    }
  }

  await writeAuditLog(payload, {
    organisationId: ctx.activeOrg.id,
    actorId: ctx.user.id,
    action: "evidence.upload",
    entityType: "evidence",
    entityId: evidence.id,
    after: {
      sha256,
      metricKey,
      datapointId: datapointId ?? null,
      bound: Boolean(datapointId),
    },
  });

  return NextResponse.json({
    ok: true,
    id: evidence.id,
    sha256,
    bound: Boolean(datapointId),
  });
}
