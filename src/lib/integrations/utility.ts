/**
 * Integration utilities and re-exports from enterprise integrations (Sprint 5).
 * Supports Salesforce, NetSuite, Xero, and QuickBooks integrations.
 */

export type IntegrationProvenance = {
  /** Never default to measured — utility pulls are external. */
  quality: "estimated" | "calculated";
  provenance: "manual";
  source: "api";
  note: string;
};

export type UtilityConnectionStatus =
  { status: "unavailable"; reason: string } | { status: "configured"; provider: string };

/** Honest status — no fake live connection. */
export function utilityConnectionStatus(): UtilityConnectionStatus {
  const provider = process.env.CLEARESG_UTILITY_PROVIDER?.trim();
  if (!provider) {
    return {
      status: "unavailable",
      reason:
        "No utility provider configured. Use spreadsheet import or manual entry. Pending CLEARESG_UTILITY_PROVIDER.",
    };
  }
  return { status: "configured", provider };
}

/**
 * Placeholder for a future auto-fill. Throws until a real adapter is implemented.
 * Callers must attach IntegrationProvenance — never quality: measured by default.
 */
export async function fetchUtilityElectricityKwh(_input: {
  organisationId: string;
  periodStart: string;
  periodEnd: string;
}): Promise<never> {
  const status = utilityConnectionStatus();
  if (status.status === "unavailable") {
    throw new Error(status.reason);
  }
  throw new Error(
    `Utility adapter for "${status.provider}" is not implemented. Do not fabricate kWh.`,
  );
}

export function utilityFillProvenance(provider: string): IntegrationProvenance {
  return {
    quality: "estimated",
    provenance: "manual",
    source: "api",
    note: `Auto-filled from utility provider ${provider} — not meter-verified measured.`,
  };
}

// Re-export enterprise integration types
export * from "./types";
export { SalesforceService } from "./salesforce";
export { NetSuiteService } from "./netsuite";
export { AccountingService } from "./accounting";
