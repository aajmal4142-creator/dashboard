import type { CollectionSlug, Payload } from "payload";
import type { SyncResult } from "./types";

export type SyncRecord = {
  id: string;
  externalId: string;
  [key: string]: unknown;
};

export class SyncUtils {
  static async deduplicateBeforeCreate(
    payload: Payload,
    collectionName: CollectionSlug,
    records: SyncRecord[],
    identifierField: string,
  ): Promise<SyncRecord[]> {
    const externalIds = records.map((r) => r.externalId);

    const existing = await payload.find({
      collection: collectionName,
      where: {
        [identifierField]: {
          in: externalIds,
        },
      },
    });

    const existingIds = new Set(
      existing.docs.map((doc) => {
        const value = (doc as unknown as Record<string, unknown>)[identifierField];
        return value;
      }),
    );

    return records.filter((record) => !existingIds.has(record.externalId));
  }

  static createSyncResult(
    status: "success" | "partial" | "failed",
    recordsProcessed: number,
    recordsFailed: number,
    errors: Array<{ message: string; recordId?: string }>,
    details: Record<string, unknown>,
    syncDurationMs: number,
  ): SyncResult {
    return {
      status,
      recordsProcessed,
      recordsFailed,
      errors,
      details,
      syncDurationMs,
    };
  }

  static async logSyncEvent(
    payload: Payload,
    organisationId: string,
    integrationId: string,
    provider: string,
    result: SyncResult,
  ): Promise<void> {
    try {
      const allowed = new Set(["xero", "quickbooks", "csv", "webhook"]);
      const normalizedProvider = allowed.has(provider)
        ? (provider as "xero" | "quickbooks" | "csv" | "webhook")
        : "webhook";

      await payload.create({
        collection: "integration-sync-logs",
        data: {
          organisationId,
          integrationId,
          provider: normalizedProvider,
          status: result.status,
          recordsProcessed: result.recordsProcessed,
          recordsFailed: result.recordsFailed,
          errors: result.errors,
          details: result.details,
          syncDurationMs: result.syncDurationMs,
          triggeredBy: "auto",
        },
        overrideAccess: true,
      });
    } catch (err) {
      console.error("Failed to log sync event", err);
    }
  }

  static calculateEmissions(
    amount: number,
    category: string,
    factors: Record<string, number> = {},
  ): number {
    const defaultFactors: Record<string, number> = {
      electricity: 0.45,
      gas: 0.21,
      water: 0.35,
      travel: 0.22,
      waste: 0.18,
      procurement: 0.15,
      other: 0.1,
    };

    const factor =
      factors[category] || defaultFactors[category] || defaultFactors.other || 0.1;
    return amount * factor;
  }

  static sanitizeValue(value: unknown): unknown {
    if (value === null || value === undefined) {
      return null;
    }
    if (typeof value === "string") {
      return value.trim() || null;
    }
    if (typeof value === "number") {
      return isFinite(value) ? value : null;
    }
    return value;
  }

  static parseAmount(value: unknown): number | null {
    if (typeof value === "number") return value;
    if (typeof value === "string") {
      const parsed = parseFloat(value);
      return isFinite(parsed) ? parsed : null;
    }
    return null;
  }
}
