import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { PROCUREMENT_TRADEOFFS_SLUG } from "@/collections/ProcurementTradeoffs";
import { getCurrentContext, isNextRedirectError } from "@/lib/auth";
import {
  buildTradeoffComparison,
  computeScenarioTradeoff,
  docToTradeoffScenario,
  listOrgTradeoffScenarios,
  type PurchaseOptionInput,
  type TradeoffWeights,
} from "@/lib/procurement";
import config from "@/payload.config";

function canWrite(role: string | null): boolean {
  return role === "owner" || role === "admin" || role === "contributor";
}

function parseOptionalNonNeg(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

function parseWeight(value: unknown, fallback: number): number {
  if (value === null || value === undefined || value === "") return fallback;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return n;
}

function parseOptionBody(
  row: unknown,
  index: number,
): { ok: true; value: PurchaseOptionInput } | { ok: false; error: string } {
  if (!row || typeof row !== "object") {
    return { ok: false, error: `options[${index}] must be an object` };
  }
  const r = row as Record<string, unknown>;
  const name = typeof r.name === "string" ? r.name.trim() : "";
  if (!name) {
    return { ok: false, error: `options[${index}].name is required` };
  }
  const id =
    typeof r.id === "string" && r.id.trim()
      ? r.id.trim()
      : typeof r.optionId === "string" && r.optionId.trim()
        ? r.optionId.trim()
        : `opt-${index + 1}`;

  const costRaw = r.cost;
  if (
    costRaw !== null &&
    costRaw !== undefined &&
    costRaw !== "" &&
    parseOptionalNonNeg(costRaw) === null
  ) {
    return { ok: false, error: `options[${index}].cost must be a non-negative number` };
  }
  const tco2eRaw = r.tco2e;
  if (
    tco2eRaw !== null &&
    tco2eRaw !== undefined &&
    tco2eRaw !== "" &&
    parseOptionalNonNeg(tco2eRaw) === null
  ) {
    return {
      ok: false,
      error: `options[${index}].tco2e must be a non-negative number`,
    };
  }

  return {
    ok: true,
    value: {
      id,
      name,
      cost: parseOptionalNonNeg(r.cost),
      tco2e: parseOptionalNonNeg(r.tco2e),
      factorTco2ePerUnit: parseOptionalNonNeg(r.factorTco2ePerUnit),
      quantity: parseOptionalNonNeg(r.quantity),
      leadDays: parseOptionalNonNeg(r.leadDays),
    },
  };
}

function parseWeightsBody(body: Record<string, unknown>): TradeoffWeights {
  const nested =
    body.weights && typeof body.weights === "object"
      ? (body.weights as Record<string, unknown>)
      : null;
  return {
    cost: parseWeight(nested?.cost ?? body.weightCost, 1),
    carbon: parseWeight(nested?.carbon ?? body.weightCarbon, 1),
    lead: parseWeight(nested?.lead ?? body.weightLead, 0),
  };
}

/**
 * GET /api/app/procurement/tradeoffs — list saved scenarios (+ computed ranks)
 * POST — create named comparison scenario
 */
export async function GET() {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg || !ctx.role) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await getPayload({ config });
    const scenarios = await listOrgTradeoffScenarios(payload, ctx.activeOrg.id);
    const items = scenarios.map((scenario) => ({
      scenario,
      comparison: computeScenarioTradeoff(scenario),
    }));

    return NextResponse.json({
      scenarios: items,
      canWrite: canWrite(ctx.role),
    });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Procurement tradeoffs list error:", error);
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

    const rawOptions = Array.isArray(body.options) ? body.options : [];
    if (rawOptions.length === 0) {
      return NextResponse.json(
        { error: "options must include at least one purchase option" },
        { status: 400 },
      );
    }

    const options: PurchaseOptionInput[] = [];
    for (let i = 0; i < rawOptions.length; i++) {
      const parsed = parseOptionBody(rawOptions[i], i);
      if (!parsed.ok) {
        return NextResponse.json({ error: parsed.error }, { status: 400 });
      }
      options.push(parsed.value);
    }

    const weights = parseWeightsBody(body);
    const notes =
      typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null;

    const payload = await getPayload({ config });
    const created = await payload.create({
      collection: PROCUREMENT_TRADEOFFS_SLUG,
      data: {
        organisation: ctx.activeOrg.id,
        name,
        notes: notes ?? undefined,
        weightCost: weights.cost,
        weightCarbon: weights.carbon,
        weightLead: weights.lead,
        options: options.map((o) => ({
          optionId: o.id,
          name: o.name,
          cost: o.cost ?? undefined,
          tco2e: o.tco2e ?? undefined,
          factorTco2ePerUnit: o.factorTco2ePerUnit ?? undefined,
          quantity: o.quantity ?? undefined,
          leadDays: o.leadDays ?? undefined,
        })),
      },
      overrideAccess: true,
    });

    const scenario = docToTradeoffScenario(created);
    const comparison = buildTradeoffComparison(options, weights);

    return NextResponse.json({ scenario, comparison }, { status: 201 });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Procurement tradeoffs create error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
