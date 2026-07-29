import { getPayload } from "payload";
import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { requirePermission } from "@/lib/policy/protect";
import config from "@/payload.config";
import {
  calculateSpendBasedEmissions,
  type SpendEmissionsInput,
  validateSpendData,
} from "@/lib/calc/spendBasedEmissions";
import { incrementApiUsage } from "@/lib/billing/freeTierGates";
import type { SpendBasedEmission } from "@/payload-types";

type SpendCategory = SpendBasedEmission["category"];
type FactorSource = SpendBasedEmission["emissionsFactorSource"];
type Currency = NonNullable<SpendBasedEmission["currency"]>;

const SPEND_CATEGORIES: SpendCategory[] = [
  "raw_materials",
  "packaging",
  "fuel_energy",
  "waste",
  "services",
  "transportation",
  "facilities",
  "it",
];

function mapSpendCategory(category: string): SpendCategory {
  if (SPEND_CATEGORIES.includes(category as SpendCategory)) {
    return category as SpendCategory;
  }
  const aliases: Record<string, SpendCategory> = {
    energy: "fuel_energy",
    transport: "transportation",
    procurement: "raw_materials",
    manufacturing: "raw_materials",
    travel: "services",
    commuting: "services",
    water: "facilities",
  };
  return aliases[category] ?? "services";
}

function mapFactorSource(source: string): FactorSource {
  const allowed: FactorSource[] = ["useeio", "exiobase", "custom", "supplier"];
  return allowed.includes(source as FactorSource) ? (source as FactorSource) : "custom";
}

/**
 * POST /api/app/emissions/calculate-spend
 * Calculate Scope 3 emissions from spend data
 */
export async function POST(request: Request) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const allowed = await requirePermission(
      ctx.user.id,
      ctx.activeOrg.id,
      "create",
      "datapoints",
      ctx.activeOrg.id,
      "organisation",
    );
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = (await request.json()) as SpendEmissionsInput;

    // Validate input
    const validation = validateSpendData(body);
    if (!validation.valid) {
      return NextResponse.json(
        { error: "Validation failed", errors: validation.errors },
        { status: 400 },
      );
    }

    // Calculate emissions
    const result = await calculateSpendBasedEmissions(body);

    // Store result
    const payload = await getPayload({ config });
    const now = new Date().toISOString();
    await payload.create({
      collection: "spend-based-emissions",
      data: {
        organisation: ctx.activeOrg.id,
        periodStart: now,
        periodEnd: now,
        category: mapSpendCategory(result.category),
        totalSpend: result.totalSpend,
        currency: body.currency as Currency,
        emissionsFactor: result.emissionsFactor,
        calculatedEmissions: result.calculatedEmissions,
        emissionsFactorSource: mapFactorSource(result.factorSource),
        confidence: result.confidence,
        uncertainty: result.uncertainty,
        scope: "3",
        dataQuality: "estimated",
      },
    });

    // Track API usage
    await incrementApiUsage(ctx.activeOrg.id);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error calculating spend-based emissions:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * GET /api/app/emissions/calculate-spend?orgId=...
 * Get recent spend-based emissions calculations
 */
export async function GET(_request: Request) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const allowed = await requirePermission(
      ctx.user.id,
      ctx.activeOrg.id,
      "view",
      "datapoints",
      ctx.activeOrg.id,
      "organisation",
    );
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const payload = await getPayload({ config });

    const results = await payload.find({
      collection: "spend-based-emissions",
      where: {
        organisation: { equals: ctx.activeOrg.id },
      },
      sort: "-createdAt",
      limit: 50,
    });

    // Track API usage
    await incrementApiUsage(ctx.activeOrg.id);

    return NextResponse.json({
      total: results.totalDocs,
      calculations: results.docs,
    });
  } catch (error) {
    console.error("Error fetching spend-based emissions:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
