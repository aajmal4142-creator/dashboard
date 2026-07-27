import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { writeAuditLog } from "@/lib/audit/write";
import { getCurrentContext } from "@/lib/auth";
import config from "@/payload.config";

/**
 * Manual re-bind of legacy evidence to a datapoint (bidirectional + audit).
 * Never auto-links; Owner/Admin/Contributor only.
 */
export async function POST(req: Request) {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg || !ctx.role) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (ctx.role === "viewer") {
    return NextResponse.json(
      { error: "Viewers cannot re-bind evidence" },
      { status: 403 },
    );
  }

  const body = (await req.json()) as {
    evidenceId?: string;
    datapointId?: string;
  };
  if (!body.evidenceId || !body.datapointId) {
    return NextResponse.json(
      { error: "evidenceId and datapointId required" },
      { status: 400 },
    );
  }

  const payload = await getPayload({ config });
  const evidence = await payload.findByID({
    collection: "evidence",
    id: body.evidenceId,
    overrideAccess: true,
  });
  const dp = await payload.findByID({
    collection: "datapoints",
    id: body.datapointId,
    overrideAccess: true,
  });

  const evOrg =
    typeof evidence.organisation === "string"
      ? evidence.organisation
      : evidence.organisation?.id;
  const dpOrg =
    typeof dp.organisation === "string" ? dp.organisation : dp.organisation?.id;
  if (evOrg !== ctx.activeOrg.id || dpOrg !== ctx.activeOrg.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const linked = (evidence.linkedDatapoints ?? []).map((d) =>
    typeof d === "string" ? d : d.id,
  );
  if (!linked.includes(body.datapointId)) {
    await payload.update({
      collection: "evidence",
      id: body.evidenceId,
      data: { linkedDatapoints: [...linked, body.datapointId] },
      overrideAccess: true,
    });
  }

  const onDp = (dp.evidence ?? []).map((e) => (typeof e === "string" ? e : e.id));
  if (!onDp.includes(body.evidenceId)) {
    await payload.update({
      collection: "datapoints",
      id: body.datapointId,
      data: { evidence: [...onDp, body.evidenceId] },
      overrideAccess: true,
    });
  }

  await writeAuditLog(payload, {
    organisationId: ctx.activeOrg.id,
    actorId: ctx.user.id,
    action: "evidence.rebind",
    entityType: "evidence",
    entityId: body.evidenceId,
    after: { datapointId: body.datapointId },
  });

  return NextResponse.json({ ok: true });
}
