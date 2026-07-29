import { getPayload } from "payload";
import config from "@/payload.config";

/**
 * EU Emissions Trading System (ETS) Service
 * Integration with free public EU ETS Registry
 *
 * Data source: https://ec.europa.eu/clima/ets/
 * Coverage: ~10K EU companies with Scope 1 emissions
 * License: Public data
 */

export interface EuEtsEntry {
  companyName: string;
  country: string;
  installations: number;
  scopeEmissions: number; // tCO2e, most recent year
  year: number;
  sector: string;
}

/**
 * Fetch EU ETS Registry data
 * In production, this would download/query the actual EU ETS registry
 * For MVP, using sample data
 */
export async function fetchEuEtsRegistry(): Promise<EuEtsEntry[]> {
  try {
    // Production: Query https://ec.europa.eu/clima/ets/download or use their API
    // For now, sample data for demonstration

    const sampleData: EuEtsEntry[] = [
      {
        companyName: "Siemens AG",
        country: "Germany",
        installations: 12,
        scopeEmissions: 45000,
        year: 2023,
        sector: "Manufacturing",
      },
      {
        companyName: "Volkswagen AG",
        country: "Germany",
        installations: 18,
        scopeEmissions: 120000,
        year: 2023,
        sector: "Automotive",
      },
      {
        companyName: "Unilever PLC",
        country: "United Kingdom",
        installations: 8,
        scopeEmissions: 25000,
        year: 2023,
        sector: "Consumer Goods",
      },
      {
        companyName: "Nestlé SA",
        country: "Switzerland",
        installations: 15,
        scopeEmissions: 80000,
        year: 2023,
        sector: "Food & Beverage",
      },
    ];

    // TODO: In production, fetch actual registry
    // const response = await fetch('https://ec.europa.eu/clima/ets/api/registry');
    // return response.json();

    return sampleData;
  } catch (error) {
    console.error("Error fetching EU ETS registry:", error);
    return [];
  }
}

/**
 * Find supplier in EU ETS registry
 * Uses simple name matching (EU companies only)
 */
export async function findInEuEts(
  companyName: string,
  country?: string
): Promise<EuEtsEntry | null> {
  const registry = await fetchEuEtsRegistry();

  // Normalize search term
  const searchNorm = companyName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();

  for (const entry of registry) {
    const entryNorm = entry.companyName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .trim();

    // Match company name
    if (entryNorm.includes(searchNorm) || searchNorm.includes(entryNorm)) {
      // If country provided, verify it matches
      if (country) {
        const countryNorm = country.toLowerCase();
        const entryCountryNorm = entry.country.toLowerCase();
        if (!entryCountryNorm.includes(countryNorm)) continue;
      }

      return entry;
    }
  }

  return null;
}

/**
 * Sync EU ETS data for a specific supplier
 */
export async function syncSupplierEuEtsData(
  supplierId: string,
  companyName: string,
  country: string,
  dryRun: boolean = false
): Promise<{
  found: boolean;
  emissions?: number;
  year?: number;
  error?: string;
}> {
  try {
    const match = await findInEuEts(companyName, country);

    if (!match) {
      return { found: false };
    }

    if (!dryRun) {
      const payload = await getPayload({ config });

      // Find supplier
      const supplier = await payload.findByID({
        collection: "suppliers",
        id: supplierId,
      });

      // Create data source record for Scope 1 emissions
      await payload.create({
        collection: "supplier-data-sources",
        data: {
          organisation: supplier.organisation,
          supplier: supplierId,
          metricName: "scope1_emissions_tco2e",
          value: match.scopeEmissions,
          source: "eu_ets",
          confidence: 95,
          sourceUrl: `https://ec.europa.eu/clima/ets/`,
          updatedAt: new Date().toISOString(),
          notes: `EU ETS Registry: ${match.installations} installations, ${match.sector} sector`,
        },
      });
    }

    return {
      found: true,
      emissions: match.scopeEmissions,
      year: match.year,
    };
  } catch (error) {
    return {
      found: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Sync EU ETS for all EU suppliers in organization
 */
export async function syncEuEtsForOrganisation(
  orgId: string,
  dryRun: boolean = false
): Promise<{
  scanned: number;
  matched: number;
  updated: number;
  errors: string[];
}> {
  const payload = await getPayload({ config });
  const results: { scanned: number; matched: number; updated: number; errors: string[] } = {
    scanned: 0,
    matched: 0,
    updated: 0,
    errors: [],
  };

  try {
    // Fetch EU suppliers only (filter by country)
    const euCountries = [
      "Germany",
      "France",
      "Italy",
      "Spain",
      "Poland",
      "Netherlands",
      "Belgium",
      "Greece",
      "Portugal",
      "Sweden",
      "Denmark",
      "Finland",
      "Ireland",
      "Austria",
      "Czech Republic",
      "Hungary",
      "Romania",
      "Bulgaria",
      "Croatia",
      "Slovenia",
      "Slovakia",
      "Lithuania",
      "Latvia",
      "Estonia",
      "Cyprus",
      "Luxembourg",
      "Malta",
    ];

    const suppliers = await payload.find({
      collection: "suppliers",
      where: { organisation: { equals: orgId } },
      limit: 1000,
    });

    for (const supplier of suppliers.docs) {
      const country = supplier.country as string;
      if (!country || !euCountries.some((eu) => country.includes(eu))) {
        continue;
      }

      results.scanned++;

      try {
        const result = await syncSupplierEuEtsData(
          supplier.id,
          supplier.name,
          country,
          dryRun
        );

        if (result.found) {
          results.matched++;
          if (!dryRun) results.updated++;
        }
      } catch (error) {
        results.errors.push(
          `Error processing ${supplier.name}: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    }

    return results;
  } catch (error) {
    results.errors.push(
      error instanceof Error ? error.message : "Unknown error"
    );
    return results;
  }
}
