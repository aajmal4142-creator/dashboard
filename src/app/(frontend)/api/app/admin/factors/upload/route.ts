import { getPayload } from "payload";
import { NextResponse } from "next/server";
import { getCurrentContext, isNextRedirectError } from "@/lib/auth";
import config from "@/payload.config";
import { validateBatch, deduplicateFactors } from "@/lib/factors/importValidator";
import { CUSTOM_EMISSION_FACTORS_SLUG } from "@/collections/CustomEmissionFactors";
import type { CustomEmissionFactor } from "@/payload-types";

type FactorVersionEntry = {
  id: string;
  value: number;
  status: CustomEmissionFactor["status"];
  effectiveDate: string;
  expiryDate: string | null | undefined;
  confidence: CustomEmissionFactor["confidence"];
};

type FactorCategory = CustomEmissionFactor["category"];
type FactorUnit = CustomEmissionFactor["unit"];
type FactorSource = CustomEmissionFactor["source"];

function asCategory(value: string): FactorCategory {
  return value as FactorCategory;
}

function asUnit(value: string): FactorUnit {
  return value as FactorUnit;
}

function asSource(value: string): FactorSource {
  const allowed: FactorSource[] = [
    "useeio",
    "exiobase",
    "ipcc",
    "epa",
    "defra",
    "ademe",
    "custom",
    "supplier",
  ];
  return allowed.includes(value as FactorSource) ? (value as FactorSource) : "custom";
}

/**
 * POST /api/app/admin/factors/upload
 * Upload and import custom emissions factors (admin only)
 */
export async function POST(request: Request) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Admin permission required
    if (ctx.role !== "admin" && ctx.role !== "owner") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = (await request.json()) as {
      factors?: unknown[];
      version?: string;
    };
    const { factors } = body;

    if (!factors || !Array.isArray(factors)) {
      return NextResponse.json({ error: "factors array is required" }, { status: 400 });
    }

    // Validate all rows
    const validation = validateBatch(factors);
    if (!validation.valid) {
      return NextResponse.json(
        {
          error: "Validation failed",
          errors: validation.errors,
        },
        { status: 400 },
      );
    }

    if (!validation.data) {
      return NextResponse.json({ error: "No valid factors to import" }, { status: 400 });
    }

    // Deduplicate
    const { deduplicated, duplicates } = deduplicateFactors(validation.data);

    const payload = await getPayload({ config });

    // Deprecate old factors with same category/subcategory/unit/region
    for (const factor of deduplicated) {
      const existing = await payload.find({
        collection: CUSTOM_EMISSION_FACTORS_SLUG,
        where: {
          organisation: { equals: ctx.activeOrg.id },
          category: { equals: asCategory(factor.category) },
          subcategory: { equals: factor.subcategory },
          unit: { equals: asUnit(factor.unit) },
          region: { equals: factor.region },
          status: { equals: "active" },
        },
        limit: 1,
      });

      if (existing.docs?.[0]) {
        await payload.update({
          collection: CUSTOM_EMISSION_FACTORS_SLUG,
          id: existing.docs[0].id,
          data: {
            status: "deprecated",
            expiryDate: new Date().toISOString(),
          },
        });
      }
    }

    // Import new factors
    const importedFactors = [];
    for (const factor of deduplicated) {
      const created = await payload.create({
        collection: CUSTOM_EMISSION_FACTORS_SLUG,
        data: {
          organisation: ctx.activeOrg.id,
          factorName: factor.factorName,
          category: asCategory(factor.category),
          subcategory: factor.subcategory,
          value: factor.value,
          unit: asUnit(factor.unit),
          source: asSource(factor.source),
          region: factor.region,
          effectiveDate: new Date(factor.effectiveDate).toISOString(),
          confidence: factor.confidence,
          uncertainty: factor.uncertainty,
          status: "active",
          createdBy: ctx.user.id,
        },
      });

      importedFactors.push(created);
    }

    return NextResponse.json(
      {
        imported: importedFactors.length,
        duplicatesSkipped: duplicates.length,
        message: `Successfully imported ${importedFactors.length} factors`,
        duplicates: duplicates.map((d) => ({
          factorName: d.factor.factorName,
          count: d.count,
        })),
      },
      { status: 201 },
    );
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error uploading factors:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * GET /api/app/admin/factors/versions
 * Get factor version history
 */
export async function GET(_request: Request) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (ctx.role !== "admin" && ctx.role !== "owner") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const payload = await getPayload({ config });

    // Get all factors (active and deprecated)
    const factors = await payload.find({
      collection: CUSTOM_EMISSION_FACTORS_SLUG,
      where: {
        organisation: { equals: ctx.activeOrg.id },
      },
      limit: 1000,
    });

    // Group by category/subcategory/unit to show version history
    const grouped: Record<string, FactorVersionEntry[]> = {};
    for (const factor of factors.docs) {
      const key = `${factor.category}|${factor.subcategory}|${factor.unit}`;
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push({
        id: factor.id,
        value: factor.value,
        status: factor.status,
        effectiveDate: factor.effectiveDate,
        expiryDate: factor.expiryDate,
        confidence: factor.confidence,
      });
    }

    // Sort by effective date for each group
    for (const key of Object.keys(grouped)) {
      grouped[key].sort(
        (a, b) =>
          new Date(b.effectiveDate).getTime() - new Date(a.effectiveDate).getTime(),
      );
    }

    return NextResponse.json({
      total: factors.totalDocs,
      versionHistory: grouped,
    });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error fetching factor versions:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
