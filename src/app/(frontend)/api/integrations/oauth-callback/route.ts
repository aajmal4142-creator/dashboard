import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { getPayload } from "payload";
import config from "@/payload.config";
import { SalesforceService } from "@/lib/integrations/salesforce";
import { NetSuiteService } from "@/lib/integrations/netsuite";
import { SAPService } from "@/lib/integrations/sap";
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

function isIntegrationProvider(value: string): value is IntegrationProvider {
  return value === "salesforce" || value === "netsuite" || value === "sap";
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");
    const errorDescription = searchParams.get("error_description");

    if (error) {
      return NextResponse.redirect(
        `/integrations?error=${encodeURIComponent(error)}&description=${encodeURIComponent(errorDescription || "")}`,
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        `/integrations?error=missing_params&description=Authorization code or state parameter missing`,
      );
    }

    const ctx = await getCurrentContext();
    if (!ctx.activeOrg?.id) {
      return NextResponse.redirect("/auth/login");
    }

    const payload = await getPayload({ config });

    // Determine provider from state (state format: "provider:connectionId")
    const [providerRaw, connectionId] = state.split(":");

    if (!providerRaw || !connectionId || !isIntegrationProvider(providerRaw)) {
      return NextResponse.redirect(
        `/integrations?error=unsupported_provider&provider=${providerRaw || "unknown"}`,
      );
    }

    const provider = providerRaw;
    const collection = PROVIDER_COLLECTIONS[provider];

    // Retrieve connection record
    const connection = (await payload.findByID({
      collection,
      id: connectionId,
    })) as ConnectionDoc;

    if (!connection) {
      return NextResponse.redirect(
        `/integrations?error=connection_not_found&provider=${provider}`,
      );
    }

    try {
      let tokens;

      if (provider === "salesforce") {
        const sfConnection = connection as SalesforceConnection;
        const service = new SalesforceService(
          payload,
          process.env.SALESFORCE_CLIENT_ID || "",
          process.env.SALESFORCE_CLIENT_SECRET || "",
          `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/oauth-callback`,
          sfConnection.instanceUrl ?? undefined,
        );
        tokens = await service.exchangeCodeForToken(code);
      } else if (provider === "netsuite") {
        const service = new NetSuiteService(
          payload,
          process.env.NETSUITE_CLIENT_ID || "",
          process.env.NETSUITE_CLIENT_SECRET || "",
          `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/oauth-callback`,
        );
        tokens = await service.exchangeCodeForToken(code);
      } else {
        const service = new SAPService(
          payload,
          process.env.SAP_CLIENT_ID || "",
          process.env.SAP_CLIENT_SECRET || "",
          `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/oauth-callback`,
        );
        tokens = await service.exchangeCodeForToken(code);
      }

      // Update connection with tokens
      await payload.update({
        collection,
        id: connectionId,
        data: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: tokens.expiresAt,
          status: "connected",
          connectedAt: new Date().toISOString(),
          syncErrorCount: 0,
          lastSyncStatus: null,
        },
        overrideAccess: true,
      });

      return NextResponse.redirect(
        `/integrations/${provider}?status=connected&connectionId=${connectionId}`,
      );
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);

      // Update connection with error status
      await payload.update({
        collection,
        id: connectionId,
        data: {
          status: "failed",
          lastSyncStatus: errorMsg,
        },
        overrideAccess: true,
      });

      return NextResponse.redirect(
        `/integrations/${provider}?error=auth_failed&message=${encodeURIComponent(errorMsg)}`,
      );
    }
  } catch (err) {
    console.error("OAuth callback error", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
