import { getPayload } from "payload";
import config from "@/payload.config";
import type { ErpConnection } from "@/payload-types";

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

export async function orchestrateSync(
  orgId: string,
  connectionId: string,
): Promise<SyncResult> {
  const payload = await getPayload({ config });

  const connection = await payload.findByID({
    collection: "erp-connections",
    id: connectionId,
  });

  const result: SyncResult = {
    connectionId,
    status: "in_progress",
    recordsProcessed: 0,
    errors: [],
    startedAt: new Date(),
  };

  try {
    // Update connection status
    await payload.update({
      collection: "erp-connections",
      id: connectionId,
      data: {
        status: "syncing",
      },
    });

    // Determine ERP type and sync accordingly
    const erpType = connection.erpType;

    switch (erpType) {
      case "netsuite":
        result.recordsProcessed = await syncNetSuite(orgId, connection);
        break;
      case "xero":
        result.recordsProcessed = await syncXero(orgId, connection);
        break;
      case "quickbooks":
        result.recordsProcessed = await syncQuickBooks(orgId, connection);
        break;
      case "workday":
        result.recordsProcessed = await syncWorkday(orgId, connection);
        break;
      default:
        result.errors.push(`Unknown ERP type: ${erpType}`);
    }

    result.status = result.errors.length === 0 ? "completed" : "failed";
    result.completedAt = new Date();

    // Schedule next sync
    const syncSchedule = connection.syncSchedule || "daily";
    result.nextSyncAt = calculateNextSyncTime(syncSchedule);

    // Update connection with results
    await payload.update({
      collection: "erp-connections",
      id: connectionId,
      data: {
        status: "connected",
        lastSyncedAt: result.completedAt.toISOString(),
        nextSyncAt: result.nextSyncAt.toISOString(),
      },
    });

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed";
    result.status = "failed";
    result.errors.push(message);
    result.completedAt = new Date();

    await payload.update({
      collection: "erp-connections",
      id: connectionId,
      data: {
        status: "error",
      },
    });

    return result;
  }
}

async function syncNetSuite(orgId: string, _connection: ErpConnection): Promise<number> {
  // Stub implementation - would call NetSuite API
  console.log(`Syncing NetSuite for org ${orgId}`);
  return 0;
}

async function syncXero(orgId: string, _connection: ErpConnection): Promise<number> {
  // Stub implementation - would call Xero API
  console.log(`Syncing Xero for org ${orgId}`);
  return 0;
}

async function syncQuickBooks(
  orgId: string,
  _connection: ErpConnection,
): Promise<number> {
  // Stub implementation - would call QuickBooks API
  console.log(`Syncing QuickBooks for org ${orgId}`);
  return 0;
}

async function syncWorkday(orgId: string, _connection: ErpConnection): Promise<number> {
  // Stub implementation - would call Workday API
  console.log(`Syncing Workday for org ${orgId}`);
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
