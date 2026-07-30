import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { writeAuditLog } from "@/lib/audit/write";
import { getCurrentContext } from "@/lib/auth";
import {
  calculateNextSyncAt,
  createConnector,
  credentialsDisplay,
  encryptCredentials,
  parseCredentialsInput,
  parseFieldMappings,
  sanitizeConnectorError,
  type SyncFrequency,
} from "@/lib/database";
import config from "@/payload.config";

import {
  parseEngine,
  publicConnection,
  requireOrgAdmin,
  requireOrgMember,
} from "../_shared";

/**
 * GET /api/app/database/connections — list connections for active org.
 */
export async function GET() {
  const ctx = await getCurrentContext();
  const denied = requireOrgMember(ctx);
  if (denied) return denied;

  const payload = await getPayload({ config });
  const result = await payload.find({
    collection: "database-connections",
    where: { organisation: { equals: ctx.activeOrg!.id } },
    sort: "-updatedAt",
    limit: 100,
    depth: 0,
    overrideAccess: true,
  });

  return NextResponse.json({
    connections: result.docs.map((doc) => publicConnection(doc)),
  });
}

/**
 * POST /api/app/database/connections — test + encrypt + save.
 */
export async function POST(request: Request) {
  const ctx = await getCurrentContext();
  const denied = requireOrgAdmin(ctx);
  if (denied) return denied;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const engine = parseEngine(body.engine);
  if (!engine) {
    return NextResponse.json(
      { error: "engine must be postgresql, mysql, or bigquery" },
      { status: 400 },
    );
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const syncFrequencyRaw =
    typeof body.syncFrequency === "string" ? body.syncFrequency : "manual";
  const syncFrequency = (
    ["manual", "hourly", "daily", "weekly"].includes(syncFrequencyRaw)
      ? syncFrequencyRaw
      : "manual"
  ) as SyncFrequency;

  let connector: ReturnType<typeof createConnector> | null = null;
  try {
    const credentials = parseCredentialsInput(engine, body);
    connector = createConnector(engine, credentials);
    const test = await connector.testConnection();
    if (!test.ok) {
      return NextResponse.json(
        {
          error: `Connection test failed: ${test.message}. Fix credentials and try again.`,
        },
        { status: 422 },
      );
    }

    const display = credentialsDisplay(engine, credentials);
    const encrypted = encryptCredentials(JSON.stringify(credentials));
    const fieldMappings = parseFieldMappings(body.fieldMappings);
    const nextSyncAt = calculateNextSyncAt(syncFrequency);
    const defaultPeriodId =
      typeof body.defaultPeriodId === "string" && body.defaultPeriodId.trim()
        ? body.defaultPeriodId.trim()
        : undefined;

    const payload = await getPayload({ config });
    const doc = await (
      payload.create as (a: {
        collection: "database-connections";
        data: Record<string, unknown>;
        overrideAccess: true;
      }) => Promise<{
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
      }>
    )({
      collection: "database-connections",
      data: {
        organisation: ctx.activeOrg!.id,
        name,
        engine,
        status: "connected",
        encryptedCredentials: encrypted,
        sslEnabled: display.sslEnabled,
        displayHost: display.displayHost,
        displayDatabase: display.displayDatabase,
        sourceSchema:
          typeof body.sourceSchema === "string"
            ? body.sourceSchema.trim() || undefined
            : engine === "postgresql"
              ? "public"
              : undefined,
        sourceTable:
          typeof body.sourceTable === "string"
            ? body.sourceTable.trim() || undefined
            : undefined,
        fieldMappings: fieldMappings ?? undefined,
        incrementalColumn:
          typeof body.incrementalColumn === "string"
            ? body.incrementalColumn.trim() || undefined
            : undefined,
        defaultPeriod: defaultPeriodId,
        syncFrequency,
        nextSyncAt: nextSyncAt ? nextSyncAt.toISOString() : undefined,
        testedAt: new Date().toISOString(),
      },
      overrideAccess: true,
    });

    await writeAuditLog(payload, {
      organisationId: ctx.activeOrg!.id,
      actorId: ctx.user!.id,
      action: "database.connection.create",
      entityType: "database-connections",
      entityId: doc.id,
      after: {
        name,
        engine,
        displayHost: display.displayHost,
        // never include credentials
      },
    });

    return NextResponse.json({ connection: publicConnection(doc) }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: sanitizeConnectorError(err) }, { status: 422 });
  } finally {
    if (connector) {
      await connector.close().catch(() => undefined);
    }
  }
}
