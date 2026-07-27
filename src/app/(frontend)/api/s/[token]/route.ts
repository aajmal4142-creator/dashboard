import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { writeAuditLog } from "@/lib/audit/write";
import {
  assertRateLimit,
  isTokenExpired,
  SUPPLIER_FORM_FIELDS,
  type SupplierFormValues,
} from "@/lib/suppliers";
import {
  ensureOpenPeriod,
  reaggregateScope3Contributions,
} from "@/lib/suppliers/aggregate";
import { buildPublicSubmitAuditAfter } from "@/lib/suppliers/tokenSecurity";
import config from "@/payload.config";

type Ctx = { params: Promise<{ token: string }> };

function clientKey(req: Request, token: string): string {
  const fwd = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = fwd || req.headers.get("x-real-ip") || "unknown";
  return `${token}:${ip}`;
}

function orgIdOf(supplier: { organisation: string | { id: string } }): string {
  return typeof supplier.organisation === "object" && supplier.organisation !== null
    ? supplier.organisation.id
    : String(supplier.organisation);
}

function periodIdOf(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "id" in value) {
    return String((value as { id: string }).id);
  }
  return null;
}

export async function GET(req: Request, ctx: Ctx) {
  const { token } = await ctx.params;
  const limited = await assertRateLimit(`get:${clientKey(req, token)}`);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  const payload = await getPayload({ config });
  const found = await payload.find({
    collection: "suppliers",
    where: { requestToken: { equals: token } },
    limit: 1,
    depth: 1,
    overrideAccess: true,
  });
  const supplier = found.docs[0];
  if (!supplier) {
    return NextResponse.json({ error: "Link not found" }, { status: 404 });
  }

  if (supplier.requestStatus === "sent") {
    await payload.update({
      collection: "suppliers",
      id: supplier.id,
      data: { requestStatus: "opened" },
      overrideAccess: true,
    });
  }

  const org =
    typeof supplier.organisation === "object" && supplier.organisation !== null
      ? supplier.organisation
      : null;

  const expired = isTokenExpired(
    supplier.requestExpiresAt ? String(supplier.requestExpiresAt) : null,
  );

  return NextResponse.json({
    orgName: org && "name" in org ? String(org.name) : "ClearESG customer",
    supplierName: supplier.name,
    fields: SUPPLIER_FORM_FIELDS,
    expired,
    /** Corrections allowed within TTL — not single-use. */
    used: false,
    alreadySubmitted: supplier.requestStatus === "submitted",
    expiresAt: supplier.requestExpiresAt ?? null,
  });
}

export async function POST(req: Request, ctx: Ctx) {
  const { token } = await ctx.params;
  const limited = await assertRateLimit(`post:${clientKey(req, token)}`);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  const payload = await getPayload({ config });
  const found = await payload.find({
    collection: "suppliers",
    where: { requestToken: { equals: token } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  });
  const supplier = found.docs[0];
  if (!supplier) {
    return NextResponse.json({ error: "Link not found" }, { status: 404 });
  }
  if (
    isTokenExpired(supplier.requestExpiresAt ? String(supplier.requestExpiresAt) : null)
  ) {
    return NextResponse.json({ error: "This link has expired" }, { status: 410 });
  }

  const body = (await req.json()) as SupplierFormValues & { is_metered?: boolean };
  const submitted: Record<string, number | null | boolean> = {};
  for (const field of SUPPLIER_FORM_FIELDS) {
    const raw = body[field.key];
    if (raw === undefined || raw === null || raw === ("" as unknown)) {
      if (field.required) {
        return NextResponse.json({ error: `${field.key} is required` }, { status: 400 });
      }
      submitted[field.key] = null;
      continue;
    }
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) {
      return NextResponse.json(
        { error: `${field.key} must be a non-negative number` },
        { status: 400 },
      );
    }
    submitted[field.key] = n;
  }
  submitted.is_metered = Boolean(body.is_metered);

  const orgId = orgIdOf(supplier);
  const isResubmit = supplier.requestStatus === "submitted";
  const submittedAt = new Date().toISOString();

  const boundPeriod = periodIdOf(supplier.requestPeriod);
  const periodId = boundPeriod ?? (await ensureOpenPeriod(payload, orgId));

  await payload.update({
    collection: "suppliers",
    id: supplier.id,
    data: {
      requestStatus: "submitted",
      respondedAt: submittedAt,
      submittedData: submitted,
      requestPeriod: periodId,
      // Keep token valid within TTL so the supplier can correct their answer.
    },
    overrideAccess: true,
  });

  await reaggregateScope3Contributions(payload, orgId, periodId);

  await writeAuditLog(payload, {
    organisationId: orgId,
    actorId: null,
    action: isResubmit ? "supplier.resubmit" : "supplier.submit",
    entityType: "suppliers",
    entityId: supplier.id,
    after: buildPublicSubmitAuditAfter({
      supplierId: supplier.id,
      tokenId: token,
      periodId,
      submittedAt,
      organisationId: orgId,
      values: submitted,
      isResubmit,
    }),
  });

  return NextResponse.json({
    ok: true,
    orgName: undefined as string | undefined,
    periodId,
    isResubmit,
  });
}
