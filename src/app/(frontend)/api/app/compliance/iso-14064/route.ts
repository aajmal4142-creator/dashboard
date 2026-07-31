import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext, isNextRedirectError } from "@/lib/auth";
import { createOrgIso14064, findOrgIso14064 } from "@/lib/compliance/iso14064Service";
import { requirePermission } from "@/lib/policy/protect";
import config from "@/payload.config";

/**
 * GET /api/app/compliance/iso-14064
 * Return the active org's ISO 14064 checklist (or null if not created).
 *
 * POST /api/app/compliance/iso-14064
 * Create checklist with 30 seeded Part 1 / Part 2 items.
 */
export async function GET() {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const allowed = await requirePermission(
      ctx.user.id,
      ctx.activeOrg.id,
      "view",
      "compliance",
      ctx.activeOrg.id,
      "organisation",
    );
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const payload = await getPayload({ config });
    const checklist = await findOrgIso14064(payload, ctx.activeOrg.id);

    if (!checklist) {
      return NextResponse.json({
        checklist: null,
        message: "No ISO 14064 checklist yet. Create one to start.",
      });
    }

    return NextResponse.json({ checklist });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error fetching ISO 14064 checklist:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST() {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const allowed = await requirePermission(
      ctx.user.id,
      ctx.activeOrg.id,
      "create",
      "compliance",
      ctx.activeOrg.id,
      "organisation",
    );
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const payload = await getPayload({ config });

    try {
      const checklist = await createOrgIso14064(payload, ctx.activeOrg.id);
      return NextResponse.json({ checklist }, { status: 201 });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Create failed";
      if (message.includes("already exists")) {
        const existing = await findOrgIso14064(payload, ctx.activeOrg.id);
        return NextResponse.json(
          { error: message, checklist: existing },
          { status: 409 },
        );
      }
      throw err;
    }
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error creating ISO 14064 checklist:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
