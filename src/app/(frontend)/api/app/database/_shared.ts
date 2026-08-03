import type { AuthContext } from "@/lib/auth";
import type { DatabaseEngine } from "@/lib/database";

export function requireOrgAdmin(ctx: AuthContext): Response | null {
  if (!ctx.user || !ctx.activeOrg || !ctx.role) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return Response.json(
      { error: "Admin role required to manage database connections" },
      { status: 403 },
    );
  }
  return null;
}

export function requireOrgMember(ctx: AuthContext): Response | null {
  if (!ctx.user || !ctx.activeOrg || !ctx.role) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

const ENGINES = new Set<string>(["postgresql", "mysql", "bigquery", "snowflake"]);

export function parseEngine(value: unknown): DatabaseEngine | null {
  if (typeof value !== "string") return null;
  if (!ENGINES.has(value)) return null;
  return value as DatabaseEngine;
}

export function publicConnection(doc: {
  id: string;
  name: string;
  engine: string;
  status?: string | null;
  sslEnabled?: boolean | null;
  displayHost?: string | null;
  displayDatabase?: string | null;
  sourceSchema?: string | null;
  sourceTable?: string | null;
  fieldMappings?: unknown;
  incrementalColumn?: string | null;
  lastIncrementalValue?: string | null;
  defaultPeriod?: string | { id: string } | null;
  syncFrequency?: string | null;
  nextSyncAt?: string | null;
  lastSyncAt?: string | null;
  lastSyncStatus?: string | null;
  testedAt?: string | null;
  lastError?: string | null;
  createdAt: string;
  updatedAt: string;
}) {
  const periodId =
    typeof doc.defaultPeriod === "object" && doc.defaultPeriod
      ? doc.defaultPeriod.id
      : (doc.defaultPeriod ?? null);

  return {
    id: doc.id,
    name: doc.name,
    engine: doc.engine,
    status: doc.status ?? "pending",
    sslEnabled: doc.sslEnabled !== false,
    displayHost: doc.displayHost ?? null,
    displayDatabase: doc.displayDatabase ?? null,
    sourceSchema: doc.sourceSchema ?? null,
    sourceTable: doc.sourceTable ?? null,
    fieldMappings: doc.fieldMappings ?? null,
    incrementalColumn: doc.incrementalColumn ?? null,
    lastIncrementalValue: doc.lastIncrementalValue ?? null,
    defaultPeriodId: periodId,
    syncFrequency: doc.syncFrequency ?? "manual",
    nextSyncAt: doc.nextSyncAt ?? null,
    lastSyncAt: doc.lastSyncAt ?? null,
    lastSyncStatus: doc.lastSyncStatus ?? null,
    testedAt: doc.testedAt ?? null,
    lastError: doc.lastError ?? null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}
