import type {
  CbamGoodInput,
  CbamLiabilityResult,
  CbamLineResult,
  CbamQuality,
  CbamQuantityUnit,
} from "./types";

/**
 * Normalise quantity to the unit expected by specific emissions.
 * For t and kg with emissions in tCO₂e/t: kg → tonnes.
 * For mwh: leave as MWh (emissions are tCO₂e/MWh).
 */
export function normaliseQuantity(
  quantity: number | null,
  unit: CbamQuantityUnit,
): number | null {
  if (quantity === null || !Number.isFinite(quantity) || quantity < 0) return null;
  if (unit === "kg") return quantity / 1000;
  return quantity;
}

function lineQuality(
  input: CbamGoodInput,
  embeddedTotal: number | null,
  hasMissingComponent: boolean,
): { quality: CbamQuality; message: string | null } {
  if (input.quantity === null || !Number.isFinite(input.quantity) || input.quantity < 0) {
    return { quality: "missing", message: "Quantity is missing or invalid." };
  }
  if (hasMissingComponent || embeddedTotal === null) {
    return {
      quality: "missing",
      message:
        "Direct and/or indirect embedded emissions are missing. Enter both, or mark the gap explicitly — values are never treated as zero.",
    };
  }
  if (input.usesDefaultValues) {
    return {
      quality: "estimated",
      message: "Commission default values flagged for this line.",
    };
  }
  return { quality: "measured", message: null };
}

/**
 * Embedded emissions for one goods line.
 * Formula: quantity_norm × (direct + indirect) when both specific values are present.
 */
export function calculateCbamLineEmissions(input: CbamGoodInput): CbamLineResult {
  const quantityNormalised = normaliseQuantity(input.quantity, input.quantityUnit);
  const directOk =
    input.directEmissions !== null &&
    Number.isFinite(input.directEmissions) &&
    input.directEmissions >= 0;
  const indirectOk =
    input.indirectEmissions !== null &&
    Number.isFinite(input.indirectEmissions) &&
    input.indirectEmissions >= 0;

  const hasMissingComponent = !directOk || !indirectOk;

  let directTotal: number | null = null;
  let indirectTotal: number | null = null;
  let embeddedTotal: number | null = null;

  if (quantityNormalised !== null && directOk) {
    directTotal = quantityNormalised * (input.directEmissions as number);
  }
  if (quantityNormalised !== null && indirectOk) {
    indirectTotal = quantityNormalised * (input.indirectEmissions as number);
  }
  if (directTotal !== null && indirectTotal !== null) {
    embeddedTotal = directTotal + indirectTotal;
  }

  const { quality, message } = lineQuality(input, embeddedTotal, hasMissingComponent);

  return {
    quantityNormalised,
    quantityUnit: input.quantityUnit,
    directTotal,
    indirectTotal,
    embeddedTotal,
    quality,
    message,
  };
}

/**
 * Quarterly (or any set) liability estimate from completed line results.
 * Liability = Σ embedded × certificatePriceEur. Missing price or any missing line
 * still sums measured/estimated lines for embedded, but liability quality becomes missing
 * when price is absent; aggregate quality is missing if any line is missing.
 */
export function estimateCbamLiability(opts: {
  lines: CbamLineResult[];
  certificatePriceEur: number | null;
  defaultValueLineCount?: number;
}): CbamLiabilityResult {
  const { lines, certificatePriceEur } = opts;
  let embeddedSum = 0;
  let hasEmbedded = false;
  let measuredLines = 0;
  let estimatedLines = 0;
  let missingLines = 0;

  for (const line of lines) {
    if (line.quality === "measured") measuredLines += 1;
    else if (line.quality === "estimated") estimatedLines += 1;
    else missingLines += 1;

    if (line.embeddedTotal !== null && Number.isFinite(line.embeddedTotal)) {
      embeddedSum += line.embeddedTotal;
      hasEmbedded = true;
    }
  }

  const embeddedTotal = hasEmbedded ? embeddedSum : null;
  const priceOk =
    certificatePriceEur !== null &&
    Number.isFinite(certificatePriceEur) &&
    certificatePriceEur >= 0;

  let liabilityEur: number | null = null;
  let quality: CbamQuality = "measured";
  let message: string | null = null;

  if (lines.length === 0) {
    return {
      embeddedTotal: null,
      certificatePriceEur: priceOk ? certificatePriceEur : null,
      liabilityEur: null,
      quality: "missing",
      message: "No goods lines in this period.",
      lineCount: 0,
      measuredLines: 0,
      estimatedLines: 0,
      missingLines: 0,
      defaultValueLines: opts.defaultValueLineCount ?? 0,
    };
  }

  if (missingLines > 0) {
    quality = "missing";
    message = `${missingLines} line(s) have missing quantity or emissions. Incomplete lines are excluded from the liability total.`;
  } else if (estimatedLines > 0) {
    quality = "estimated";
    message = `${estimatedLines} line(s) use Commission default values.`;
  }

  if (!priceOk) {
    quality = "missing";
    message = message
      ? `${message} Certificate price (€/tCO₂e) is not set — liability cannot be estimated.`
      : "Certificate price (€/tCO₂e) is not set — liability cannot be estimated.";
  } else if (embeddedTotal !== null) {
    liabilityEur = embeddedTotal * certificatePriceEur;
  }

  return {
    embeddedTotal,
    certificatePriceEur: priceOk ? certificatePriceEur : null,
    liabilityEur,
    quality,
    message,
    lineCount: lines.length,
    measuredLines,
    estimatedLines,
    missingLines,
    defaultValueLines: opts.defaultValueLineCount ?? estimatedLines,
  };
}
