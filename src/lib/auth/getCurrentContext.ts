import { auth, currentUser } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getPayload } from "payload";
import { cache } from "react";

import type { MembershipRole } from "@/lib/access/membership";
import {
  BRAND_COOKIE,
  brandCookieOptions,
  brandingToCookiePayload,
  resolveOrgBranding,
  serializeBrandCookie,
  type OrgBranding,
} from "@/lib/branding";
import { devBypassAllowed } from "@/lib/launch/gates";
import config from "@/payload.config";

export type AuthContext = {
  user: {
    id: string;
    clerkId: string | null;
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
  memberships: Array<{
    id: string;
    organisationId: string;
    organisationName: string;
    role: MembershipRole;
    status: string;
  }>;
  activeOrg: {
    id: string;
    name: string;
    slug: string;
    type: "company" | "consultancy";
    country: string;
    sector: string;
    fiscalYearEnd: string | null;
    onboardedAt: string | null;
    plan: string;
    subscriptionStatus: string;
    benchmarkOptOut: boolean;
    brand: {
      primaryColor: string | null;
      domain: string | null;
      /** Full dashboard branding (settings + legacy fallback). */
      branding: OrgBranding;
    };
  } | null;
  role: MembershipRole | null;
};

export const ACTIVE_ORG_COOKIE = "clearesg_active_org";

const hasClerk = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY,
);

async function loadMemberships(
  payload: Awaited<ReturnType<typeof getPayload>>,
  userId: string,
) {
  const membershipResult = await payload.find({
    collection: "memberships",
    where: {
      and: [{ user: { equals: userId } }, { status: { equals: "active" } }],
    },
    depth: 1,
    limit: 100,
    overrideAccess: true,
  });

  return membershipResult.docs.map((m) => {
    const org =
      typeof m.organisation === "object" && m.organisation !== null
        ? m.organisation
        : null;
    return {
      id: m.id,
      organisationId: org ? org.id : String(m.organisation),
      organisationName: org && "name" in org ? String(org.name) : "",
      role: m.role as MembershipRole,
      status: m.status,
    };
  });
}

async function resolveActiveOrg(
  payload: Awaited<ReturnType<typeof getPayload>>,
  memberships: AuthContext["memberships"],
): Promise<Pick<AuthContext, "activeOrg" | "role">> {
  const jar = await cookies();
  const cookieOrg = jar.get(ACTIVE_ORG_COOKIE)?.value ?? null;
  const validOrgIds = new Set(memberships.map((m) => m.organisationId));
  const activeOrgId =
    cookieOrg && validOrgIds.has(cookieOrg)
      ? cookieOrg
      : (memberships[0]?.organisationId ?? null);

  if (!activeOrgId) return { activeOrg: null, role: null };

  const org = await payload.findByID({
    collection: "organisations",
    id: activeOrgId,
    depth: 1,
    overrideAccess: true,
  });

  const branding = resolveOrgBranding(org);

  try {
    jar.set(
      BRAND_COOKIE,
      serializeBrandCookie(brandingToCookiePayload(activeOrgId, branding)),
      brandCookieOptions,
    );
  } catch {
    /* cookies() may be read-only outside Server Actions / Route Handlers in some contexts */
  }

  return {
    activeOrg: {
      id: org.id,
      name: org.name,
      slug: org.slug,
      type: org.type,
      country: org.country,
      sector: org.sector,
      fiscalYearEnd: org.fiscalYearEnd ?? null,
      onboardedAt: org.onboardedAt ? String(org.onboardedAt) : null,
      plan: org.plan ?? "free",
      subscriptionStatus: org.subscriptionStatus ?? "none",
      benchmarkOptOut: Boolean(org.benchmarkOptOut),
      brand: {
        primaryColor: branding.primaryColor,
        domain: branding.domain,
        branding,
      },
    },
    role: memberships.find((m) => m.organisationId === activeOrgId)?.role ?? null,
  };
}

/**
 * Single auth entry point. Login ≠ access — Membership is re-checked every call.
 * Active-org cookie is never trusted alone.
 *
 * When Clerk keys are absent, CLEARESG_DEV_BYPASS=1 loads the seeded demo user
 * so local Phase 4–6 work can proceed. Never enable in production.
 */
export const getCurrentContext = cache(async (): Promise<AuthContext> => {
  const payload = await getPayload({ config });

  if (!hasClerk) {
    if (!devBypassAllowed()) {
      redirect("/sign-in");
    }
    const demo = await payload.find({
      collection: "users",
      where: { email: { equals: "demo@clearesg.local" } },
      limit: 1,
      overrideAccess: true,
    });
    if (!demo.docs[0]) {
      throw new Error("Dev bypass requires seeded demo@clearesg.local user");
    }
    const userDoc = demo.docs[0];
    const memberships = await loadMemberships(payload, userDoc.id);
    const { activeOrg, role } = await resolveActiveOrg(payload, memberships);
    return {
      user: {
        id: userDoc.id,
        clerkId: userDoc.clerkId ?? null,
        email: userDoc.email,
        firstName: userDoc.firstName ?? null,
        lastName: userDoc.lastName ?? null,
      },
      memberships,
      activeOrg,
      role,
    };
  }

  // Resource-level gate (Clerk: do not gate via createRouteMatcher in proxy).
  await auth.protect();

  const clerkUser = await currentUser();
  if (!clerkUser) {
    redirect("/sign-in");
  }

  const email =
    clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId)
      ?.emailAddress ??
    clerkUser.emailAddresses[0]?.emailAddress ??
    "";

  // Prefer clerkId; fall back to email so invite/demo users link to the same Payload row.
  const byClerk = (
    await payload.find({
      collection: "users",
      where: { clerkId: { equals: clerkUser.id } },
      limit: 1,
      overrideAccess: true,
    })
  ).docs[0];

  const byEmail = email
    ? (
        await payload.find({
          collection: "users",
          where: { email: { equals: email } },
          limit: 1,
          overrideAccess: true,
        })
      ).docs[0]
    : undefined;

  let userDoc = byClerk ?? byEmail;

  // If Clerk and email pointed at different rows, move memberships onto the Clerk row.
  if (byClerk && byEmail && byClerk.id !== byEmail.id) {
    const orphanMemberships = await payload.find({
      collection: "memberships",
      where: { user: { equals: byEmail.id } },
      limit: 100,
      overrideAccess: true,
    });
    for (const m of orphanMemberships.docs) {
      await payload.update({
        collection: "memberships",
        id: m.id,
        data: { user: byClerk.id },
        overrideAccess: true,
      });
    }
    userDoc = byClerk;
  }

  if (!userDoc) {
    userDoc = await payload.create({
      collection: "users",
      data: {
        clerkId: clerkUser.id,
        email,
        firstName: clerkUser.firstName ?? undefined,
        lastName: clerkUser.lastName ?? undefined,
        avatarUrl: clerkUser.imageUrl,
        lastSeenAt: new Date().toISOString(),
        password: `clerk-${clerkUser.id}-${Date.now()}`,
      },
      overrideAccess: true,
    });
  } else {
    const nextFirst = clerkUser.firstName ?? null;
    const nextLast = clerkUser.lastName ?? null;
    const nextAvatar = clerkUser.imageUrl ?? null;
    const needsClerkLink = userDoc.clerkId !== clerkUser.id;
    const profileChanged =
      needsClerkLink ||
      userDoc.email !== email ||
      (userDoc.firstName ?? null) !== nextFirst ||
      (userDoc.lastName ?? null) !== nextLast ||
      (userDoc.avatarUrl ?? null) !== nextAvatar;

    const lastSeenMs = userDoc.lastSeenAt
      ? new Date(String(userDoc.lastSeenAt)).getTime()
      : 0;
    const lastSeenStale = Date.now() - lastSeenMs > 5 * 60 * 1000;

    if (profileChanged || lastSeenStale) {
      try {
        await payload.update({
          collection: "users",
          id: userDoc.id,
          data: {
            clerkId: clerkUser.id,
            email,
            firstName: clerkUser.firstName ?? undefined,
            lastName: clerkUser.lastName ?? undefined,
            avatarUrl: clerkUser.imageUrl,
            lastSeenAt: new Date().toISOString(),
          },
          overrideAccess: true,
        });
      } catch (err) {
        console.warn("[auth] user touch skipped", err);
      }
    }
  }

  // Activate any pending invites for this email.
  if (email) {
    const pending = await payload.find({
      collection: "memberships",
      where: {
        and: [{ status: { equals: "invited" } }, { user: { equals: userDoc.id } }],
      },
      limit: 20,
      overrideAccess: true,
    });
    for (const m of pending.docs) {
      await payload.update({
        collection: "memberships",
        id: m.id,
        data: { status: "active", acceptedAt: new Date().toISOString() },
        overrideAccess: true,
      });
    }
  }

  const memberships = await loadMemberships(payload, userDoc.id);
  const { activeOrg, role } = await resolveActiveOrg(payload, memberships);

  return {
    user: {
      id: userDoc.id,
      clerkId: clerkUser.id,
      email,
      firstName: clerkUser.firstName,
      lastName: clerkUser.lastName,
    },
    memberships,
    activeOrg,
    role,
  };
});
