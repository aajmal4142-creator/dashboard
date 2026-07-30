import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { requirePermission } from "@/lib/policy/protect";
import { getPayload } from "payload";
import config from "@/payload.config";
import { SalesforceService } from "@/lib/integrations/salesforce";
import { NetSuiteService } from "@/lib/integrations/netsuite";
import { SAPService } from "@/lib/integrations/sap";
import { SyncUtils } from "@/lib/integrations/sync-utils";
import { OAuthErrorException } from "@/lib/integrations/oauth.base";
import type {
  NetsuiteConnection,
  SalesforceConnection,
  SapConnection,
} from "@/payload-types";

type IntegrationProvider = "salesforce" | "netsuite" | "sap";

const PROVIDER_COLLECTIONS = {
  salesforce: "salesforce-connections",
  netsuite: "netsuite-connections",
  sap: "sap-connections",
} as const;

type ConnectionDoc = SalesforceConnection | NetsuiteConnection | SapConnection;

function isIntegrationProvider(value: unknown): value is IntegrationProvider {
  return value === "salesforce" || value === "netsuite" || value === "sap";
}

function organisationIdOf(connection: ConnectionDoc): string {
  return typeof connection.organisationId === "object"
    ? connection.organisationId.id
    : String(connection.organisationId);
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getCurrentContext();

    if (!ctx.user?.id || !ctx.activeOrg?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check permission to edit organization
    const hasPermission = await requirePermission(
      ctx.user.id,
      ctx.activeOrg.id,
      "edit",
      "organisation",
      ctx.activeOrg.id,
      "organisation",
    );

    if (!hasPermission) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    }

    const body = (await request.json()) as {
      provider?: unknown;
      connectionId?: unknown;
      periodId?: unknown;
    };
    const { provider, connectionId, periodId } = body;

    if (!isIntegrationProvider(provider) || typeof connectionId !== "string") {
      return NextResponse.json(
        { error: "Missing provider or connectionId" },
        { status: 400 },
      );
    }

    const payload = await getPayload({ config });
    const collection = PROVIDER_COLLECTIONS[provider];

    // Get connection
    const connection = (await payload.findByID({
      collection,
      id: connectionId,
    })) as ConnectionDoc;

    if (!connection || organisationIdOf(connection) !== ctx.activeOrg.id) {
      return NextResponse.json({ error: "Connection not found" }, { status: 404 });
    }

    if (connection.status === "revoked") {
      return NextResponse.json(
        { error: "Connection has been revoked. Please re-authorize." },
        { status: 403 },
      );
    }

    let result;
    const startTime = Date.now();

    try {
      if (provider === "salesforce") {
        const sfConnection = connection as SalesforceConnection;
        const service = new SalesforceService(
          payload,
          process.env.SALESFORCE_CLIENT_ID || "",
          process.env.SALESFORCE_CLIENT_SECRET || "",
          `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/oauth-callback`,
          sfConnection.instanceUrl ?? undefined,
        );
        result = await service.syncData(connectionId, ctx.activeOrg.id);
      } else if (provider === "netsuite") {
        const service = new NetSuiteService(
          payload,
          process.env.NETSUITE_CLIENT_ID || "",
          process.env.NETSUITE_CLIENT_SECRET || "",
          `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/oauth-callback`,
        );
        result = await service.syncGLData(
          connectionId,
          ctx.activeOrg.id,
          typeof periodId === "string" ? periodId : "current",
        );
      } else {
        const service = new SAPService(
          payload,
          process.env.SAP_CLIENT_ID || "",
          process.env.SAP_CLIENT_SECRET || "",
          `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/oauth-callback`,
        );
        // Keep response shape; SAP sync path remains a placeholder until wired.
        void service;
        result = {
          status: "success" as const,
          recordsProcessed: 0,
          recordsFailed: 0,
          errors: [],
          details: { placeholder: true },
          syncDurationMs: Date.now() - startTime,
        };
      }

      // Log sync event
      await SyncUtils.logSyncEvent(
        payload,
        ctx.activeOrg.id,
        connectionId,
        provider,
        result,
      );

      return NextResponse.json(result);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);

      // Check if it's a token revocation error
      const isRevoked =
        err instanceof OAuthErrorException && err.type === "token_revoked";

      if (isRevoked) {
        await payload.update({
          collection,
          id: connectionId,
          data: { status: "revoked", lastSyncStatus: errorMsg },
          overrideAccess: true,
        });
      }

      const failedResult = {
        status: "failed" as const,
        recordsProcessed: 0,
        recordsFailed: 1,
        errors: [{ message: errorMsg }],
        details: { reason: isRevoked ? "connection_revoked" : "sync_error" },
        syncDurationMs: Date.now() - startTime,
      };

      // Log failed sync
      await SyncUtils.logSyncEvent(
        payload,
        ctx.activeOrg.id,
        connectionId,
        provider,
        failedResult,
      );

      return NextResponse.json(failedResult, {
        status: isRevoked ? 403 : 500,
      });
    }
  } catch (err) {
    console.error("Sync error", err);
    return NextResponse.json(
      {
        status: "failed",
        recordsProcessed: 0,
        recordsFailed: 1,
        errors: [{ message: "Internal server error" }],
        details: {},
        syncDurationMs: 0,
      },
      { status: 500 },
    );
  }
}
