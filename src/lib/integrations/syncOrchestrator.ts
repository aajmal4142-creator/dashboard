import { getPayload } from "payload";
import config from "@/payload.config";
import type { AccountingConnection } from "@/payload-types";

export type SyncStatus = "pending" | "in_progress" | "completed" | "failed";

export type SyncResult = {
  connectionId: string;
  status: SyncStatus;
  recordsProcessed: number;
  errors: string[];
  startedAt: Date;
  completedAt?: Date;
  nextSyncAt?: Date;
};

/**
 * Orchestrates sync for free-tier accounting connections (Xero / QuickBooks).
 * Paid ERP connectors have been removed.
 */
export async function orchestrateSync(
  orgId: string,
  connectionId: string,
): Promise<SyncResult> {
  const payload = await getPayload({ config });

  const connection = await payload.findByID({
    collection: "accounting-connections",
    id: connectionId,
  });

  const orgIdOf =
    typeof connection.organisationId === "object"
      ? connection.organisationId.id
      : String(connection.organisationId);

  if (orgIdOf !== orgId) {
    return {
      connectionId,
      status: "failed",
      recordsProcessed: 0,
      errors: ["Connection not found for organisation"],
      startedAt: new Date(),
      completedAt: new Date(),
    };
  }

  const result: SyncResult = {
    connectionId,
    status: "in_progress",
    recordsProcessed: 0,
    errors: [],
    startedAt: new Date(),
  };

  try {
    await payload.update({
      collection: "accounting-connections",
      id: connectionId,
      data: {
        lastSyncStatus: "in_progress",
      },
    });

    switch (connection.provider) {
      case "xero":
        result.recordsProcessed = await syncXero(orgId, connection);
        break;
      case "quickbooks":
        result.recordsProcessed = await syncQuickBooks(orgId, connection);
        break;
      default:
        result.errors.push(`Unsupported accounting provider: ${connection.provider}`);
    }

    result.status = result.errors.length === 0 ? "completed" : "failed";
    result.completedAt = new Date();
    result.nextSyncAt = calculateNextSyncTime(
      connection.syncConfig?.syncFrequency || "daily",
    );

    await payload.update({
      collection: "accounting-connections",
      id: connectionId,
      data: {
        status: result.status === "completed" ? "connected" : "failed",
        lastSyncAt: result.completedAt.toISOString(),
        lastSyncStatus: result.status,
      },
    });

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed";
    result.status = "failed";
    result.errors.push(message);
    result.completedAt = new Date();

    await payload.update({
      collection: "accounting-connections",
      id: connectionId,
      data: {
        status: "failed",
        lastSyncStatus: message,
      },
    });

    return result;
  }
}

async function syncXero(
  orgId: string,
  _connection: AccountingConnection,
): Promise<number> {
  console.log(`Syncing Xero for org ${orgId}`);
  return 0;
}

async function syncQuickBooks(
  orgId: string,
  _connection: AccountingConnection,
): Promise<number> {
  console.log(`Syncing QuickBooks for org ${orgId}`);
  return 0;
}

function calculateNextSyncTime(schedule: string): Date {
  const now = new Date();

  switch (schedule) {
    case "hourly":
      return new Date(now.getTime() + 60 * 60 * 1000);
    case "daily":
      return new Date(now.getTime() + 24 * 60 * 60 * 1000);
    case "weekly":
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    default:
      return new Date(now.getTime() + 24 * 60 * 60 * 1000);
  }
}
