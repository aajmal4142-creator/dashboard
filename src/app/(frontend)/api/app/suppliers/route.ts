import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import { limits } from "@/lib/billing";
import { responseRatePct, spendCoveragePct } from "@/lib/suppliers";
import config from "@/payload.config";

const CATEGORIES = [
  "purchased_goods",
  "capital_goods",
  "transport",
  "waste",
  "business_travel",
  "other",
] as const;

export async function GET() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) {
    return NextResponse.json({ error: "No active organisation" }, { status: 403 });
  }

  const payload = await getPayload({ config });
  const result = await payload.find({
    collection: "suppliers",
    where: { organisation: { equals: ctx.activeOrg.id } },
    limit: 200,
    sort: "-updatedAt",
    overrideAccess: true,
  });

  const rows = result.docs.map((s) => ({
    id: s.id,
    name: s.name,
    contactEmail: s.contactEmail,
    category: s.category,
    annualSpend: s.annualSpend ?? null,
    requestStatus: s.requestStatus ?? "not_sent",
    requestToken: s.requestToken ?? null,
    sentAt: s.sentAt ?? null,
    requestExpiresAt: s.requestExpiresAt ?? null,
    respondedAt: s.respondedAt ?? null,
    reminderCount: s.reminderCount ?? 0,
  }));

  return NextResponse.json({
    suppliers: rows,
    coveragePct: spendCoveragePct(rows),
    responseRatePct: responseRatePct(rows),
  });
}

export async function POST(req: Request) {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg || !ctx.role) {
    return NextResponse.json({ error: "No active organisation" }, { status: 403 });
  }
  if (ctx.role === "viewer") {
    return NextResponse.json({ error: "Viewers cannot add suppliers" }, { status: 403 });
  }

  const body = (await req.json()) as {
    name?: string;
    contactEmail?: string;
    category?: string;
    annualSpend?: number | null;
  };

  const name = body.name?.trim();
  const contactEmail = body.contactEmail?.trim().toLowerCase();
  const category = body.category;
  if (!name || !contactEmail || !contactEmail.includes("@")) {
    return NextResponse.json(
      { error: "name and contactEmail required" },
      { status: 400 },
    );
  }
  if (!category || !CATEGORIES.includes(category as (typeof CATEGORIES)[number])) {
    return NextResponse.json({ error: "Valid category required" }, { status: 400 });
  }

  const payload = await getPayload({ config });
  const existing = await payload.find({
    collection: "suppliers",
    where: { organisation: { equals: ctx.activeOrg.id } },
    limit: 1,
    overrideAccess: true,
  });
  const max = limits(ctx.activeOrg.plan).maxSuppliers;
  if (existing.totalDocs >= max) {
    return NextResponse.json(
      {
        error: `Supplier limit reached (${max}). Upgrade at /dashboard/billing.`,
        code: "BILLING_DENIED",
        upgradePath: "/dashboard/billing",
      },
      { status: 402 },
    );
  }

  const doc = await payload.create({
    collection: "suppliers",
    data: {
      organisation: ctx.activeOrg.id,
      name,
      contactEmail,
      category: category as (typeof CATEGORIES)[number],
      annualSpend: typeof body.annualSpend === "number" ? body.annualSpend : undefined,
      requestStatus: "not_sent",
      reminderCount: 0,
    },
    overrideAccess: true,
  });

  return NextResponse.json({ ok: true, id: doc.id });
}
