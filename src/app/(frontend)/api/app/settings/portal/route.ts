import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import { resolveOrgBranding } from "@/lib/branding";
import {
  DEFAULT_PORTAL_HEADLINE,
  getPortalConfigForOrg,
  upsertPortalConfig,
  type SupplierPortalConfigView,
} from "@/lib/portal";
import config from "@/payload.config";

function canManagePortal(role: string | null): boolean {
  return role === "owner" || role === "admin";
}

/**
 * GET /api/app/settings/portal — Membership-gated portal config + branding chrome.
 */
export async function GET() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg || !ctx.role) {
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
  const { id, config: portal } = await getPortalConfigForOrg(payload, ctx.activeOrg.id);

  return NextResponse.json({
    id,
    portal,
    branding: {
      primaryColor: branding.primaryColor,
      logoUrl: branding.logoUrl,
    },
    orgName: ctx.activeOrg.name,
    canEdit: canManagePortal(ctx.role),
  });
}

/**
 * PUT /api/app/settings/portal — owner/admin upsert of welcome copy and flags.
 */
export async function PUT(req: Request) {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg || !ctx.role) {
    return NextResponse.json({ error: "No active organisation" }, { status: 403 });
  }
  if (!canManagePortal(ctx.role)) {
    return NextResponse.json({ error: "Admin required" }, { status: 403 });
  }

  const body = (await req.json()) as Partial<SupplierPortalConfigView>;
  const patch: Partial<SupplierPortalConfigView> = {};

  if (body.enabled !== undefined) patch.enabled = Boolean(body.enabled);
  if (body.showPoweredBy !== undefined) patch.showPoweredBy = Boolean(body.showPoweredBy);
  if (body.headline !== undefined) {
    if (typeof body.headline !== "string") {
      return NextResponse.json({ error: "headline must be a string" }, { status: 400 });
    }
    const h = body.headline.trim();
    if (h.length > 120) {
      return NextResponse.json(
        { error: "headline must be 120 characters or fewer" },
        { status: 400 },
      );
    }
    patch.headline = h || DEFAULT_PORTAL_HEADLINE;
  }
  if (body.welcomeMessage !== undefined) {
    if (body.welcomeMessage !== null && typeof body.welcomeMessage !== "string") {
      return NextResponse.json(
        { error: "welcomeMessage must be a string or null" },
        { status: 400 },
      );
    }
    const w = typeof body.welcomeMessage === "string" ? body.welcomeMessage.trim() : "";
    if (w.length > 2000) {
      return NextResponse.json(
        { error: "welcomeMessage must be 2000 characters or fewer" },
        { status: 400 },
      );
    }
    patch.welcomeMessage = w || null;
  }

  const payload = await getPayload({ config });
  const saved = await upsertPortalConfig(payload, ctx.activeOrg.id, patch);
  return NextResponse.json({ ok: true, id: saved.id, portal: saved.config });
}
