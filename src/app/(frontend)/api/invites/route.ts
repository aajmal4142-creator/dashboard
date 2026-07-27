import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import { sendTransactionalEmail } from "@/lib/email/send";
import config from "@/payload.config";

/**
 * Invite by email → Membership status: invited.
 * Delivers via Resend when RESEND_API_KEY is set; otherwise console.
 */
export async function POST(req: Request) {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg || !ctx.role) {
    return NextResponse.json({ error: "No active organisation" }, { status: 403 });
  }
  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return NextResponse.json({ error: "Only owner/admin can invite" }, { status: 403 });
  }

  const body = (await req.json()) as {
    email?: string;
    role?: "admin" | "contributor" | "viewer";
  };
  const email = body.email?.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }
  const role = body.role ?? "contributor";
  const rolePlain =
    role === "admin" ? "Can approve" : role === "viewer" ? "View only" : "Can edit data";

  const payload = await getPayload({ config });

  let user = (
    await payload.find({
      collection: "users",
      where: { email: { equals: email } },
      limit: 1,
      overrideAccess: true,
    })
  ).docs[0];

  if (!user) {
    user = await payload.create({
      collection: "users",
      data: {
        email,
        password: `invite-pending-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      },
      overrideAccess: true,
    });
  }

  const existing = await payload.find({
    collection: "memberships",
    where: {
      and: [
        { organisation: { equals: ctx.activeOrg.id } },
        { user: { equals: user.id } },
      ],
    },
    limit: 1,
    overrideAccess: true,
  });

  if (existing.docs[0]?.status === "active") {
    return NextResponse.json({ error: "User already a member" }, { status: 409 });
  }

  let membership = existing.docs[0];
  if (membership) {
    membership = await payload.update({
      collection: "memberships",
      id: membership.id,
      data: {
        role,
        status: "invited",
        invitedBy: ctx.user.id,
        invitedAt: new Date().toISOString(),
      },
      overrideAccess: true,
    });
  } else {
    membership = await payload.create({
      collection: "memberships",
      data: {
        organisation: ctx.activeOrg.id,
        user: user.id,
        role,
        status: "invited",
        invitedBy: ctx.user.id,
        invitedAt: new Date().toISOString(),
      },
      overrideAccess: true,
    });
  }

  const origin = new URL(req.url).origin;
  const delivery = await sendTransactionalEmail({
    to: email,
    subject: `You are invited to ${ctx.activeOrg.name} on ClearESG`,
    html: `<p>You have been invited to join <strong>${ctx.activeOrg.name}</strong> as <strong>${rolePlain}</strong> (${role}).</p><p><a href="${origin}/sign-in">Sign in to accept</a></p>`,
    text: `You are invited to ${ctx.activeOrg.name} as ${rolePlain}. Sign in at ${origin}/sign-in`,
  });

  return NextResponse.json({
    ok: true,
    membershipId: membership.id,
    status: "invited",
    delivery: delivery.delivery,
  });
}

export async function PATCH(req: Request) {
  const ctx = await getCurrentContext();
  const body = (await req.json()) as { membershipId?: string };
  if (!body.membershipId) {
    return NextResponse.json({ error: "membershipId required" }, { status: 400 });
  }

  const payload = await getPayload({ config });
  const membership = await payload.findByID({
    collection: "memberships",
    id: body.membershipId,
    depth: 0,
    overrideAccess: true,
  });

  const userRel =
    typeof membership.user === "object" && membership.user !== null
      ? membership.user.id
      : String(membership.user);
  if (userRel !== ctx.user.id) {
    return NextResponse.json({ error: "Not your invite" }, { status: 403 });
  }

  if (membership.status !== "invited") {
    return NextResponse.json({ error: "Invite not pending" }, { status: 409 });
  }

  await payload.update({
    collection: "memberships",
    id: membership.id,
    data: {
      status: "active",
      acceptedAt: new Date().toISOString(),
    },
    overrideAccess: true,
  });

  return NextResponse.json({ ok: true, status: "active" });
}
