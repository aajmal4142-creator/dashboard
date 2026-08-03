import type { Where } from "payload";
import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit/write";
import { writeDatapoint } from "@/lib/data";
import { sendTransactionalEmail } from "@/lib/email/send";
import { serializeInternalRequest, slaTone } from "@/lib/internal-requests";
import { createNotification } from "@/lib/notifications/createNotification";
import { ensureOpenPeriod } from "@/lib/org/period";
import config from "@/payload.config";

function relId(value: string | { id?: string } | null | undefined): string | null {
  if (value == null) return null;
  if (typeof value === "string") return value;
  return value.id ? String(value.id) : null;
}

/** List internal data requests for the active org (filters via query). */
export async function GET(req: Request) {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) {
    return NextResponse.json(
      {
        error: "No active organisation. Finish onboarding or switch organisation.",
      },
      { status: 403 },
    );
  }

  const url = new URL(req.url);
  const requestStatus = url.searchParams.get("requestStatus");
  const reviewStatus = url.searchParams.get("reviewStatus");
  const sla = url.searchParams.get("sla"); // overdue | escalated | due_soon | open
  const assigneeId = url.searchParams.get("assigneeId");
  const q = url.searchParams.get("q")?.trim();

  const payload = await getPayload({ config });
  const clauses: Where[] =
    ctx.role === "owner" || ctx.role === "admin"
      ? [{ organisation: { equals: ctx.activeOrg.id } }]
      : [
          { organisation: { equals: ctx.activeOrg.id } },
          { assignee: { equals: ctx.user.id } },
        ];

  if (requestStatus) {
    clauses.push({ requestStatus: { equals: requestStatus } });
  }
  if (reviewStatus) {
    clauses.push({ reviewStatus: { equals: reviewStatus } });
  }
  if (assigneeId && (ctx.role === "owner" || ctx.role === "admin")) {
    clauses.push({ assignee: { equals: assigneeId } });
  }
  if (q) {
    clauses.push({ title: { contains: q } });
  }
  if (sla === "escalated") {
    clauses.push({ escalatedAt: { exists: true } });
  } else if (sla === "overdue") {
    clauses.push({
      and: [
        { dueDate: { less_than: new Date().toISOString() } },
        { requestStatus: { not_equals: "submitted" } },
      ],
    });
  } else if (sla === "open") {
    clauses.push({ requestStatus: { not_equals: "submitted" } });
  }

  const where: Where = clauses.length === 1 ? clauses[0]! : { and: clauses };

  const rows = await payload.find({
    collection: "internal-data-requests",
    where,
    sort: "-updatedAt",
    limit: 100,
    depth: 1,
    overrideAccess: true,
  });

  const nowMs = Date.now();
  let requests = rows.docs.map((r) => serializeInternalRequest(r, nowMs));

  if (sla === "due_soon") {
    requests = requests.filter((r) => r.sla === "due_soon");
  }

  return NextResponse.json({ requests });
}

/** Create + send a multi-metric pack request. §18.1.1 / F14 */
export async function POST(req: Request) {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg || !ctx.role) {
    return NextResponse.json(
      {
        error: "No active organisation. Finish onboarding or switch organisation.",
      },
      { status: 403 },
    );
  }
  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return NextResponse.json({ error: "Admin required" }, { status: 403 });
  }

  const body = (await req.json()) as {
    title?: string;
    assigneeId?: string;
    metricKeys?: string[];
    dueDate?: string;
    dueAt?: string;
  };
  const dueAt = body.dueAt ?? body.dueDate;
  const keys = (body.metricKeys ?? []).map((k) => k.trim()).filter(Boolean);

  if (!body.title?.trim() || !body.assigneeId || keys.length === 0) {
    return NextResponse.json(
      { error: "title, assigneeId, and metricKeys required" },
      { status: 400 },
    );
  }

  const payload = await getPayload({ config });
  const periodId = await ensureOpenPeriod(
    ctx.activeOrg.id,
    ctx.activeOrg.plan,
    ctx.activeOrg.subscriptionStatus,
  );

  const created = await payload.create({
    collection: "internal-data-requests",
    data: {
      organisation: ctx.activeOrg.id,
      period: periodId,
      title: body.title.trim(),
      assignee: body.assigneeId,
      metricKeys: keys.map((key) => ({ key })),
      dueDate: dueAt || undefined,
      requestStatus: "sent",
      reviewStatus: "pending",
      sentAt: new Date().toISOString(),
      createdBy: ctx.user.id,
    },
    overrideAccess: true,
  });

  const assignee = await payload.findByID({
    collection: "users",
    id: body.assigneeId,
    depth: 0,
    overrideAccess: true,
  });
  const origin = new URL(req.url).origin;
  await sendTransactionalEmail({
    to: assignee.email,
    subject: `Data request: ${body.title.trim()}`,
    html: `<p>You have been asked to complete a data request for <strong>${ctx.activeOrg.name}</strong>.</p><p>Metrics: ${keys.join(", ")}</p><p><a href="${origin}/requests">Open requests</a></p>`,
  });

  await writeAuditLog(payload, {
    organisationId: ctx.activeOrg.id,
    actorId: ctx.user.id,
    action: "internal_request.create",
    entityType: "internal-data-requests",
    entityId: created.id,
    after: { title: created.title, assigneeId: body.assigneeId, metricKeys: keys },
  });

  return NextResponse.json({
    ok: true,
    id: created.id,
    request: serializeInternalRequest(created),
  });
}

/** Update status (admin), submit values + evidence (assignee), or open mark. */
export async function PATCH(req: Request) {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) {
    return NextResponse.json(
      {
        error: "No active organisation. Finish onboarding or switch organisation.",
      },
      { status: 403 },
    );
  }

  const body = (await req.json()) as {
    id?: string;
    requestId?: string;
    requestStatus?: string;
    markOpened?: boolean;
    evidenceIds?: string[];
    values?: Array<{
      metricKey: string;
      value: number;
      unit?: string;
      quality?: "measured" | "calculated" | "estimated" | "missing";
    }>;
  };

  const requestId = body.requestId ?? body.id;
  if (!requestId) {
    return NextResponse.json({ error: "requestId required" }, { status: 400 });
  }

  const payload = await getPayload({ config });
  const row = await payload.findByID({
    collection: "internal-data-requests",
    id: requestId,
    depth: 0,
    overrideAccess: true,
  });
  const orgId = relId(row.organisation);
  if (orgId !== ctx.activeOrg.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const assigneeId = relId(row.assignee);

  // Assignee marks opened
  if (body.markOpened === true) {
    if (assigneeId !== ctx.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (row.requestStatus === "sent") {
      await payload.update({
        collection: "internal-data-requests",
        id: row.id,
        data: {
          requestStatus: "opened",
          openedAt: new Date().toISOString(),
        },
        overrideAccess: true,
      });
    }
    return NextResponse.json({ ok: true });
  }

  // Admin/owner status-only update
  if (body.requestStatus && !body.values?.length) {
    if (ctx.role !== "owner" && ctx.role !== "admin") {
      return NextResponse.json({ error: "Admin required" }, { status: 403 });
    }
    await payload.update({
      collection: "internal-data-requests",
      id: row.id,
      data: {
        requestStatus: body.requestStatus as "not_sent" | "sent" | "opened" | "submitted",
      },
      overrideAccess: true,
    });
    return NextResponse.json({ ok: true });
  }

  if (!body.values?.length) {
    return NextResponse.json({ error: "requestId and values required" }, { status: 400 });
  }

  if (assigneeId !== ctx.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const periodId = relId(row.period);
  if (!periodId) {
    return NextResponse.json({ error: "Period missing on request" }, { status: 400 });
  }

  const allowedKeys = new Set((row.metricKeys ?? []).map((m) => m.key).filter(Boolean));
  for (const v of body.values) {
    if (!allowedKeys.has(v.metricKey)) {
      return NextResponse.json(
        { error: `metricKey ${v.metricKey} is not part of this pack` },
        { status: 400 },
      );
    }
  }

  for (const v of body.values) {
    await writeDatapoint(payload, {
      organisationId: orgId!,
      periodId,
      metricKey: v.metricKey,
      value: v.value,
      unit: v.unit,
      quality: v.quality ?? "measured",
      source: "internal_survey",
      actorId: ctx.user.id,
      assignedTo: ctx.user.id,
    });
  }

  const existingEvidence = (row.evidence ?? []).map((e) =>
    typeof e === "string" ? e : e.id,
  );
  const mergedEvidence = [...new Set([...(body.evidenceIds ?? []), ...existingEvidence])];

  const updated = await payload.update({
    collection: "internal-data-requests",
    id: row.id,
    data: {
      requestStatus: "submitted",
      reviewStatus: "submitted",
      submittedAt: new Date().toISOString(),
      evidence: mergedEvidence,
    },
    overrideAccess: true,
  });

  await writeAuditLog(payload, {
    organisationId: orgId!,
    actorId: ctx.user.id,
    action: "internal_request.submit",
    entityType: "internal-data-requests",
    entityId: row.id,
    after: {
      metricKeys: body.values.map((v) => v.metricKey),
      evidenceCount: mergedEvidence.length,
    },
  });

  const createdBy = relId(row.createdBy);
  if (createdBy) {
    await createNotification(payload, {
      organisationId: orgId!,
      userId: createdBy,
      type: "supplier_response",
      title: "Data request submitted",
      message: `"${row.title}" was submitted and awaits approval.`,
      resourceType: "internal-data-request",
      resourceId: String(row.id),
    });
  }

  return NextResponse.json({
    ok: true,
    request: serializeInternalRequest(updated),
    sla: slaTone({
      dueAt: updated.dueDate,
      requestStatus: updated.requestStatus,
      reviewStatus: updated.reviewStatus,
      escalatedAt: updated.escalatedAt,
    }),
  });
}
