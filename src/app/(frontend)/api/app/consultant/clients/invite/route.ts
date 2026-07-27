import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import {
  assertCan,
  BillingDeniedError,
  billingDeniedResponse,
  limits,
  resolveEffectivePlan,
} from "@/lib/billing";
import { writeAuditLog } from "@/lib/audit/write";
import { deriveObligations } from "@/lib/obligations";
import { sendTransactionalEmail } from "@/lib/email/send";
import config from "@/payload.config";

/**
 * Consultant → client invite: pre-branded child org, half set-up. §15.3
 */
export async function POST(req: Request) {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg || !ctx.role) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (ctx.activeOrg.type !== "consultancy") {
    return NextResponse.json(
      { error: "Only consultancy organisations can invite clients" },
      { status: 403 },
    );
  }

  const effective = resolveEffectivePlan({
    plan: ctx.activeOrg.plan,
    subscriptionStatus: ctx.activeOrg.subscriptionStatus,
  });
  try {
    assertCan(effective, "consultant_cc");
  } catch (err) {
    if (err instanceof BillingDeniedError) {
      return NextResponse.json(billingDeniedResponse(err), { status: 402 });
    }
    throw err;
  }

  const body = (await req.json()) as {
    email?: string;
    clientName?: string;
    sector?: string;
    country?: string;
    framework?: "CSRD_SIMPLIFIED" | "BRSR";
  };
  const email = body.email?.trim().toLowerCase();
  if (!email || !body.clientName?.trim()) {
    return NextResponse.json({ error: "email and clientName required" }, { status: 400 });
  }

  const payload = await getPayload({ config });
  const parent = await payload.findByID({
    collection: "organisations",
    id: ctx.activeOrg.id,
    depth: 1,
    overrideAccess: true,
  });

  const maxClients = limits(
    resolveEffectivePlan({
      plan: parent.plan,
      subscriptionStatus: parent.subscriptionStatus,
    }),
  ).maxClients;
  const children = await payload.find({
    collection: "organisations",
    where: { parentOrg: { equals: parent.id } },
    limit: 1,
    overrideAccess: true,
  });
  if (children.totalDocs >= maxClients) {
    return NextResponse.json(
      {
        error: `Client seat limit reached (${maxClients}). Upgrade or archive a client.`,
        code: "BILLING_DENIED",
        upgradePath: "/dashboard/billing",
      },
      { status: 402 },
    );
  }

  const slugBase = body.clientName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  const slug = `${slugBase}-${Date.now().toString(36)}`;

  const parentBranding = parent.settings?.branding ?? parent.brand;
  const parentDomain = parent.settings?.domain ?? parent.brand?.domain;
  const parentLogo =
    typeof parentBranding?.logo === "object" && parentBranding?.logo !== null
      ? parentBranding.logo.id
      : (parentBranding?.logo ?? undefined);
  const parentPrimary =
    parent.settings?.branding?.primaryColor ?? parent.brand?.primaryColor ?? undefined;

  const child = await payload.create({
    collection: "organisations",
    data: {
      name: body.clientName.trim(),
      slug,
      type: "company",
      parentOrg: parent.id,
      sector: body.sector ?? parent.sector,
      country: body.country ?? parent.country ?? "IN",
      plan: "free",
      brand: parentBranding
        ? {
            primaryColor: parentPrimary,
            domain: parentDomain ?? undefined,
            logo: parentLogo,
          }
        : undefined,
      settings: parentBranding
        ? {
            branding: {
              primaryColor: parentPrimary,
              secondaryColor: parent.settings?.branding?.secondaryColor ?? undefined,
              fontFamily: parent.settings?.branding?.fontFamily ?? undefined,
              defaultMode: parent.settings?.branding?.defaultMode ?? undefined,
              radius: parent.settings?.branding?.radius ?? undefined,
              logo: parentLogo,
            },
            domain: parentDomain ?? undefined,
          }
        : undefined,
    },
    overrideAccess: true,
  });

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

  await payload.create({
    collection: "memberships",
    data: {
      organisation: child.id,
      user: user.id,
      role: "owner",
      status: "invited",
      invitedBy: ctx.user.id,
      invitedAt: new Date().toISOString(),
    },
    overrideAccess: true,
  });

  const country = (body.country ?? parent.country ?? "IN").toUpperCase();
  const framework = body.framework ?? (country === "IN" ? "BRSR" : "CSRD_SIMPLIFIED");

  // Invite often lacks headcount/revenue — run the engine with what we have.
  // Any provisional +180d date is ALWAYS needs_confirmation, never "derived".
  const derived = deriveObligations({
    country,
    employeeCount: null,
    revenueBand: null,
  });
  const primary = derived.obligations[0];

  let filingDeadline: string | null = primary?.filingDeadline ?? null;
  let confidence: "derived" | "needs_confirmation" = "needs_confirmation";
  let wave = primary?.wave ?? (framework === "BRSR" ? "brsr_supply" : "3");
  let standardVersion =
    primary?.standardVersion ?? (framework === "BRSR" ? "BRSR" : "CSRD_SIMPLIFIED");
  const firstReportingFY = primary?.firstReportingFY ?? `FY${new Date().getFullYear()}`;
  const jurisdiction = primary?.jurisdiction ?? country;
  let derivationReason =
    primary?.reason ??
    "Created from a consultant invite. Confirm the applicable framework and deadline with the client.";

  if (filingDeadline == null && framework === "CSRD_SIMPLIFIED") {
    // Provisional runway date for invite UX only — never confidence: derived.
    filingDeadline = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    confidence = "needs_confirmation";
    wave = "3";
    standardVersion = "CSRD_SIMPLIFIED";
    derivationReason =
      "Provisional deadline from consultant invite (+180 days). Not derived from a completed baseline — confirm with the client before treating as authoritative.";
  } else if (primary) {
    confidence = "needs_confirmation";
    derivationReason = `${primary.reason}\n\nCreated from a consultant invite — confirm with the client before treating as authoritative.`;
  }

  await payload.create({
    collection: "compliance-obligations",
    data: {
      organisation: child.id,
      wave,
      jurisdiction,
      standardVersion,
      firstReportingFY,
      filingDeadline,
      derivationReason,
      confidence,
      source: "engine",
      derivedInputs: {
        country,
        headcount: null,
        revenueBand: null,
        asOf: new Date().toISOString().slice(0, 10),
      },
    },
    overrideAccess: true,
  });

  const origin = new URL(req.url).origin;
  const delivery = await sendTransactionalEmail({
    to: email,
    subject: `${parent.name} invited you to ClearESG`,
    html: `<p><strong>${parent.name}</strong> set up <strong>${child.name}</strong> for ESG reporting.</p><p><a href="${origin}/sign-in">Sign in to continue onboarding</a></p>`,
  });

  await writeAuditLog(payload, {
    organisationId: parent.id,
    actorId: ctx.user.id,
    action: "consultant.client_invite",
    entityType: "organisations",
    entityId: child.id,
    after: { email, framework, slug: child.slug },
  });

  return NextResponse.json({
    ok: true,
    clientId: child.id,
    slug: child.slug,
    delivery: delivery.delivery,
  });
}
