import { getPayload } from "payload";
import { NextResponse } from "next/server";

import config from "@/payload.config";
import { SalesforceService } from "@/lib/integrations/salesforce";

const SALESFORCE_CLIENT_ID = process.env.SALESFORCE_CLIENT_ID || "";
const SALESFORCE_CLIENT_SECRET = process.env.SALESFORCE_CLIENT_SECRET || "";
const SALESFORCE_REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/app/integrations/salesforce/callback`;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.json(
      { error: `Salesforce auth failed: ${error}` },
      { status: 400 },
    );
  }

  if (!code || !state) {
    return NextResponse.json(
      { error: "Missing authorization code or state" },
      { status: 400 },
    );
  }

  const payload = await getPayload({ config });

  const connection = await payload.findByID({
    collection: "salesforce-connections",
    id: state,
    overrideAccess: true,
  });

  if (!connection) {
    return NextResponse.json({ error: "Connection not found" }, { status: 404 });
  }

  try {
    const service = new SalesforceService(
      payload,
      SALESFORCE_CLIENT_ID,
      SALESFORCE_CLIENT_SECRET,
      SALESFORCE_REDIRECT_URI,
    );

    const tokens = await service.exchangeCodeForToken(code);

    // Extract instance URL from token response (Salesforce returns it)
    // For now, we'll use a default and user should configure it
    const response = await fetch("https://login.salesforce.com/services/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: SALESFORCE_CLIENT_ID,
        client_secret: SALESFORCE_CLIENT_SECRET,
        redirect_uri: SALESFORCE_REDIRECT_URI,
      }).toString(),
    });

    const data = (await response.json()) as { instance_url?: string };
    const instanceUrl = data.instance_url || "https://login.salesforce.com";

    await payload.update({
      collection: "salesforce-connections",
      id: state,
      data: {
        status: "connected",
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
        instanceUrl,
        connectedAt: new Date().toISOString(),
      },
      overrideAccess: true,
    });

    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/integrations/salesforce?connected=true`,
    );
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);

    await payload.update({
      collection: "salesforce-connections",
      id: state,
      data: {
        status: "failed",
        lastSyncStatus: errorMsg,
      },
      overrideAccess: true,
    });

    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/integrations/salesforce?error=${encodeURIComponent(errorMsg)}`,
    );
  }
}
