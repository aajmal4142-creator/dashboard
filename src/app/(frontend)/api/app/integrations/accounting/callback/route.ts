import { getPayload } from "payload";
import { NextResponse } from "next/server";

import config from "@/payload.config";
import { AccountingService } from "@/lib/integrations/accounting";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const realmId = searchParams.get("realmId"); // QB-specific

  if (error) {
    return NextResponse.json(
      { error: `Accounting auth failed: ${error}` },
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
    collection: "accounting-connections",
    id: state,
    overrideAccess: true,
  });

  if (!connection) {
    return NextResponse.json({ error: "Connection not found" }, { status: 404 });
  }

  try {
    const provider = connection.provider as "xero" | "quickbooks";
    const clientId =
      provider === "xero"
        ? process.env.XERO_CLIENT_ID || ""
        : process.env.QB_CLIENT_ID || "";
    const clientSecret =
      provider === "xero"
        ? process.env.XERO_CLIENT_SECRET || ""
        : process.env.QB_CLIENT_SECRET || "";
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/app/integrations/accounting/callback`;

    const service = new AccountingService(
      payload,
      provider,
      clientId,
      clientSecret,
      redirectUri,
    );

    const tokens = await service.exchangeCodeForToken(code, realmId || undefined);

    await payload.update({
      collection: "accounting-connections",
      id: state,
      data: {
        status: "connected",
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
        providerId: realmId || "", // QB uses realmId, Xero uses tenant ID
        connectedAt: new Date().toISOString(),
      },
      overrideAccess: true,
    });

    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/integrations/accounting?connected=true&provider=${provider}`,
    );
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);

    await payload.update({
      collection: "accounting-connections",
      id: state,
      data: {
        status: "failed",
        lastSyncStatus: errorMsg,
      },
      overrideAccess: true,
    });

    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/integrations/accounting?error=${encodeURIComponent(errorMsg)}`,
    );
  }
}
