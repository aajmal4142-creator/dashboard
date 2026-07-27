import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import {
  BillingDeniedError,
  billingDeniedResponse,
  can,
  normalizePlan,
} from "@/lib/billing";
import config from "@/payload.config";

/** Bulk nudge — emails client owner contacts via Resend/console. */
export async function POST(req: Request) {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg || ctx.activeOrg.type !== "consultancy") {
    return NextResponse.json({ error: "Consultancy required" }, { status: 403 });
  }
  if (ctx.role === "viewer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!can(ctx.activeOrg.plan, "bulk_actions")) {
    return NextResponse.json(
      billingDeniedResponse(
        new BillingDeniedError(normalizePlan(ctx.activeOrg.plan), "bulk_actions"),
      ),
      { status: 402 },
    );
  }

  const body = (await req.json()) as { clientIds?: string[]; message?: string };
  const ids = body.clientIds ?? [];
  if (ids.length === 0) {
    return NextResponse.json({ error: "clientIds required" }, { status: 400 });
  }

  const payload = await getPayload({ config });
  let sent = 0;

  for (const clientId of ids) {
    const org = await payload.findByID({
      collection: "organisations",
      id: clientId,
      depth: 0,
      overrideAccess: true,
    });
    const parent =
      typeof org.parentOrg === "object" && org.parentOrg !== null
        ? org.parentOrg.id
        : String(org.parentOrg ?? "");
    if (parent !== ctx.activeOrg.id) continue;

    const owners = await payload.find({
      collection: "memberships",
      where: {
        and: [
          { organisation: { equals: clientId } },
          { role: { equals: "owner" } },
          { status: { equals: "active" } },
        ],
      },
      depth: 1,
      limit: 3,
      overrideAccess: true,
    });

    for (const m of owners.docs) {
      const user = typeof m.user === "object" && m.user !== null ? m.user : null;
      const email = user && "email" in user ? String(user.email) : null;
      if (!email) continue;

      const subject = `${ctx.activeOrg.name}: action needed on ${org.name}`;
      const html = `<p>${body.message?.trim() || "Please update your ESG datapoints before the filing deadline."}</p>
<p>Client: ${org.name}</p>
<p>— ${ctx.activeOrg.name} via ClearESG</p>`;

      const key = process.env.RESEND_API_KEY;
      if (key) {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: process.env.RESEND_FROM ?? "ClearESG <onboarding@resend.dev>",
            to: [email],
            subject,
            html,
          }),
        });
      } else {
        console.info(`[nudge] to=${email} client=${org.name}`);
      }
      sent += 1;
    }
  }

  return NextResponse.json({ ok: true, nudgesSent: sent });
}
