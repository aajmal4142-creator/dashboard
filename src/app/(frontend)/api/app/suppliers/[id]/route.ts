import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import { normaliseOpenSupplyHubId } from "@/lib/openSupplyHub";
import {
  isSbtiStatus,
  parseEnforcementFlag,
  serializeEnforcementFlag,
  type EnforcementFlag,
  type SbtiStatus,
} from "@/lib/suppliers";
import config from "@/payload.config";

type Ctx = { params: Promise<{ id: string }> };

function orgIdOf(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "id" in value) {
    return String((value as { id: string }).id);
  }
  return null;
}

export type SupplierDetailDto = {
  id: string;
  name: string;
  contactEmail: string;
  category: string;
  annualSpend: number | null;
  country: string | null;
  openSupplyHubId: string | null;
  registryRisk: {
    sbtiStatus: SbtiStatus;
    enforcementFlag: EnforcementFlag;
    sources: string;
    notes: string | null;
    lastReviewedAt: string | null;
  };
};

function toSupplierDetailDto(doc: {
  id: string;
  name: string;
  contactEmail: string;
  category: string;
  annualSpend?: number | null;
  country?: string | null;
  openSupplyHubId?: string | null;
  registryRisk?: {
    sbtiStatus?: string | null;
    enforcementFlag?: string | null;
    sources?: string | null;
    notes?: string | null;
    lastReviewedAt?: string | null;
  } | null;
}): SupplierDetailDto {
  const registryRisk = doc.registryRisk ?? {};
  return {
    id: String(doc.id),
    name: doc.name,
    contactEmail: doc.contactEmail,
    category: doc.category,
    annualSpend: doc.annualSpend ?? null,
    country: doc.country ?? null,
    openSupplyHubId: doc.openSupplyHubId ?? null,
    registryRisk: {
      sbtiStatus: isSbtiStatus(registryRisk.sbtiStatus)
        ? registryRisk.sbtiStatus
        : "unknown",
      enforcementFlag: parseEnforcementFlag(registryRisk.enforcementFlag),
      sources: registryRisk.sources ?? "",
      notes: registryRisk.notes ?? null,
      lastReviewedAt: registryRisk.lastReviewedAt ?? null,
    },
  };
}

/** GET /api/app/suppliers/[id] — detail view (Y07 OS Hub id + Y08 registry risk flags). */
export async function GET(_req: Request, ctx: Ctx) {
  const auth = await getCurrentContext();
  if (!auth.activeOrg) {
    return NextResponse.json({ error: "No active organisation" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const payload = await getPayload({ config });
  const existing = await payload
    .findByID({ collection: "suppliers", id, overrideAccess: true })
    .catch(() => null);

  if (!existing || orgIdOf(existing.organisation) !== auth.activeOrg.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ supplier: toSupplierDetailDto(existing) });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = await getCurrentContext();
  if (!auth.activeOrg || auth.role === "viewer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const payload = await getPayload({ config });
  const existing = await payload.findByID({
    collection: "suppliers",
    id,
    depth: 0,
    overrideAccess: true,
  });
  const orgId =
    typeof existing.organisation === "object" && existing.organisation !== null
      ? existing.organisation.id
      : String(existing.organisation);
  if (orgId !== auth.activeOrg.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await req.json()) as {
    name?: string;
    contactEmail?: string;
    category?: string;
    annualSpend?: number | null;
    emailConsent?: boolean;
    tier?: number | null;
    directSpend?: number | null;
    naceCode?: string | null;
    industryIntensityOverride?: number | null;
    totalRevenue?: number | null;
    parentSupplier?: string | null;
    openSupplyHubId?: string | null;
    registryRisk?: {
      sbtiStatus?: string;
      enforcementFlag?: boolean | "unknown";
      sources?: string;
      notes?: string | null;
    };
  };

  const updated = await payload.update({
    collection: "suppliers",
    id,
    data: {
      ...(body.name !== undefined ? { name: body.name.trim() } : {}),
      ...(body.contactEmail !== undefined
        ? { contactEmail: body.contactEmail.trim().toLowerCase() }
        : {}),
      ...(body.category !== undefined
        ? {
            category: body.category as
              | "purchased_goods"
              | "capital_goods"
              | "transport"
              | "waste"
              | "business_travel"
              | "other",
          }
        : {}),
      ...(body.annualSpend !== undefined
        ? { annualSpend: body.annualSpend ?? undefined }
        : {}),
      ...(body.emailConsent !== undefined
        ? { emailConsent: body.emailConsent === true }
        : {}),
      ...(body.tier !== undefined
        ? {
            tier:
              body.tier === 2 || body.tier === 3 || body.tier === 1
                ? body.tier
                : undefined,
          }
        : {}),
      ...(body.directSpend !== undefined
        ? { directSpend: body.directSpend ?? undefined }
        : {}),
      ...(body.naceCode !== undefined
        ? {
            naceCode:
              body.naceCode && String(body.naceCode).trim()
                ? String(body.naceCode).trim()
                : null,
          }
        : {}),
      ...(body.industryIntensityOverride !== undefined
        ? {
            industryIntensityOverride: body.industryIntensityOverride ?? undefined,
          }
        : {}),
      ...(body.totalRevenue !== undefined
        ? { totalRevenue: body.totalRevenue ?? undefined }
        : {}),
      ...(body.parentSupplier !== undefined
        ? { parentSupplier: body.parentSupplier ?? null }
        : {}),
      ...(body.openSupplyHubId !== undefined
        ? { openSupplyHubId: normaliseOpenSupplyHubId(body.openSupplyHubId) }
        : {}),
      ...(body.registryRisk !== undefined
        ? {
            registryRisk: {
              ...(body.registryRisk.sbtiStatus !== undefined
                ? {
                    sbtiStatus: isSbtiStatus(body.registryRisk.sbtiStatus)
                      ? body.registryRisk.sbtiStatus
                      : "unknown",
                  }
                : {}),
              ...(body.registryRisk.enforcementFlag !== undefined
                ? {
                    enforcementFlag: serializeEnforcementFlag(
                      body.registryRisk.enforcementFlag,
                    ),
                  }
                : {}),
              ...(body.registryRisk.sources !== undefined
                ? { sources: body.registryRisk.sources }
                : {}),
              ...(body.registryRisk.notes !== undefined
                ? { notes: body.registryRisk.notes }
                : {}),
              lastReviewedAt: new Date().toISOString(),
            },
          }
        : {}),
    },
    overrideAccess: true,
  });

  return NextResponse.json({ ok: true, id: updated.id });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const auth = await getCurrentContext();
  if (!auth.activeOrg || (auth.role !== "owner" && auth.role !== "admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const payload = await getPayload({ config });
  const existing = await payload.findByID({
    collection: "suppliers",
    id,
    depth: 0,
    overrideAccess: true,
  });
  const orgId =
    typeof existing.organisation === "object" && existing.organisation !== null
      ? existing.organisation.id
      : String(existing.organisation);
  if (orgId !== auth.activeOrg.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await payload.delete({
    collection: "suppliers",
    id,
    overrideAccess: true,
  });

  return NextResponse.json({ ok: true });
}
