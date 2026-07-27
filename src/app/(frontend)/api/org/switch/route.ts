import { getPayload } from "payload";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { ACTIVE_ORG_COOKIE, getCurrentContext } from "@/lib/auth";
import {
  BRAND_COOKIE,
  brandCookieOptions,
  brandingToCookiePayload,
  resolveOrgBranding,
  serializeBrandCookie,
} from "@/lib/branding";
import config from "@/payload.config";

export async function POST(req: Request) {
  const body = (await req.json()) as { organisationId?: string };
  if (!body.organisationId) {
    return NextResponse.json({ error: "organisationId required" }, { status: 400 });
  }

  const ctx = await getCurrentContext();
  const allowed = ctx.memberships.some((m) => m.organisationId === body.organisationId);
  if (!allowed) {
    return NextResponse.json(
      { error: "Not a member of that organisation" },
      { status: 403 },
    );
  }

  const jar = await cookies();
  jar.set(ACTIVE_ORG_COOKIE, body.organisationId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });

  try {
    const payload = await getPayload({ config });
    const org = await payload.findByID({
      collection: "organisations",
      id: body.organisationId,
      depth: 1,
      overrideAccess: true,
    });
    const branding = resolveOrgBranding(org);
    jar.set(
      BRAND_COOKIE,
      serializeBrandCookie(brandingToCookiePayload(body.organisationId, branding)),
      brandCookieOptions,
    );
  } catch {
    /* brand cookie is best-effort; active org still switched */
  }

  return NextResponse.json({ ok: true });
}
