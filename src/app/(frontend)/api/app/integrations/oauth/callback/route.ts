import { NextResponse } from "next/server";
import { getPayload } from "payload";

import { getCurrentContext } from "@/lib/auth";
import { SAPService } from "@/lib/integrations/sap";
import { PowerBIConnector } from "@/lib/integrations/biconnector";
import type { PowerBIConfig } from "@/lib/integrations/types";
import config from "@/payload.config";

function orgIdFromRelation(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "id" in value) {
    return String((value as { id: string }).id);
  }
  return null;
}

export async function GET(request: Request) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.activeOrg) {
      return NextResponse.json({ error: "No active organisation" }, { status: 403 });
    }

    const organisationId = ctx.activeOrg.id;
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const provider = url.searchParams.get("provider");

    if (!code || !state || !provider) {
      return NextResponse.json(
        { error: "Missing required OAuth parameters" },
        { status: 400 },
      );
    }

    const payload = await getPayload({ config });

    if (provider === "sap") {
      const connection = await payload.findByID({
        collection: "sap-connections",
        id: state,
        overrideAccess: true,
      });

      if (!connection) {
        return NextResponse.json({ error: "Connection not found" }, { status: 404 });
      }

      if (orgIdFromRelation(connection.organisationId) !== organisationId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const sapService = new SAPService(
        payload,
        process.env.SAP_CLIENT_ID || "",
        process.env.SAP_CLIENT_SECRET || "",
        process.env.SAP_REDIRECT_URI || "",
      );

      const tokens = await sapService.exchangeCodeForToken(code);

      await payload.update({
        collection: "sap-connections",
        id: state,
        data: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: tokens.expiresAt,
          status: "connected",
          connectedAt: new Date().toISOString(),
        },
        overrideAccess: true,
      });

      return NextResponse.json({ success: true, message: "SAP connection established" });
    }

    if (provider === "powerbi") {
      const connection = await payload.findByID({
        collection: "powerbi-connections",
        id: state,
        overrideAccess: true,
      });

      if (!connection) {
        return NextResponse.json({ error: "Connection not found" }, { status: 404 });
      }

      if (orgIdFromRelation(connection.organisationId) !== organisationId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const powerBiConfig = connection.config as PowerBIConfig;
      const connector = new PowerBIConnector(payload, powerBiConfig);

      const tokens = await connector.exchangeCodeForToken(
        code,
        process.env.POWERBI_REDIRECT_URI || "",
      );

      await payload.update({
        collection: "powerbi-connections",
        id: state,
        data: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: tokens.expiresAt,
        },
        overrideAccess: true,
      });

      return NextResponse.json({
        success: true,
        message: "Power BI connection established",
      });
    }

    return NextResponse.json({ error: "Unsupported provider" }, { status: 400 });
  } catch (error) {
    console.error("OAuth callback error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "OAuth callback failed" },
      { status: 500 },
    );
  }
}
