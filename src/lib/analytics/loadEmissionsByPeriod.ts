/**
 * Load multi-year emissions history for forecasting.
 * Uses resolveOrgBaselineByScope per year — I/O allowed here, not in forecast.ts.
 */

import type { Payload } from "payload";

import type { EmissionsPeriod } from "./forecast";
import { resolveOrgBaselineByScope } from "./resolveOrgBaseline";

export async function loadEmissionsByPeriod(
  payload: Payload,
  organisationId: string,
  opts?: { lookbackYears?: number; endYear?: number },
): Promise<{
  periods: EmissionsPeriod[];
  messages: string[];
}> {
  const lookback = opts?.lookbackYears ?? 5;
  const endYear = opts?.endYear ?? new Date().getFullYear();
  const startYear = endYear - lookback + 1;
  const periods: EmissionsPeriod[] = [];
  const messages: string[] = [];

  for (let year = startYear; year <= endYear; year++) {
    const resolved = await resolveOrgBaselineByScope(payload, organisationId, year);
    const total =
      resolved.baseline.scope1 + resolved.baseline.scope2 + resolved.baseline.scope3;
    if (resolved.quality === "calculated" && total > 0) {
      periods.push({ year, emissions: total });
    } else if (resolved.message) {
      messages.push(`${year}: ${resolved.message}`);
    }
  }

  return { periods, messages };
}
