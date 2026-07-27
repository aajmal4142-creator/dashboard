import { getPayload } from "payload";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import {
  BRAND_COOKIE,
  brandCookieOptions,
  brandingToCookiePayload,
  isBrandFontKey,
  isBrandModeKey,
  isBrandRadiusKey,
  isHexColor,
  resolveOrgBranding,
  serializeBrandCookie,
  type BrandFontKey,
  type BrandModeKey,
  type BrandRadiusKey,
} from "@/lib/branding";
import {
  BillingDeniedError,
  billingDeniedResponse,
  can,
  normalizePlan,
} from "@/lib/billing";
import config from "@/payload.config";

type BrandingBody = {
  primaryColor?: string | null;
  secondaryColor?: string | null;
  fontFamily?: string | null;
  defaultMode?: string | null;
  radius?: string | null;
  logoId?: string | null;
  clearLogo?: boolean;
  domain?: string | null;
};

function optionalHex(
  value: string | null | undefined,
  field: string,
): { ok: true; value: string | null } | { ok: false; error: string } {
  if (value === undefined) return { ok: true, value: null };
  if (value === null || value.trim() === "") return { ok: true, value: null };
  const trimmed = value.trim();
  if (!isHexColor(trimmed)) {
    return { ok: false, error: `${field} must be #RRGGBB` };
  }
  return { ok: true, value: trimmed };
}

/** GET current org dashboard branding (settings + legacy fallback). */
export async function GET() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) {
    return NextResponse.json({ error: "No active organisation" }, { status: 403 });
  }

  const payload = await getPayload({ config });
  const org = await payload.findByID({
    collection: "organisations",
    id: ctx.activeOrg.id,
    depth: 1,
    overrideAccess: true,
  });

  const branding = resolveOrgBranding(org);
  return NextResponse.json({
    branding,
    canEdit: ctx.role === "owner" || ctx.role === "admin",
  });
}

/** PUT dashboard branding — owner/admin of active org. */
export async function PUT(req: Request) {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg || !ctx.role) {
    return NextResponse.json({ error: "No active organisation" }, { status: 403 });
  }
  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return NextResponse.json({ error: "Admin required" }, { status: 403 });
  }

  const body = (await req.json()) as BrandingBody;

  const primary = optionalHex(body.primaryColor, "primaryColor");
  if (!primary.ok) return NextResponse.json({ error: primary.error }, { status: 400 });
  const secondary = optionalHex(body.secondaryColor, "secondaryColor");
  if (!secondary.ok)
    return NextResponse.json({ error: secondary.error }, { status: 400 });

  let fontFamily: BrandFontKey | null | undefined = undefined;
  if (body.fontFamily !== undefined) {
    if (body.fontFamily === null || body.fontFamily === "") {
      fontFamily = null;
    } else if (isBrandFontKey(body.fontFamily)) {
      fontFamily = body.fontFamily;
    } else {
      return NextResponse.json({ error: "Invalid fontFamily" }, { status: 400 });
    }
  }

  let defaultMode: BrandModeKey | null | undefined = undefined;
  if (body.defaultMode !== undefined) {
    if (body.defaultMode === null || body.defaultMode === "") {
      defaultMode = null;
    } else if (isBrandModeKey(body.defaultMode)) {
      defaultMode = body.defaultMode;
    } else {
      return NextResponse.json({ error: "Invalid defaultMode" }, { status: 400 });
    }
  }

  let radius: BrandRadiusKey | null | undefined = undefined;
  if (body.radius !== undefined) {
    if (body.radius === null || body.radius === "") {
      radius = null;
    } else if (isBrandRadiusKey(body.radius)) {
      radius = body.radius;
    } else {
      return NextResponse.json({ error: "Invalid radius" }, { status: 400 });
    }
  }

  const payload = await getPayload({ config });
  const existing = await payload.findByID({
    collection: "organisations",
    id: ctx.activeOrg.id,
    depth: 0,
    overrideAccess: true,
  });

  let nextLogo: string | null | undefined = undefined;
  if (body.clearLogo) {
    nextLogo = null;
  } else if (body.logoId !== undefined) {
    if (body.logoId === null || body.logoId === "") {
      nextLogo = null;
    } else {
      nextLogo = body.logoId;
    }
  }

  let nextDomain = existing.settings?.domain ?? existing.brand?.domain ?? null;
  if (body.domain !== undefined) {
    const domainValue = body.domain?.trim() || null;
    if (domainValue) {
      if (ctx.activeOrg.type !== "consultancy") {
        return NextResponse.json(
          { error: "Custom domain is only available for consultancies" },
          { status: 403 },
        );
      }
      if (!can(normalizePlan(ctx.activeOrg.plan), "white_label")) {
        return NextResponse.json(
          billingDeniedResponse(
            new BillingDeniedError(normalizePlan(ctx.activeOrg.plan), "white_label"),
          ),
          { status: 402 },
        );
      }
    }
    nextDomain = domainValue;
  }

  const nextPrimary =
    body.primaryColor !== undefined
      ? primary.value
      : (existing.settings?.branding?.primaryColor ??
        existing.brand?.primaryColor ??
        null);
  const nextSecondary =
    body.secondaryColor !== undefined
      ? secondary.value
      : (existing.settings?.branding?.secondaryColor ?? null);
  const nextFont =
    fontFamily !== undefined
      ? fontFamily
      : (existing.settings?.branding?.fontFamily ?? null);
  const nextMode =
    defaultMode !== undefined
      ? defaultMode
      : (existing.settings?.branding?.defaultMode ?? null);
  const nextRadius =
    radius !== undefined ? radius : (existing.settings?.branding?.radius ?? null);
  const logoValue =
    nextLogo !== undefined
      ? nextLogo
      : (existing.settings?.branding?.logo ?? existing.brand?.logo ?? null);

  await payload.update({
    collection: "organisations",
    id: ctx.activeOrg.id,
    data: {
      settings: {
        branding: {
          logo:
            typeof logoValue === "object" && logoValue !== null
              ? logoValue.id
              : logoValue,
          primaryColor: nextPrimary,
          secondaryColor: nextSecondary,
          fontFamily: nextFont,
          defaultMode: nextMode,
          radius: nextRadius,
        },
        domain: nextDomain,
      },
      // Keep legacy brand in sync for invite / older readers
      brand: {
        logo:
          typeof logoValue === "object" && logoValue !== null ? logoValue.id : logoValue,
        primaryColor: nextPrimary,
        domain: nextDomain,
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
