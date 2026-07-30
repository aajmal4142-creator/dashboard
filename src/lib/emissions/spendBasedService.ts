import { getPayload } from "payload";
import type { Where } from "payload";
import config from "@/payload.config";
import { CUSTOM_EMISSION_FACTORS_SLUG } from "@/collections/CustomEmissionFactors";
import { SPEND_BASED_EMISSIONS_SLUG } from "@/collections/SpendBasedEmissions";
import {
  aggregateSpendEmissions,
  applyRegionalAdjustment,
  calculateSpendBasedEmissions,
  factorLookupKeysForLedger,
  mapToSpendLedgerCategory,
  parseSpendImportCsv,
  type SpendAggregateResult,
  type SpendEmissionsInput,
  type SpendEmissionsResult,
  type SpendFactor,
  type SpendImportParseResult,
  type SpendImportRow,
  type SpendLedgerCategory,
} from "@/lib/calc/spendBasedEmissions";
import type { CustomEmissionFactor, SpendBasedEmission } from "@/payload-types";

type FactorSource = SpendBasedEmission["emissionsFactorSource"];
type Currency = NonNullable<SpendBasedEmission["currency"]>;
type FactorDoc = CustomEmissionFactor;

export type ListedSpendFactor = {
  id: string;
  factorName: string;
  category: string;
  subcategory: string | null;
  value: number;
  unit: string;
  source: string;
  region: string;
  confidence: "low" | "medium" | "high";
  uncertainty: number;
  effectiveDate: string;
  status: string;
};

export type SpendPreviewLine = {
  rowNumber?: number;
  input: SpendEmissionsInput;
  result: SpendEmissionsResult;
  factorRegion: string;
  regionalAdjusted: boolean;
};

export type SpendCommitResult = {
  preview: SpendPreviewLine[];
  createdIds: string[];
  datapointIds: string[];
  aggregate: SpendAggregateResult;
};

const SPEND_UNITS = new Set(["kg_co2e_usd", "kg_co2e_eur", "kg_co2e_gbp", "kg_co2e_inr"]);

function unitForCurrency(currency: string): string {
  const map: Record<string, string> = {
    USD: "kg_co2e_usd",
    EUR: "kg_co2e_eur",
    GBP: "kg_co2e_gbp",
    INR: "kg_co2e_inr",
  };
  return map[currency] ?? "kg_co2e_usd";
}

function toSpendFactor(doc: FactorDoc): SpendFactor {
  const confidence = doc.confidence;
  const resolvedConfidence =
    confidence === "low" || confidence === "medium" || confidence === "high"
      ? confidence
      : "medium";

  return {
    value: doc.value,
    confidence: resolvedConfidence,
    uncertainty: typeof doc.uncertainty === "number" ? doc.uncertainty : 25,
    source: doc.source,
    region: doc.region ?? "Global",
  };
}

function mapFactorSource(source: string): FactorSource {
  const allowed: FactorSource[] = ["useeio", "exiobase", "custom", "supplier"];
  return allowed.includes(source as FactorSource) ? (source as FactorSource) : "custom";
}

/**
 * Load regional multiplier from org factor metadata (metadata.regionalMultiplier)
 * or from a dedicated factor named regional_adjustment:{region}.
 * Returns null when none exists — caller decides whether to use Global as-is.
 */
async function loadRegionalMultiplier(
  orgId: string,
  region: string,
): Promise<number | null> {
  const payload = await getPayload({ config });
  const key = `regional_adjustment:${region}`;

  const named = await payload.find({
    collection: CUSTOM_EMISSION_FACTORS_SLUG,
    where: {
      and: [
        { organisation: { equals: orgId } },
        { factorName: { equals: key } },
        { status: { equals: "active" } },
      ],
    },
    sort: "-effectiveDate",
    limit: 1,
    overrideAccess: true,
  });

  const doc = named.docs[0];
  if (doc && Number.isFinite(doc.value) && doc.value > 0) {
    return doc.value;
  }

  return null;
}

async function findActiveFactor(
  orgId: string,
  categoryKeys: string[],
  region: string,
  currencyUnit: string,
): Promise<FactorDoc | null> {
  const payload = await getPayload({ config });

  for (const category of categoryKeys) {
    const exact = await payload.find({
      collection: CUSTOM_EMISSION_FACTORS_SLUG,
      where: {
        and: [
          { organisation: { equals: orgId } },
          { category: { equals: category } },
          { region: { equals: region } },
          { status: { equals: "active" } },
          { unit: { equals: currencyUnit } },
        ],
      },
      sort: "-effectiveDate",
      limit: 1,
      overrideAccess: true,
    });
    if (exact.docs[0]) return exact.docs[0];

    // Prefer currency-specific unit; fall back to USD unit if needed
    if (currencyUnit !== "kg_co2e_usd") {
      const usdFallback = await payload.find({
        collection: CUSTOM_EMISSION_FACTORS_SLUG,
        where: {
          and: [
            { organisation: { equals: orgId } },
            { category: { equals: category } },
            { region: { equals: region } },
            { status: { equals: "active" } },
            { unit: { equals: "kg_co2e_usd" } },
          ],
        },
        sort: "-effectiveDate",
        limit: 1,
        overrideAccess: true,
      });
      if (usdFallback.docs[0]) return usdFallback.docs[0];
    }

    // Any spend unit for category+region
    const anyUnit = await payload.find({
      collection: CUSTOM_EMISSION_FACTORS_SLUG,
      where: {
        and: [
          { organisation: { equals: orgId } },
          { category: { equals: category } },
          { region: { equals: region } },
          { status: { equals: "active" } },
        ],
      },
      sort: "-effectiveDate",
      limit: 10,
      overrideAccess: true,
    });
    const spendDoc = anyUnit.docs.find((d) => SPEND_UNITS.has(d.unit));
    if (spendDoc) return spendDoc;
  }

  return null;
}

export type LoadedSpendFactor = {
  factor: SpendFactor;
  regionalAdjusted: boolean;
};

/**
 * Load the active spend emissions factor for a category/region from the registry.
 * Tries region-specific first, then Global. Optional regional multiplier adjusts Global.
 * Throws when no factor exists — never silently defaults.
 */
export async function loadSpendFactor(
  category: string,
  region: string | undefined,
  opts?: { orgId?: string; currency?: string },
): Promise<LoadedSpendFactor> {
  if (!opts?.orgId) {
    throw new Error("Organisation is required to load spend emissions factors");
  }

  const ledger = mapToSpendLedgerCategory(category);
  const lookupKeys = factorLookupKeysForLedger(ledger);
  const requestedRegion = region?.trim() || "Global";
  const currencyUnit = unitForCurrency(opts.currency ?? "USD");

  let doc = await findActiveFactor(opts.orgId, lookupKeys, requestedRegion, currencyUnit);

  if (!doc && requestedRegion !== "Global") {
    doc = await findActiveFactor(opts.orgId, lookupKeys, "Global", currencyUnit);
    if (doc) {
      const multiplier = await loadRegionalMultiplier(opts.orgId, requestedRegion);
      if (multiplier != null) {
        return {
          factor: applyRegionalAdjustment(toSpendFactor(doc), {
            multiplier,
            region: requestedRegion,
          }),
          regionalAdjusted: true,
        };
      }
      return {
        factor: { ...toSpendFactor(doc), region: "Global" },
        regionalAdjusted: false,
      };
    }
  }

  if (!doc) {
    throw new Error(
      `No emissions factor found for category: ${category}` +
        (requestedRegion ? ` (region: ${requestedRegion})` : ""),
    );
  }

  return { factor: toSpendFactor(doc), regionalAdjusted: false };
}

export async function calculateSpendBasedEmissionsForInput(
  input: SpendEmissionsInput,
  orgId: string,
): Promise<SpendEmissionsResult> {
  const ledger = mapToSpendLedgerCategory(input.category);
  const { factor } = await loadSpendFactor(ledger, input.region, {
    orgId,
    currency: input.currency,
  });
  return calculateSpendBasedEmissions({ ...input, category: ledger }, factor);
}

export async function listSpendFactors(
  orgId: string,
  filters?: { category?: string; region?: string },
): Promise<ListedSpendFactor[]> {
  const payload = await getPayload({ config });

  const and: Where[] = [
    { organisation: { equals: orgId } },
    { status: { equals: "active" } },
  ];

  if (filters?.category) {
    const ledger = mapToSpendLedgerCategory(filters.category);
    const keys = factorLookupKeysForLedger(ledger);
    and.push({ category: { in: keys } });
  }
  if (filters?.region) {
    and.push({ region: { equals: filters.region } });
  }

  const result = await payload.find({
    collection: CUSTOM_EMISSION_FACTORS_SLUG,
    where: { and },
    sort: "-effectiveDate",
    limit: 200,
    overrideAccess: true,
  });

  return result.docs
    .filter((d) => SPEND_UNITS.has(d.unit) || d.unit === "kg_co2e_usd")
    .map((d) => {
      const confidence =
        d.confidence === "low" || d.confidence === "medium" || d.confidence === "high"
          ? d.confidence
          : "medium";
      return {
        id: d.id,
        factorName: d.factorName,
        category: d.category,
        subcategory: d.subcategory ?? null,
        value: d.value,
        unit: d.unit,
        source: d.source,
        region: d.region ?? "Global",
        confidence,
        uncertainty: typeof d.uncertainty === "number" ? d.uncertainty : 25,
        effectiveDate: d.effectiveDate,
        status: d.status ?? "active",
      };
    });
}

export async function previewSpendBatch(
  orgId: string,
  rows: SpendImportRow[] | SpendEmissionsInput[],
): Promise<SpendPreviewLine[]> {
  const preview: SpendPreviewLine[] = [];

  for (const row of rows) {
    const rowNumber = "rowNumber" in row ? row.rowNumber : undefined;
    const ledger = mapToSpendLedgerCategory(row.category);
    const input: SpendEmissionsInput = { ...row, category: ledger };
    const { factor, regionalAdjusted } = await loadSpendFactor(ledger, input.region, {
      orgId,
      currency: input.currency,
    });

    const result = calculateSpendBasedEmissions(input, factor);
    preview.push({
      rowNumber,
      input,
      result,
      factorRegion: factor.region ?? "Global",
      regionalAdjusted,
    });
  }

  return preview;
}

export async function commitSpendBatch(
  orgId: string,
  rows: SpendImportRow[] | SpendEmissionsInput[],
  opts?: {
    actorId?: string;
    periodId?: string;
    writeDatapoints?: boolean;
  },
): Promise<SpendCommitResult> {
  const payload = await getPayload({ config });
  const preview = await previewSpendBatch(orgId, rows);
  const createdIds: string[] = [];
  const datapointIds: string[] = [];

  for (const line of preview) {
    const now = new Date().toISOString();
    const periodStart = line.input.periodStart ?? now;
    const periodEnd = line.input.periodEnd ?? now;
    const ledger = line.input.category as SpendLedgerCategory;

    const created = await payload.create({
      collection: SPEND_BASED_EMISSIONS_SLUG,
      data: {
        organisation: orgId,
        periodStart,
        periodEnd,
        category: ledger,
        subcategory: line.input.subcategory,
        totalSpend: line.result.totalSpend,
        currency: line.input.currency as Currency,
        emissionsFactor: line.result.emissionsFactor,
        calculatedEmissions: line.result.calculatedEmissions,
        emissionsFactorSource: mapFactorSource(line.result.factorSource),
        confidence: line.result.confidence,
        uncertainty: line.result.uncertainty,
        region: line.result.region ?? line.input.region ?? "Global",
        industryCode: line.input.industryCode,
        glCodeRange: line.input.glCodeRange?.map((glCode) => ({ glCode })),
        scope: "3",
        dataQuality: "estimated",
        notes: line.regionalAdjusted
          ? `Regional adjustment applied for ${line.result.region}`
          : undefined,
        auditTrail: opts?.actorId
          ? [
              {
                timestamp: now,
                action: "committed",
                changedBy: opts.actorId,
                changes: {
                  quality: "estimated",
                  provenance: "spend_estimate",
                },
              },
            ]
          : undefined,
      },
      overrideAccess: true,
    });
    createdIds.push(created.id);

    if (opts?.writeDatapoints && opts.periodId && opts.actorId) {
      const metricKey = `emissions.spend.${ledger}`;
      const dp = await payload.create({
        collection: "datapoints",
        data: {
          organisation: orgId,
          period: opts.periodId,
          metricKey,
          value: line.result.calculatedEmissions / 1000, // tCO2e
          unit: "tCO2e",
          quality: "estimated",
          provenance: "spend_estimate",
          source: "estimate",
          approvalState: "pending",
          note: `Spend-based Scope 3: ${line.result.totalSpend} ${line.input.currency} × ${line.result.emissionsFactor} (${line.result.factorSource}, ±${line.result.uncertainty}%)`,
          enteredBy: opts.actorId,
          enteredAt: now,
        },
        overrideAccess: true,
      });
      datapointIds.push(dp.id);
    }
  }

  const aggregate = aggregateSpendEmissions(
    preview.map((p) => ({
      category: p.result.category,
      calculatedEmissions: p.result.calculatedEmissions,
      emissionsFactorSource: p.result.factorSource,
    })),
  );

  return { preview, createdIds, datapointIds, aggregate };
}

export function parseAndValidateSpendCsv(csv: string): SpendImportParseResult {
  return parseSpendImportCsv(csv);
}

export async function aggregateOrgSpendEmissions(
  orgId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<SpendAggregateResult> {
  const payload = await getPayload({ config });

  const spendRecords = await payload.find({
    collection: SPEND_BASED_EMISSIONS_SLUG,
    where: {
      organisation: { equals: orgId },
      periodStart: { greater_than_equal: periodStart.toISOString() },
      periodEnd: { less_than_equal: periodEnd.toISOString() },
    },
    limit: 1000,
    overrideAccess: true,
  });

  return aggregateSpendEmissions(
    spendRecords.docs.map((record) => ({
      category: record.category,
      calculatedEmissions: record.calculatedEmissions,
      emissionsFactorSource: record.emissionsFactorSource,
    })),
  );
}
