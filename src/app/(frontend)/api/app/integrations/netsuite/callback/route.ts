import { getPayload } from "payload";
import { NextResponse } from "next/server";

import config from "@/payload.config";
import { NetSuiteService } from "@/lib/integrations/netsuite";

const NETSUITE_CLIENT_ID = process.env.NETSUITE_CLIENT_ID || "";
const NETSUITE_CLIENT_SECRET = process.env.NETSUITE_CLIENT_SECRET || "";
const NETSUITE_REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/app/integrations/netsuite/callback`;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.json(
      { error: `NetSuite auth failed: ${error}` },
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
    collection: "netsuite-connections",
    id: state,
    overrideAccess: true,
  });

  if (!connection) {
    return NextResponse.json({ error: "Connection not found" }, { status: 404 });
  }

  try {
    const service = new NetSuiteService(
      payload,
      NETSUITE_CLIENT_ID,
      NETSUITE_CLIENT_SECRET,
      NETSUITE_REDIRECT_URI,
    );

    const tokens = await service.exchangeCodeForToken(code);

    await payload.update({
      collection: "netsuite-connections",
      id: state,
      data: {
        status: "connected",
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
        connectedAt: new Date().toISOString(),
      },
      overrideAccess: true,
    });

    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/integrations/netsuite?connected=true`,
    );
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);

    await payload.update({
      collection: "netsuite-connections",
      id: state,
      data: {
        status: "failed",
        lastSyncStatus: errorMsg,
      },
      overrideAccess: true,
    });

    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/integrations/netsuite?error=${encodeURIComponent(errorMsg)}`,
    );
  }
}
