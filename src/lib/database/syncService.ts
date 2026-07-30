import { getPayload } from "payload";

import { writeAuditLog } from "@/lib/audit/write";
import { supplierKeyFrom } from "@/lib/suppliers/supplierKey";
import config from "@/payload.config";

import { createConnector } from "./connectors";
import { decryptCredentials, sanitizeConnectorError } from "./encrypt";
import { mapRowsToDatapoints, mappingSourceColumns, parseFieldMappings } from "./mapRows";
import { calculateNextSyncAt, type DatabaseEngine, type SyncFrequency } from "./types";

export type SyncTrigger = "user" | "cron";

export type DatabaseSyncResult = {
  logId: string;
  connectionId: string;
  status: "success" | "partial" | "failed";
  recordsProcessed: number;
  recordsFailed: number;
  recordsSkipped: number;
  errors: Array<{ message: string; recordId?: string }>;
  syncDurationMs: number;
};

function relationId(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "id" in value) {
    return String((value as { id: string }).id);
  }
  return null;
}

async function writeDatapoint(args: {
  organisationId: string;
  periodId: string;
  metricKey: string;
  value: number | null;
  quality: "measured" | "calculated" | "estimated" | "missing";
  unit?: string;
  supplierId?: string;
  actorId?: string;
  note?: string;
}): Promise<"created" | "updated" | "skipped"> {
  const payload = await getPayload({ config });
  const supplierKey = supplierKeyFrom(args.supplierId);

  const existing = await payload.find({
    collection: "datapoints",
    where: {
      and: [
        { organisation: { equals: args.organisationId } },
        { period: { equals: args.periodId } },
        { metricKey: { equals: args.metricKey } },
        { supplierKey: { equals: supplierKey } },
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  });

  const data = {
    organisation: args.organisationId,
    period: args.periodId,
    metricKey: args.metricKey,
    value: args.quality === "missing" ? null : args.value,
    unit: args.unit,
    quality: args.quality,
    source: "import" as const,
    supplier: args.supplierId || undefined,
    supplierKey,
    approvalState: "pending" as const,
    enteredBy: args.actorId,
    enteredAt: new Date().toISOString(),
    note: args.note,
  };

  if (existing.docs[0]) {
    await (
      payload.update as (a: {
        collection: "datapoints";
        id: string;
        data: Record<string, unknown>;
        overrideAccess: true;
      }) => Promise<unknown>
    )({
      collection: "datapoints",
      id: existing.docs[0].id,
      data,
      overrideAccess: true,
    });
    return "updated";
  }

  await (
    payload.create as (a: {
      collection: "datapoints";
      data: Record<string, unknown>;
      overrideAccess: true;
    }) => Promise<{ id: string }>
  )({
    collection: "datapoints",
    data,
    overrideAccess: true,
  });
  return "created";
}

/**
 * Run a one-shot sync for a saved database connection.
 * Credentials are decrypted in-process only; never logged.
 */
export async function syncDatabaseConnection(args: {
  organisationId: string;
  connectionId: string;
  triggeredBy: string;
  trigger: SyncTrigger;
}): Promise<DatabaseSyncResult> {
  const payload = await getPayload({ config });
  const startedAt = new Date();
  const errors: Array<{ message: string; recordId?: string }> = [];
  let recordsProcessed = 0;
  let recordsFailed = 0;
  let recordsSkipped = 0;

  const connection = await payload.findByID({
    collection: "database-connections",
    id: args.connectionId,
    depth: 0,
    overrideAccess: true,
  });

  const orgId = relationId(connection.organisation);
  if (orgId !== args.organisationId) {
    throw new Error("Connection not found for organisation");
  }

  if (connection.status === "disabled") {
    throw new Error("Connection is disabled. Enable it before syncing.");
  }

  const periodId = relationId(connection.defaultPeriod);
  if (!periodId) {
    throw new Error("Set a default reporting period on the connection before syncing.");
  }

  const period = await payload.findByID({
    collection: "reporting-periods",
    id: periodId,
    depth: 0,
    overrideAccess: true,
  });
  if (period.status !== "open") {
    throw new Error(
      "Reporting period is locked or published. Open the period, then sync again.",
    );
  }

  const mappings = parseFieldMappings(connection.fieldMappings);
  if (!mappings || (mappings.columns.length === 0 && !mappings.defaults?.metricKey)) {
    throw new Error("Configure field mappings (or defaults.metricKey) before syncing.");
  }
  if (!connection.sourceTable?.trim()) {
    throw new Error("Select a source table before syncing.");
  }

  const log = await (
    payload.create as (a: {
      collection: "database-sync-logs";
      data: Record<string, unknown>;
      overrideAccess: true;
    }) => Promise<{ id: string }>
  )({
    collection: "database-sync-logs",
    data: {
      organisation: args.organisationId,
      connection: args.connectionId,
      engine: connection.engine,
      status: "running",
      recordsProcessed: 0,
      recordsFailed: 0,
      recordsSkipped: 0,
      triggeredBy: args.trigger === "cron" ? "cron" : args.triggeredBy,
      startedAt: startedAt.toISOString(),
    },
    overrideAccess: true,
  });

  let connector: ReturnType<typeof createConnector> | null = null;

  try {
    const plaintext = decryptCredentials(String(connection.encryptedCredentials));
    const credentials = JSON.parse(plaintext) as Parameters<typeof createConnector>[1];
    connector = createConnector(connection.engine as DatabaseEngine, credentials);

    const sourceCols = mappingSourceColumns(mappings);
    if (connection.incrementalColumn?.trim()) {
      sourceCols.push(connection.incrementalColumn.trim());
    }

    const queryResult = await connector.queryRows({
      schema: connection.sourceSchema ?? undefined,
      table: connection.sourceTable.trim(),
      columns: sourceCols,
      incrementalColumn: connection.incrementalColumn?.trim() || undefined,
      lastIncrementalValue: connection.lastIncrementalValue ?? undefined,
      limit: 5000,
    });

    const mapped = mapRowsToDatapoints(queryResult.rows, mappings);
    for (const e of mapped.errors) {
      recordsFailed += 1;
      errors.push({
        message: e.error,
        recordId: String(e.index),
      });
    }

    for (const record of mapped.records) {
      try {
        const outcome = await writeDatapoint({
          organisationId: args.organisationId,
          periodId,
          metricKey: record.metricKey,
          value: record.value,
          quality: record.quality,
          unit: record.unit,
          supplierId: record.supplierId,
          actorId: args.trigger === "cron" ? undefined : args.triggeredBy,
          note: record.externalId
            ? `db-sync:${connection.engine}:${record.externalId}`
            : `db-sync:${connection.engine}`,
        });
        if (outcome === "skipped") recordsSkipped += 1;
        else recordsProcessed += 1;
      } catch (err) {
        recordsFailed += 1;
        errors.push({
          message: sanitizeConnectorError(err),
          recordId: record.externalId ?? String(record.index),
        });
      }
    }

    const status =
      recordsFailed === 0 ? "success" : recordsProcessed > 0 ? "partial" : "failed";
    const completedAt = new Date();
    const syncDurationMs = completedAt.getTime() - startedAt.getTime();
    const nextSyncAt = calculateNextSyncAt(
      (connection.syncFrequency as SyncFrequency) || "manual",
      completedAt,
    );

    await (
      payload.update as (a: {
        collection: "database-sync-logs";
        id: string;
        data: Record<string, unknown>;
        overrideAccess: true;
      }) => Promise<unknown>
    )({
      collection: "database-sync-logs",
      id: log.id,
      data: {
        status,
        recordsProcessed,
        recordsFailed,
        recordsSkipped,
        errors: errors.slice(0, 50),
        details: {
          table: connection.sourceTable,
          schema: connection.sourceSchema,
          rowCount: queryResult.rows.length,
          incrementalColumn: connection.incrementalColumn,
          maxIncrementalValue: queryResult.maxIncrementalValue,
          trigger: args.trigger,
        },
        syncDurationMs,
        completedAt: completedAt.toISOString(),
      },
      overrideAccess: true,
    });

    await (
      payload.update as (a: {
        collection: "database-connections";
        id: string;
        data: Record<string, unknown>;
        overrideAccess: true;
      }) => Promise<unknown>
    )({
      collection: "database-connections",
      id: args.connectionId,
      data: {
        status: status === "failed" ? "failed" : "connected",
        lastSyncAt: completedAt.toISOString(),
        lastSyncStatus: status,
        lastError: status === "failed" ? (errors[0]?.message ?? "Sync failed") : null,
        lastIncrementalValue:
          queryResult.maxIncrementalValue ?? connection.lastIncrementalValue,
        nextSyncAt: nextSyncAt ? nextSyncAt.toISOString() : null,
      },
      overrideAccess: true,
    });

    await writeAuditLog(payload, {
      organisationId: args.organisationId,
      actorId: args.trigger === "cron" ? undefined : args.triggeredBy,
      action: "database.sync",
      entityType: "database-connections",
      entityId: args.connectionId,
      after: {
        status,
        recordsProcessed,
        recordsFailed,
        trigger: args.trigger,
      },
    });

    return {
      logId: log.id,
      connectionId: args.connectionId,
      status,
      recordsProcessed,
      recordsFailed,
      recordsSkipped,
      errors: errors.slice(0, 20),
      syncDurationMs,
    };
  } catch (err) {
    const message = sanitizeConnectorError(err);
    const completedAt = new Date();
    const syncDurationMs = completedAt.getTime() - startedAt.getTime();

    await (
      payload.update as (a: {
        collection: "database-sync-logs";
        id: string;
        data: Record<string, unknown>;
        overrideAccess: true;
      }) => Promise<unknown>
    )({
      collection: "database-sync-logs",
      id: log.id,
      data: {
        status: "failed",
        recordsProcessed,
        recordsFailed: recordsFailed || 1,
        recordsSkipped,
        errors: [{ message }, ...errors].slice(0, 50),
        syncDurationMs,
        completedAt: completedAt.toISOString(),
      },
      overrideAccess: true,
    }).catch(() => undefined);

    await (
      payload.update as (a: {
        collection: "database-connections";
        id: string;
        data: Record<string, unknown>;
        overrideAccess: true;
      }) => Promise<unknown>
    )({
      collection: "database-connections",
      id: args.connectionId,
      data: {
        status: "failed",
        lastSyncAt: completedAt.toISOString(),
        lastSyncStatus: "failed",
        lastError: message,
      },
      overrideAccess: true,
    }).catch(() => undefined);

    return {
      logId: log.id,
      connectionId: args.connectionId,
      status: "failed",
      recordsProcessed,
      recordsFailed: recordsFailed || 1,
      recordsSkipped,
      errors: [{ message }, ...errors].slice(0, 20),
      syncDurationMs,
    };
  } finally {
    if (connector) {
      await connector.close().catch(() => undefined);
    }
  }
}

/** Cron helper: sync all due scheduled connections across orgs. */
export async function syncDueDatabaseConnections(): Promise<{
  attempted: number;
  results: Array<{ connectionId: string; organisationId: string; status: string }>;
}> {
  const payload = await getPayload({ config });
  const now = new Date().toISOString();
  const due = await payload.find({
    collection: "database-connections",
    where: {
      and: [
        { status: { in: ["connected", "failed"] } },
        { syncFrequency: { in: ["hourly", "daily", "weekly"] } },
        {
          or: [
            { nextSyncAt: { less_than_equal: now } },
            { nextSyncAt: { exists: false } },
          ],
        },
      ],
    },
    limit: 50,
    depth: 0,
    overrideAccess: true,
  });

  const results: Array<{
    connectionId: string;
    organisationId: string;
    status: string;
  }> = [];

  for (const doc of due.docs) {
    const organisationId = relationId(doc.organisation);
    if (!organisationId) continue;
    try {
      const result = await syncDatabaseConnection({
        organisationId,
        connectionId: doc.id,
        triggeredBy: "cron",
        trigger: "cron",
      });
      results.push({
        connectionId: doc.id,
        organisationId,
        status: result.status,
      });
    } catch (err) {
      results.push({
        connectionId: doc.id,
        organisationId,
        status: sanitizeConnectorError(err),
      });
    }
  }

  return { attempted: results.length, results };
}
