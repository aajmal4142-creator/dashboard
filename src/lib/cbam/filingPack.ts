/**
 * Pure CBAM filing pack builders. Zero I/O.
 */

import type { CbamLiabilityResult, CbamLineResult, CbamQuarter } from "./types";

export type CbamDeclarant = {
  name: string | null;
  eori: string | null;
  country: string | null;
  email: string | null;
};

type FilingGood = {
  id: string;
  cnCode: string;
  description: string | null;
  quantity: number | null;
  quantityUnit: string;
  directEmissions: number | null;
  indirectEmissions: number | null;
  usesDefaultValues: boolean;
  installationCountry: string;
  notes: string | null;
  line: CbamLineResult;
};

type FilingDeclaration = {
  id: string;
  label: string;
  status: string;
  certificatePriceEur: number | null;
  notes: string | null;
};

export type CbamFilingPack = {
  formatVersion: "1.0";
  generatedAt: string;
  reportingYear: number;
  reportingQuarter: CbamQuarter;
  declaration: {
    id: string | null;
    status: string;
    label: string | null;
    certificatePriceEur: number | null;
    notes: string | null;
  };
  declarant: CbamDeclarant;
  liability: CbamLiabilityResult;
  goods: Array<{
    id: string;
    cnCode: string;
    description: string | null;
    quantity: number | null;
    quantityUnit: string;
    directEmissions: number | null;
    indirectEmissions: number | null;
    usesDefaultValues: boolean;
    installationCountry: string;
    embeddedTotal: number | null;
    quality: string;
    notes: string | null;
  }>;
  warnings: string[];
};

export function buildFilingPack(input: {
  year: number;
  quarter: CbamQuarter;
  declaration: FilingDeclaration | null;
  goods: FilingGood[];
  liability: CbamLiabilityResult;
  declarant: CbamDeclarant;
  generatedAt?: string;
}): CbamFilingPack {
  const warnings: string[] = [];
  if (!input.declaration) {
    warnings.push("No declaration draft for this quarter.");
  } else if (input.declaration.status === "draft") {
    warnings.push("Declaration is still draft — mark ready or submitted before filing.");
  }
  if (input.goods.some((g) => g.usesDefaultValues)) {
    warnings.push(
      "One or more lines use default values (usesDefaultValues=true). Confirm against competent-authority tables.",
    );
  }
  if (input.liability.quality === "missing") {
    warnings.push(input.liability.message ?? "Liability quality is missing.");
  }
  if (!input.declarant.name || !input.declarant.eori) {
    warnings.push("Declarant name and EORI are recommended for the filing pack.");
  }

  return {
    formatVersion: "1.0",
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    reportingYear: input.year,
    reportingQuarter: input.quarter,
    declaration: {
      id: input.declaration?.id ?? null,
      status: input.declaration?.status ?? "none",
      label: input.declaration?.label ?? null,
      certificatePriceEur: input.declaration?.certificatePriceEur ?? null,
      notes: input.declaration?.notes ?? null,
    },
    declarant: input.declarant,
    liability: input.liability,
    goods: input.goods.map((g) => ({
      id: g.id,
      cnCode: g.cnCode,
      description: g.description,
      quantity: g.quantity,
      quantityUnit: g.quantityUnit,
      directEmissions: g.directEmissions,
      indirectEmissions: g.indirectEmissions,
      usesDefaultValues: g.usesDefaultValues,
      installationCountry: g.installationCountry,
      embeddedTotal: g.line.embeddedTotal,
      quality: g.line.quality,
      notes: g.notes,
    })),
    warnings,
  };
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

/** Goods-centric CSV for customs / spreadsheet handoff. */
export function filingPackToCsv(pack: CbamFilingPack): string {
  const header = [
    "reportingYear",
    "reportingQuarter",
    "declarationStatus",
    "declarantName",
    "declarantEori",
    "declarantCountry",
    "cnCode",
    "description",
    "quantity",
    "quantityUnit",
    "directEmissions",
    "indirectEmissions",
    "usesDefaultValues",
    "installationCountry",
    "embeddedTotal_tCO2e",
    "quality",
    "certificatePriceEur",
    "liabilityEur",
  ].join(",");

  const rows = pack.goods.map((g) =>
    [
      String(pack.reportingYear),
      pack.reportingQuarter,
      pack.declaration.status,
      csvEscape(pack.declarant.name ?? ""),
      csvEscape(pack.declarant.eori ?? ""),
      csvEscape(pack.declarant.country ?? ""),
      csvEscape(g.cnCode),
      csvEscape(g.description ?? ""),
      g.quantity == null ? "" : String(g.quantity),
      g.quantityUnit,
      g.directEmissions == null ? "" : String(g.directEmissions),
      g.indirectEmissions == null ? "" : String(g.indirectEmissions),
      g.usesDefaultValues ? "true" : "false",
      csvEscape(g.installationCountry),
      g.embeddedTotal == null ? "" : String(g.embeddedTotal),
      g.quality,
      pack.declaration.certificatePriceEur == null
        ? ""
        : String(pack.declaration.certificatePriceEur),
      pack.liability.liabilityEur == null ? "" : String(pack.liability.liabilityEur),
    ].join(","),
  );

  return [header, ...rows].join("\n");
}
