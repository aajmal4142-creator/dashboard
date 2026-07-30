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

import { publicConnection, requireOrgAdmin, requireOrgMember } from "../../_shared";

function orgIdOf(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "id" in value) {
    return String((value as { id: string }).id);
  }
  return null;
}

type RouteCtx = { params: Promise<{ id: string }> };

async function loadOwnedConnection(id: string, organisationId: string) {
  const payload = await getPayload({ config });
  const doc = await payload.findByID({
    collection: "database-connections",
    id,
    depth: 0,
    overrideAccess: true,
  });
  if (orgIdOf(doc.organisation) !== organisationId) {
    return null;
  }
  return { payload, doc };
}

/**
 * GET /api/app/database/connections/[id]
 */
export async function GET(_request: Request, ctx: RouteCtx) {
  const auth = await getCurrentContext();
  const denied = requireOrgMember(auth);
  if (denied) return denied;

  const { id } = await ctx.params;
  const owned = await loadOwnedConnection(id, auth.activeOrg!.id);
  if (!owned) {
    return NextResponse.json({ error: "Connection not found" }, { status: 404 });
  }
  return NextResponse.json({ connection: publicConnection(owned.doc) });
}

/**
 * PATCH /api/app/database/connections/[id] — mapping, schedule, optional re-credentials.
 */
export async function PATCH(request: Request, ctx: RouteCtx) {
  const auth = await getCurrentContext();
  const denied = requireOrgAdmin(auth);
  if (denied) return denied;

  const { id } = await ctx.params;
  const owned = await loadOwnedConnection(id, auth.activeOrg!.id);
  if (!owned) {
    return NextResponse.json({ error: "Connection not found" }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};

  if (typeof body.name === "string" && body.name.trim()) {
    data.name = body.name.trim();
  }
  if (typeof body.sourceSchema === "string") {
    data.sourceSchema = body.sourceSchema.trim() || null;
  }
  if (typeof body.sourceTable === "string") {
    data.sourceTable = body.sourceTable.trim() || null;
  }
  if (typeof body.incrementalColumn === "string") {
    data.incrementalColumn = body.incrementalColumn.trim() || null;
  }
  if (typeof body.defaultPeriodId === "string") {
    data.defaultPeriod = body.defaultPeriodId.trim() || null;
  }
  if (body.fieldMappings !== undefined) {
    const mapped = parseFieldMappings(body.fieldMappings);
    if (!mapped) {
      return NextResponse.json(
        { error: "fieldMappings must include a columns array" },
        { status: 400 },
      );
    }
    data.fieldMappings = mapped;
  }
  if (typeof body.syncFrequency === "string") {
    if (!["manual", "hourly", "daily", "weekly"].includes(body.syncFrequency)) {
      return NextResponse.json(
        { error: "syncFrequency must be manual, hourly, daily, or weekly" },
        { status: 400 },
      );
    }
    data.syncFrequency = body.syncFrequency;
    const next = calculateNextSyncAt(body.syncFrequency as SyncFrequency);
    data.nextSyncAt = next ? next.toISOString() : null;
  }
  if (typeof body.status === "string") {
    if (!["connected", "disabled", "failed", "pending"].includes(body.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    data.status = body.status;
  }

  // Optional credential rotation — must pass test before overwrite
  const rotating =
    body.password != null ||
    body.serviceAccountJson != null ||
    body.host != null ||
    body.projectId != null;

  let connector: ReturnType<typeof createConnector> | null = null;
  try {
    if (rotating) {
      const engine = owned.doc.engine as "postgresql" | "mysql" | "bigquery";
      const credentials = parseCredentialsInput(engine, {
        ...body,
        engine,
      });
      connector = createConnector(engine, credentials);
      const test = await connector.testConnection();
      if (!test.ok) {
        return NextResponse.json(
          {
            error: `Connection test failed: ${test.message}. Credentials were not updated.`,
          },
          { status: 422 },
        );
      }
      const display = credentialsDisplay(engine, credentials);
      data.encryptedCredentials = encryptCredentials(JSON.stringify(credentials));
      data.sslEnabled = display.sslEnabled;
      data.displayHost = display.displayHost;
      data.displayDatabase = display.displayDatabase;
      data.testedAt = new Date().toISOString();
      data.status = "connected";
      data.lastError = null;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "No updatable fields provided" },
        { status: 400 },
      );
    }

    const updated = await (
      owned.payload.update as (a: {
        collection: "database-connections";
        id: string;
        data: Record<string, unknown>;
        overrideAccess: true;
      }) => Promise<Parameters<typeof publicConnection>[0]>
    )({
      collection: "database-connections",
      id,
      data,
      overrideAccess: true,
    });

    await writeAuditLog(owned.payload, {
      organisationId: auth.activeOrg!.id,
      actorId: auth.user!.id,
      action: "database.connection.update",
      entityType: "database-connections",
      entityId: id,
      after: {
        fields: Object.keys(data).filter((k) => k !== "encryptedCredentials"),
        credentialsRotated: rotating,
      },
    });

    return NextResponse.json({ connection: publicConnection(updated) });
  } catch (err) {
    return NextResponse.json({ error: sanitizeConnectorError(err) }, { status: 422 });
  } finally {
    if (connector) {
      await connector.close().catch(() => undefined);
    }
  }
}

/**
 * DELETE /api/app/database/connections/[id]
 */
export async function DELETE(_request: Request, ctx: RouteCtx) {
  const auth = await getCurrentContext();
  const denied = requireOrgAdmin(auth);
  if (denied) return denied;

  const { id } = await ctx.params;
  const owned = await loadOwnedConnection(id, auth.activeOrg!.id);
  if (!owned) {
    return NextResponse.json({ error: "Connection not found" }, { status: 404 });
  }

  await owned.payload.delete({
    collection: "database-connections",
    id,
    overrideAccess: true,
  });

  await writeAuditLog(owned.payload, {
    organisationId: auth.activeOrg!.id,
    actorId: auth.user!.id,
    action: "database.connection.delete",
    entityType: "database-connections",
    entityId: id,
  });

  return NextResponse.json({ ok: true });
}
