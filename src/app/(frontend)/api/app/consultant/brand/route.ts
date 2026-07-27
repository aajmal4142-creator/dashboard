import { getPayload } from "payload";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import {
  BRAND_COOKIE,
  brandCookieOptions,
  brandingToCookiePayload,
  isHexColor,
  resolveOrgBranding,
  serializeBrandCookie,
} from "@/lib/branding";
import {
  BillingDeniedError,
  billingDeniedResponse,
  can,
  normalizePlan,
} from "@/lib/billing";
import config from "@/payload.config";

/**
 * Legacy consultant brand endpoint — writes settings.branding + syncs brand.
 * Prefer PUT /api/app/settings/branding from Settings.
 */
export async function PUT(req: Request) {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg || ctx.activeOrg.type !== "consultancy") {
    return NextResponse.json({ error: "Consultancy required" }, { status: 403 });
  }
  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return NextResponse.json({ error: "Admin required" }, { status: 403 });
  }
  if (!can(ctx.activeOrg.plan, "white_label")) {
    return NextResponse.json(
      billingDeniedResponse(
        new BillingDeniedError(normalizePlan(ctx.activeOrg.plan), "white_label"),
      ),
      { status: 402 },
    );
  }

  const body = (await req.json()) as {
    primaryColor?: string;
    domain?: string;
  };

  if (body.primaryColor && !isHexColor(body.primaryColor)) {
    return NextResponse.json({ error: "primaryColor must be #RRGGBB" }, { status: 400 });
  }

  const payload = await getPayload({ config });
  const existing = await payload.findByID({
    collection: "organisations",
    id: ctx.activeOrg.id,
    depth: 0,
    overrideAccess: true,
  });

  const nextPrimary =
    body.primaryColor !== undefined
      ? body.primaryColor.trim() || null
      : (existing.settings?.branding?.primaryColor ??
        existing.brand?.primaryColor ??
        null);
  const nextDomain =
    body.domain !== undefined
      ? body.domain.trim() || null
      : (existing.settings?.domain ?? existing.brand?.domain ?? null);

  await payload.update({
    collection: "organisations",
    id: ctx.activeOrg.id,
    data: {
      settings: {
        branding: {
          ...(existing.settings?.branding ?? {}),
          primaryColor: nextPrimary,
          logo:
            typeof existing.settings?.branding?.logo === "object" &&
            existing.settings?.branding?.logo !== null
              ? existing.settings.branding.logo.id
              : (existing.settings?.branding?.logo ??
                (typeof existing.brand?.logo === "object" && existing.brand?.logo !== null
                  ? existing.brand.logo.id
                  : existing.brand?.logo) ??
                undefined),
        },
        domain: nextDomain,
      },
      brand: {
        primaryColor: nextPrimary,
        domain: nextDomain ?? undefined,
        logo:
          typeof existing.brand?.logo === "object" && existing.brand?.logo !== null
            ? existing.brand.logo.id
            : (existing.brand?.logo ?? undefined),
      },
    },
    overrideAccess: true,
  });

  const refreshed = await payload.findByID({
    collection: "organisations",
    id: ctx.activeOrg.id,
    depth: 1,
    overrideAccess: true,
  });
  const branding = resolveOrgBranding(refreshed);
  const jar = await cookies();
  jar.set(
    BRAND_COOKIE,
    serializeBrandCookie(brandingToCookiePayload(ctx.activeOrg.id, branding)),
    brandCookieOptions,
  );

  return NextResponse.json({ ok: true, branding });
}
