import type { Where } from "payload";
import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit/write";
import { writeDatapoint } from "@/lib/data";
import { sendTransactionalEmail } from "@/lib/email/send";
import { ensureOpenPeriod } from "@/lib/org/period";
import config from "@/payload.config";

/** List internal data requests for the active org. */
export async function GET() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) {
    return NextResponse.json(
      {
        error: "No active organisation. Finish onboarding or switch organisation.",
      },
      { status: 403 },
    );
  }
  const payload = await getPayload({ config });
  const where: Where =
    ctx.role === "owner" || ctx.role === "admin"
      ? { organisation: { equals: ctx.activeOrg.id } }
      : {
          and: [
            { organisation: { equals: ctx.activeOrg.id } },
            { assignee: { equals: ctx.user.id } },
          ],
        };

  const rows = await payload.find({
    collection: "internal-data-requests",
    where,
    sort: "-updatedAt",
    limit: 50,
    depth: 1,
    overrideAccess: true,
  });

  return NextResponse.json({
    requests: rows.docs.map((r) => ({
      id: r.id,
      title: r.title,
      requestStatus: r.requestStatus,
      dueDate: r.dueDate,
      metricKeys: (r.metricKeys ?? []).map((m) => m.key),
      assignee:
        typeof r.assignee === "object" && r.assignee && "email" in r.assignee
          ? { id: r.assignee.id, email: r.assignee.email }
          : null,
    })),
  });
}

/** Create + send an internal data request. §18.1.1 */
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
  };
  if (!body.title?.trim() || !body.assigneeId || !body.metricKeys?.length) {
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
      metricKeys: body.metricKeys.map((key) => ({ key })),
      dueDate: body.dueDate,
      requestStatus: "sent",
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
    html: `<p>You have been asked to complete a data request for <strong>${ctx.activeOrg.name}</strong>.</p><p><a href="${origin}/dashboard/requests">Open requests</a></p>`,
  });

  await writeAuditLog(payload, {
    organisationId: ctx.activeOrg.id,
    actorId: ctx.user.id,
    action: "internal_request.create",
    entityType: "internal-data-requests",
    entityId: created.id,
    after: { title: created.title, assigneeId: body.assigneeId },
  });

  return NextResponse.json({ ok: true, id: created.id });
}

/** Update request status (admin) or submit values (assignee). */
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
  const orgId =
    typeof row.organisation === "string" ? row.organisation : row.organisation.id;
  if (orgId !== ctx.activeOrg.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
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

  const assigneeId = typeof row.assignee === "string" ? row.assignee : row.assignee.id;
  if (assigneeId !== ctx.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const periodId = typeof row.period === "string" ? row.period : String(row.period.id);

  for (const v of body.values) {
    await writeDatapoint(payload, {
      organisationId: orgId,
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

  await payload.update({
    collection: "internal-data-requests",
    id: row.id,
    data: {
      requestStatus: "submitted",
      submittedAt: new Date().toISOString(),
    },
    overrideAccess: true,
  });

  return NextResponse.json({ ok: true });
}
