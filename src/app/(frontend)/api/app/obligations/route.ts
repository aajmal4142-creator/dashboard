import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import { parseRevenueBand } from "@/lib/obligations";
import {
  applyManualObligationOverride,
  persistDerivedObligations,
} from "@/lib/obligations/persist";
import config from "@/payload.config";

function requireAdmin(role: string | null): boolean {
  return role === "owner" || role === "admin";
}

/** Confirm, override, or force re-derive obligations for the active org. */
export async function POST(req: Request) {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg || !ctx.role) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!requireAdmin(ctx.role)) {
    return NextResponse.json(
      { error: "Owner or admin required to change obligations" },
      { status: 403 },
    );
  }

  const body = (await req.json()) as {
    action?: "confirm" | "override" | "rederive";
    obligationId?: string;
    filingDeadline?: string | null;
    notes?: string;
  };

  const payload = await getPayload({ config });

  if (body.action === "rederive") {
    const org = await payload.findByID({
      collection: "organisations",
      id: ctx.activeOrg.id,
      depth: 0,
      overrideAccess: true,
    });
    const persisted = await persistDerivedObligations(payload, {
      organisationId: ctx.activeOrg.id,
      actorId: ctx.user.id,
      input: {
        country: org.country,
        employeeCount: org.employeeCount ?? null,
        revenueBand: parseRevenueBand(org.revenueBand),
      },
      force: true,
    });
    return NextResponse.json({ ok: true, ...persisted });
  }

  if (!body.obligationId) {
    return NextResponse.json({ error: "obligationId required" }, { status: 400 });
  }

  if (body.action === "confirm") {
    const payloadDoc = await payload.findByID({
      collection: "compliance-obligations",
      id: body.obligationId,
      depth: 0,
      overrideAccess: true,
    });
    await applyManualObligationOverride(payload, {
      organisationId: ctx.activeOrg.id,
      actorId: ctx.user.id,
      obligationId: body.obligationId,
      filingDeadline: payloadDoc.filingDeadline ?? null,
      notes: body.notes,
      confirmOnly: true,
    });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "override") {
    if (body.filingDeadline === undefined) {
      return NextResponse.json(
        { error: "filingDeadline required for override (use null to clear)" },
        { status: 400 },
      );
    }
    await applyManualObligationOverride(payload, {
      organisationId: ctx.activeOrg.id,
      actorId: ctx.user.id,
      obligationId: body.obligationId,
      filingDeadline: body.filingDeadline,
      notes: body.notes,
      confirmOnly: false,
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
