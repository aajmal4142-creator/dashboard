import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { ABATEMENT_LEVERS_SLUG } from "@/collections/AbatementLevers";
import {
  computeOrgMacc,
  docToAbatementLever,
  isAbatementLeverCategory,
  listOrgAbatementLevers,
  type AbatementLeverCategory,
} from "@/lib/analytics";
import { getCurrentContext, isNextRedirectError } from "@/lib/auth";
import config from "@/payload.config";

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
 * GET /api/app/analytics/macc — list levers + MACC compute
 * Query: carbonPrice (optional), includeInactive=1, strict=1
 * POST — create abatement lever
 */
export async function GET(req: Request) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg || !ctx.role) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const includeInactive = url.searchParams.get("includeInactive") === "1";
    const strict = url.searchParams.get("strict") === "1";
    const carbonRaw = url.searchParams.get("carbonPrice");
    let carbonPricePerTco2e: number | null = null;
    if (carbonRaw !== null && carbonRaw !== "") {
      const n = Number(carbonRaw);
      if (!Number.isFinite(n) || n < 0) {
        return NextResponse.json(
          { error: "carbonPrice must be a non-negative number" },
          { status: 400 },
        );
      }
      carbonPricePerTco2e = n;
    }

    const payload = await getPayload({ config });
    const levers = await listOrgAbatementLevers(payload, ctx.activeOrg.id, {
      activeOnly: !includeInactive,
    });
    // Per-lever costs for every listed row; curve / aggregates use active levers only.
    const activeLevers = levers.filter((l) => l.active);

    try {
      const leverCosts = computeOrgMacc(levers, {
        carbonPricePerTco2e,
        strict: false,
      });
      const curveMacc = computeOrgMacc(activeLevers, {
        carbonPricePerTco2e,
        strict,
      });
      const macc = {
        ...curveMacc,
        levers: leverCosts.levers,
        roi: leverCosts.roi,
      };
      return NextResponse.json({
        levers,
        macc,
        carbonPricePerTco2e,
        canWrite: canWrite(ctx.role),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "MACC compute failed";
      return NextResponse.json({ error: message, levers }, { status: 400 });
    }
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("MACC list error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg || !ctx.role) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!canWrite(ctx.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await req.json()) as Record<string, unknown>;
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const abatement = parseOptionalNonNeg(
      body.annualAbatementTco2e,
      "annualAbatementTco2e",
    );
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

    const capex = parseOptionalNonNeg(body.capex, "capex");
    if (!capex.ok) {
      return NextResponse.json({ error: capex.error }, { status: 400 });
    }
    const opex = parseOptionalNonNeg(body.opexPerYear, "opexPerYear");
    if (!opex.ok) {
      return NextResponse.json({ error: opex.error }, { status: 400 });
    }
    const lifetime = parseLifetime(body.lifetimeYears);
    if (!lifetime.ok) {
      return NextResponse.json({ error: lifetime.error }, { status: 400 });
    }

    let category: AbatementLeverCategory | null = null;
    if (body.category !== undefined && body.category !== null && body.category !== "") {
      if (!isAbatementLeverCategory(body.category)) {
        return NextResponse.json(
          {
            error:
              "category must be energy_efficiency, renewable_electricity, process_fuel, fleet_transport, nature_offsets, or other",
          },
          { status: 400 },
        );
      }
      category = body.category;
    }

    const notes =
      typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null;
    const active = body.active === undefined ? true : body.active !== false;

    const payload = await getPayload({ config });
    const created = await payload.create({
      collection: ABATEMENT_LEVERS_SLUG,
      data: {
        organisation: ctx.activeOrg.id,
        name,
        category: category ?? undefined,
        annualAbatementTco2e: abatement.value,
        capex: capex.value,
        opexPerYear: opex.value,
        lifetimeYears: lifetime.value,
        notes: notes ?? undefined,
        active,
      },
      overrideAccess: true,
    });

    return NextResponse.json({ lever: docToAbatementLever(created) }, { status: 201 });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("MACC create error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
