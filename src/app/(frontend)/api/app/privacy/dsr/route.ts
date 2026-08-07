import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { writeAuditLog } from "@/lib/audit/write";
import { getCurrentContext } from "@/lib/auth";
import config from "@/payload.config";

const DSR_TYPES = ["access", "erasure", "correction"] as const;
type DsrType = (typeof DSR_TYPES)[number];

function isDsrType(value: unknown): value is DsrType {
  return typeof value === "string" && (DSR_TYPES as readonly string[]).includes(value);
}

type CreateDsrBody = {
  type?: string;
  requesterEmail?: string;
  notes?: string;
  dueAt?: string | null;
};

/**
 * GET /api/app/privacy/dsr — list data subject requests for the active org.
 * DPDP Act product beachhead (Y06) — hosting region / Atlas is an open
 * decision §11; this list does not by itself constitute legal compliance.
 */
export async function GET() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) {
    return NextResponse.json({ error: "No active organisation" }, { status: 403 });
  }

  const payload = await getPayload({ config });
  const result = await payload.find({
    collection: "data-subject-requests",
    where: { organisation: { equals: ctx.activeOrg.id } },
    sort: "-createdAt",
    limit: 200,
    depth: 0,
    overrideAccess: true,
  });

  return NextResponse.json({
    requests: result.docs.map((doc) => ({
      id: doc.id,
      type: doc.type,
      requesterEmail: doc.requesterEmail,
      status: doc.status,
      notes: doc.notes ?? null,
      dueAt: doc.dueAt ?? null,
      fulfilledAt: doc.fulfilledAt ?? null,
      createdAt: doc.createdAt,
    })),
    canFulfill: ctx.role === "owner" || ctx.role === "admin",
  });
}

/**
 * POST /api/app/privacy/dsr — log a new data subject request.
 * Contributor role or above; org must exist. §11 disclaimer applies.
 */
export async function POST(req: Request) {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg || !ctx.role) {
    return NextResponse.json({ error: "No active organisation" }, { status: 403 });
  }
  if (ctx.role === "viewer") {
    return NextResponse.json(
      { error: "Contributor role or above is required to log a request" },
      { status: 403 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as CreateDsrBody;
  if (!isDsrType(body.type)) {
    return NextResponse.json(
      { error: "type must be access, erasure, or correction" },
      { status: 400 },
    );
  }
  const requesterEmail = body.requesterEmail?.trim();
  if (!requesterEmail || !requesterEmail.includes("@")) {
    return NextResponse.json({ error: "requesterEmail is required" }, { status: 400 });
  }

  const payload = await getPayload({ config });
  const created = await payload.create({
    collection: "data-subject-requests",
    data: {
      organisation: ctx.activeOrg.id,
      type: body.type,
      requesterEmail,
      status: "open",
      notes: body.notes?.trim() || undefined,
      dueAt: body.dueAt || undefined,
      createdBy: ctx.user.id,
    },
    overrideAccess: true,
  });

  await writeAuditLog(payload, {
    organisationId: ctx.activeOrg.id,
    actorId: ctx.user.id,
    action: "privacy.dsr_created",
    entityType: "data-subject-requests",
    entityId: created.id,
    after: { type: body.type, requesterEmail },
  });

  return NextResponse.json({ ok: true, id: created.id }, { status: 201 });
}
