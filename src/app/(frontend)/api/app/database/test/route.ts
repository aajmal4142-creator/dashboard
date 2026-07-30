import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import {
  createConnector,
  parseCredentialsInput,
  sanitizeConnectorError,
} from "@/lib/database";

import { parseEngine, requireOrgAdmin } from "../_shared";

/**
 * POST /api/app/database/test
 * Test credentials before save. Credentials are never persisted or logged.
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

  let connector: ReturnType<typeof createConnector> | null = null;
  try {
    const credentials = parseCredentialsInput(engine, body);
    connector = createConnector(engine, credentials);
    const result = await connector.testConnection();
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.message }, { status: 422 });
    }
    return NextResponse.json({ ok: true, message: result.message });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: sanitizeConnectorError(err) },
      { status: 422 },
    );
  } finally {
    if (connector) {
      await connector.close().catch(() => undefined);
    }
  }
}
