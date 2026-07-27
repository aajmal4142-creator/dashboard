import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import config from "@/payload.config";

/** Membership teammates for people-picker (same org). */
export async function GET() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) {
    return NextResponse.json(
      { error: "No active organisation. Finish onboarding or switch organisation." },
      { status: 403 },
    );
  }

  const payload = await getPayload({ config });
  const memberships = await payload.find({
    collection: "memberships",
    where: {
      and: [
        { organisation: { equals: ctx.activeOrg.id } },
        { status: { equals: "active" } },
      ],
    },
    depth: 1,
    limit: 100,
    overrideAccess: true,
  });

  const teammates = memberships.docs.map((m) => {
    const user = typeof m.user === "object" && m.user !== null ? m.user : null;
    return {
      id: user ? user.id : String(m.user),
      email: user && "email" in user ? String(user.email) : "",
      name:
        user && "firstName" in user
          ? [user.firstName, user.lastName].filter(Boolean).join(" ")
          : "",
      role: m.role,
    };
  });

  return NextResponse.json({ teammates });
}
