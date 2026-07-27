import { getPayload } from "payload";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import {
  BRAND_COOKIE,
  brandCookieOptions,
  brandingToCookiePayload,
  resolveOrgBranding,
  serializeBrandCookie,
} from "@/lib/branding";
import config from "@/payload.config";

const ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
  "image/gif",
]);

const MAX_BYTES = 2 * 1024 * 1024;

/** Upload org logo and attach to settings.branding.logo. */
export async function POST(req: Request) {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg || !ctx.role) {
    return NextResponse.json({ error: "No active organisation" }, { status: 403 });
  }
  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return NextResponse.json({ error: "Admin required" }, { status: 403 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "Logo must be PNG, JPEG, WebP, SVG, or GIF" },
      { status: 400 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Logo must be under 2MB" }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const payload = await getPayload({ config });

  const media = await payload.create({
    collection: "media",
    data: { alt: `${ctx.activeOrg.name} logo` },
    file: {
      data: buf,
      mimetype: file.type || "application/octet-stream",
      name: file.name,
      size: buf.byteLength,
    },
    overrideAccess: true,
  });

  const existing = await payload.findByID({
    collection: "organisations",
    id: ctx.activeOrg.id,
    depth: 0,
    overrideAccess: true,
  });

  await payload.update({
    collection: "organisations",
    id: ctx.activeOrg.id,
    data: {
      settings: {
        branding: {
          ...(existing.settings?.branding ?? {}),
          logo: media.id,
        },
        domain: existing.settings?.domain ?? existing.brand?.domain ?? undefined,
      },
      brand: {
        ...(existing.brand ?? {}),
        logo: media.id,
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

  return NextResponse.json({
    ok: true,
    logoId: media.id,
    logoUrl: branding.logoUrl,
    branding,
  });
}
