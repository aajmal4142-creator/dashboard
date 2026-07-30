import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import {
  createConnector,
  decryptCredentials,
  sanitizeConnectorError,
  type DatabaseEngine,
} from "@/lib/database";
import config from "@/payload.config";

import { requireOrgAdmin } from "../../../_shared";

type RouteCtx = { params: Promise<{ id: string }> };

function orgIdOf(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "id" in value) {
    return String((value as { id: string }).id);
  }
  return null;
}

/**
 * GET /api/app/database/connections/[id]/tables — schema discovery.
 */
export async function GET(request: Request, ctx: RouteCtx) {
  const auth = await getCurrentContext();
  const denied = requireOrgAdmin(auth);
  if (denied) return denied;

  const { id } = await ctx.params;
  const url = new URL(request.url);
  const schemaParam = url.searchParams.get("schema") ?? undefined;

  const payload = await getPayload({ config });
  let connector: ReturnType<typeof createConnector> | null = null;

  try {
    const doc = await payload.findByID({
      collection: "database-connections",
      id,
      depth: 0,
      overrideAccess: true,
    });
    if (orgIdOf(doc.organisation) !== auth.activeOrg!.id) {
      return NextResponse.json({ error: "Connection not found" }, { status: 404 });
    }

    const plaintext = decryptCredentials(String(doc.encryptedCredentials));
    const credentials = JSON.parse(plaintext) as Parameters<typeof createConnector>[1];
    connector = createConnector(doc.engine as DatabaseEngine, credentials);
    const tables = await connector.listTables(
      schemaParam || doc.sourceSchema || undefined,
    );

    return NextResponse.json({
      engine: doc.engine,
      schema: schemaParam || doc.sourceSchema || null,
      tables,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: sanitizeConnectorError(err),
        hint: "Verify the connection still works via Test, then retry discovery.",
      },
      { status: 422 },
    );
  } finally {
    if (connector) {
      await connector.close().catch(() => undefined);
    }
  }
}
