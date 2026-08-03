import { NextResponse } from "next/server";

import { getCurrentContext, isNextRedirectError } from "@/lib/auth";
import {
  buildTradeoffComparison,
  type PurchaseOptionInput,
  type TradeoffWeights,
} from "@/lib/procurement";

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

  if (
    r.cost !== null &&
    r.cost !== undefined &&
    r.cost !== "" &&
    parseOptionalNonNeg(r.cost) === null
  ) {
    return {
      ok: false,
      error: `options[${index}].cost must be a non-negative number`,
    };
  }
  if (
    r.tco2e !== null &&
    r.tco2e !== undefined &&
    r.tco2e !== "" &&
    parseOptionalNonNeg(r.tco2e) === null
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

/**
 * POST /api/app/procurement/tradeoffs/compute
 * Deterministic ranking + Pareto without persisting.
 */
export async function POST(req: Request) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg || !ctx.role) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as Record<string, unknown>;
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

    const nested =
      body.weights && typeof body.weights === "object"
        ? (body.weights as Record<string, unknown>)
        : null;
    const weights: TradeoffWeights = {
      cost: parseWeight(nested?.cost ?? body.weightCost, 1),
      carbon: parseWeight(nested?.carbon ?? body.weightCarbon, 1),
      lead: parseWeight(nested?.lead ?? body.weightLead, 0),
    };

    const comparison = buildTradeoffComparison(options, weights);
    return NextResponse.json({ comparison, weights: comparison.ranked.weights });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Procurement tradeoffs compute error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
