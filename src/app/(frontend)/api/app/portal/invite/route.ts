import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import { getPortalConfigForOrg } from "@/lib/portal";
import { newRequestToken, requestExpiryFrom } from "@/lib/suppliers";
import { ensureOpenPeriod } from "@/lib/suppliers/aggregate";
import config from "@/payload.config";

async function deliverInviteEmail(opts: {
  to: string;
  orgName: string;
  link: string;
  expiresIso: string;
  welcomeMessage: string | null;
}): Promise<"resend" | "console"> {
  const subject = `${opts.orgName} requests your emissions data`;
  const welcome = opts.welcomeMessage
    ? `<p>${opts.welcomeMessage.replace(/</g, "&lt;")}</p>`
    : "";
  const html = `<p>${opts.orgName} needs a short Scope 3 data return.</p>
${welcome}
<p>Complete the form (about 90 seconds): <a href="${opts.link}">${opts.link}</a></p>
<p>This link expires on ${opts.expiresIso.slice(0, 10)}. You may correct your answers until then.</p>`;

  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM ?? "ClearESG <onboarding@resend.dev>";
  if (key) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: [opts.to], subject, html }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Resend failed: ${res.status} ${body}`);
    }
    return "resend";
  }

  console.info(`[email] (no RESEND_API_KEY) to=${opts.to} link=${opts.link}`);
  return "console";
}

/**
 * POST /api/app/portal/invite — Membership-gated invite link for a supplier.
 * Body: { supplierId: string }
 */
export async function POST(req: Request) {
  const auth = await getCurrentContext();
  if (!auth.activeOrg || !auth.role) {
    return NextResponse.json({ error: "No active organisation" }, { status: 403 });
  }
  if (auth.role === "viewer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as { supplierId?: string };
  const supplierId = body.supplierId?.trim();
  if (!supplierId) {
    return NextResponse.json({ error: "supplierId is required" }, { status: 400 });
  }

  const payload = await getPayload({ config });
  const { config: portal } = await getPortalConfigForOrg(payload, auth.activeOrg.id);
  if (!portal.enabled) {
    return NextResponse.json(
      { error: "Supplier portal is paused. Enable it in Settings before inviting." },
      { status: 409 },
    );
  }

  let supplier;
  try {
    supplier = await payload.findByID({
      collection: "suppliers",
      id: supplierId,
      depth: 0,
      overrideAccess: true,
    });
  } catch {
    return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
  }

  const orgId =
    typeof supplier.organisation === "object" && supplier.organisation !== null
      ? supplier.organisation.id
      : String(supplier.organisation);
  if (orgId !== auth.activeOrg.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const token = supplier.requestToken ?? newRequestToken();
  const expires = requestExpiryFrom();
  const origin = new URL(req.url).origin;
  const link = `${origin}/s/${token}`;
  const periodId = await ensureOpenPeriod(payload, orgId);

  await payload.update({
    collection: "suppliers",
    id: supplierId,
    data: {
      requestToken: token,
      requestStatus: supplier.requestStatus === "submitted" ? "submitted" : "sent",
      sentAt: new Date().toISOString(),
      requestExpiresAt: expires.toISOString(),
      requestPeriod: periodId,
    },
    overrideAccess: true,
  });

  let delivery: "resend" | "console" | "failed" = "console";
  try {
    delivery = await deliverInviteEmail({
      to: supplier.contactEmail,
      orgName: auth.activeOrg.name,
      link,
      expiresIso: expires.toISOString(),
      welcomeMessage: portal.welcomeMessage,
    });
  } catch (err) {
    console.error("[portal invite] email failed", err);
    return NextResponse.json(
      {
        ok: true,
        link,
        delivery: "failed",
        error: "Invite saved, but email failed. Copy the link and send it manually.",
        expiresAt: expires.toISOString(),
      },
      { status: 200 },
    );
  }

  return NextResponse.json({
    ok: true,
    link,
    delivery,
    expiresAt: expires.toISOString(),
  });
}
