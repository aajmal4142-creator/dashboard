import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { ABATEMENT_LEVERS_SLUG } from "@/collections/AbatementLevers";
import {
  docToAbatementLever,
  getOrgAbatementLever,
  isAbatementLeverCategory,
  type AbatementLeverCategory,
} from "@/lib/analytics";
import { getCurrentContext, isNextRedirectError } from "@/lib/auth";
import config from "@/payload.config";

type RouteContext = { params: Promise<{ id: string }> };

function canWrite(role: string | null): boolean {
  return role === "owner" || role === "admin" || role === "contributor";
}

function parseOptionalNonNeg(
  value: unknown,
  field: string,
): { ok: true; value: number } | { ok: false; error: string } {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) {
    return { ok: false, error: `${field} must be a non-negative number` };
  }
  return { ok: true, value: n };
}

function parseLifetime(
  value: unknown,
): { ok: true; value: number } | { ok: false; error: string } {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 1 || !Number.isInteger(n)) {
    return {
      ok: false,
      error: "lifetimeYears must be an integer ≥ 1",
    };
  }
  return { ok: true, value: n };
}

/**
 * GET /api/app/analytics/macc/[id]
 * PUT — update
 * DELETE — remove
 */
export async function GET(_req: Request, context: RouteContext) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg || !ctx.role) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const payload = await getPayload({ config });
    const lever = await getOrgAbatementLever(payload, ctx.activeOrg.id, id);
    if (!lever) {
      return NextResponse.json({ error: "Lever not found" }, { status: 404 });
    }

    return NextResponse.json({ lever });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("MACC get error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: Request, context: RouteContext) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg || !ctx.role) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!canWrite(ctx.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await context.params;
    const payload = await getPayload({ config });
    const existing = await getOrgAbatementLever(payload, ctx.activeOrg.id, id);
    if (!existing) {
      return NextResponse.json({ error: "Lever not found" }, { status: 404 });
    }

    const body = (await req.json()) as Record<string, unknown>;

    const name =
      typeof body.name === "string" && body.name.trim()
        ? body.name.trim()
        : existing.name;

    const abatementRaw =
      body.annualAbatementTco2e !== undefined
        ? body.annualAbatementTco2e
        : existing.annualAbatementTco2e;
    const abatement = parseOptionalNonNeg(abatementRaw, "annualAbatementTco2e");
    if (!abatement.ok) {
      return NextResponse.json({ error: abatement.error }, { status: 400 });
    }
    if (abatement.value === 0) {
      return NextResponse.json(
        {
          error:
            "annualAbatementTco2e must be > 0 — zero abatement cannot be placed on the MACC",
        },
        { status: 400 },
      );
    }

    const capexRaw = body.capex !== undefined ? body.capex : existing.capex;
    const capex = parseOptionalNonNeg(capexRaw, "capex");
    if (!capex.ok) {
      return NextResponse.json({ error: capex.error }, { status: 400 });
    }

    const opexRaw =
      body.opexPerYear !== undefined ? body.opexPerYear : existing.opexPerYear;
    const opex = parseOptionalNonNeg(opexRaw, "opexPerYear");
    if (!opex.ok) {
      return NextResponse.json({ error: opex.error }, { status: 400 });
    }

    const lifetimeRaw =
      body.lifetimeYears !== undefined ? body.lifetimeYears : existing.lifetimeYears;
    const lifetime = parseLifetime(lifetimeRaw);
    if (!lifetime.ok) {
      return NextResponse.json({ error: lifetime.error }, { status: 400 });
    }

    let category: AbatementLeverCategory | null = existing.category;
    if (body.category !== undefined) {
      if (body.category === null || body.category === "") {
        category = null;
      } else if (!isAbatementLeverCategory(body.category)) {
        return NextResponse.json(
          {
            error:
              "category must be energy_efficiency, renewable_electricity, process_fuel, fleet_transport, nature_offsets, or other",
          },
          { status: 400 },
        );
      } else {
        category = body.category;
      }
    }

    const notes =
      body.notes !== undefined
        ? typeof body.notes === "string" && body.notes.trim()
          ? body.notes.trim()
          : null
        : existing.notes;

    const active = body.active !== undefined ? body.active !== false : existing.active;

    const updated = await payload.update({
      collection: ABATEMENT_LEVERS_SLUG,
      id,
      data: {
        name,
        category: category ?? null,
        annualAbatementTco2e: abatement.value,
        capex: capex.value,
        opexPerYear: opex.value,
        lifetimeYears: lifetime.value,
        notes: notes ?? null,
        active,
      },
      overrideAccess: true,
    });

    return NextResponse.json({ lever: docToAbatementLever(updated) });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("MACC update error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, context: RouteContext) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg || !ctx.role) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!canWrite(ctx.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await context.params;
    const payload = await getPayload({ config });
    const existing = await getOrgAbatementLever(payload, ctx.activeOrg.id, id);
    if (!existing) {
      return NextResponse.json({ error: "Lever not found" }, { status: 404 });
    }

    await payload.delete({
      collection: ABATEMENT_LEVERS_SLUG,
      id,
      overrideAccess: true,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("MACC delete error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
