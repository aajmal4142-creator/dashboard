import { getPayload } from "payload";
import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { requirePermission } from "@/lib/policy/protect";
import config from "@/payload.config";
import type { ErpConnection } from "@/payload-types";

type ErpType = ErpConnection["erpType"];
type SyncSchedule = NonNullable<ErpConnection["syncSchedule"]>;

/**
 * POST /api/app/erp/connect
 * Create a new ERP connection
 */
export async function POST(request: Request) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const allowed = await requirePermission(
      ctx.user.id,
      ctx.activeOrg.id,
      "create",
      "billing",
      ctx.activeOrg.id,
      "organisation",
    );
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = (await request.json()) as {
      connectionName?: string;
      erpType?: ErpType;
      apiEndpoint?: string;
      credentials?: Record<string, unknown>;
      syncSchedule?: SyncSchedule;
      fieldMapping?: Record<string, unknown>;
    };
    const {
      connectionName,
      erpType,
      apiEndpoint,
      credentials,
      syncSchedule,
      fieldMapping,
    } = body;

    if (!connectionName || !erpType || !apiEndpoint) {
      return NextResponse.json(
        { error: "connectionName, erpType, and apiEndpoint are required" },
        { status: 400 },
      );
    }

    const payload = await getPayload({ config });

    // Create ERP connection record
    const connection = await payload.create({
      collection: "erp-connections",
      data: {
        organisation: ctx.activeOrg.id,
        connectionName,
        erpType,
        status: "disconnected",
        apiEndpoint,
        credentials: credentials || {},
        syncSchedule: syncSchedule || "daily",
        cdcEnabled: false,
        fieldMapping: fieldMapping || {},
        dataEntities: [],
        syncErrors: [],
        reconciliationStatus: "pending",
      },
    });

    return NextResponse.json(
      {
        connectionId: connection.id,
        message: "ERP connection created successfully",
        status: "disconnected",
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Error creating ERP connection:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * GET /api/app/erp/connections
 * List ERP connections for organization
 */
export async function GET(_request: Request) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const allowed = await requirePermission(
      ctx.user.id,
      ctx.activeOrg.id,
      "view",
      "billing",
      ctx.activeOrg.id,
      "organisation",
    );
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const payload = await getPayload({ config });

    const connections = await payload.find({
      collection: "erp-connections",
      where: { organisation: { equals: ctx.activeOrg.id } },
      limit: 50,
    });

    return NextResponse.json({
      total: connections.totalDocs,
      connections: connections.docs.map((c) => ({
        id: c.id,
        connectionName: c.connectionName,
        erpType: c.erpType,
        status: c.status,
        lastSyncedAt: c.lastSyncedAt,
        syncSchedule: c.syncSchedule,
      })),
    });
  } catch (error) {
    console.error("Error fetching ERP connections:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
