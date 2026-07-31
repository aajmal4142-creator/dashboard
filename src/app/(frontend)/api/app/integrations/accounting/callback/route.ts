import { getPayload } from "payload";
import { NextResponse } from "next/server";

import {
  AccountingService,
  encryptTokenBundle,
  isAccountingProvider,
  resolveProviderCredentials,
  SANDBOX_ACCOUNTS,
  sandboxCompanyName,
  seedDefaultMapping,
} from "@/lib/integrations/accounting";
import config from "@/payload.config";

function appBaseUrl(req: Request): string {
  try {
    const origin = new URL(req.url).origin;
    if (origin && origin !== "null") return origin;
  } catch {
    /* fall through */
  }
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const realmId = searchParams.get("realmId");
  const mock = searchParams.get("mock") === "1";

  if (error) {
    return NextResponse.redirect(
      `${appBaseUrl(req)}/integrations/accounting?error=${encodeURIComponent(error)}`,
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      `${appBaseUrl(req)}/integrations/accounting?error=${encodeURIComponent("Missing authorization code or state")}`,
    );
  }

  const payload = await getPayload({ config });

  const connection = await payload.findByID({
    collection: "accounting-connections",
    id: state,
    overrideAccess: true,
  });

  if (!connection) {
    return NextResponse.redirect(
      `${appBaseUrl(req)}/integrations/accounting?error=${encodeURIComponent("Connection not found")}`,
    );
  }

  const providerRaw = String(connection.provider);
  if (!isAccountingProvider(providerRaw)) {
    return NextResponse.redirect(
      `${appBaseUrl(req)}/integrations/accounting?error=${encodeURIComponent("Invalid provider on connection")}`,
    );
  }
  const provider = providerRaw;

  try {
    const redirectUri = `${appBaseUrl(req)}/api/app/integrations/accounting/callback`;
    const storedMode =
      connection.connectionMode === "live" || connection.connectionMode === "sandbox"
        ? connection.connectionMode
        : undefined;
    const { credentials, mode: resolvedMode } = resolveProviderCredentials(
      provider,
      redirectUri,
    );
    const mode = mock || code === "sandbox" ? "sandbox" : storedMode || resolvedMode;

    const service = new AccountingService(payload, provider, credentials, mode);
    const tokens = await service.exchangeCodeForToken(code, realmId || undefined);
    const encrypted = encryptTokenBundle({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
    });

    const companyName =
      ("companyName" in tokens && tokens.companyName) ||
      (mode === "sandbox" ? sandboxCompanyName(provider) : null);

    await payload.update({
      collection: "accounting-connections",
      id: state,
      data: {
        status: "connected",
        connectionMode: mode,
        accessToken: encrypted.accessToken,
        refreshToken: encrypted.refreshToken,
        expiresAt: encrypted.expiresAt,
        providerId:
          tokens.providerId ||
          realmId ||
          (mode === "sandbox" ? `sandbox-${provider}` : connection.providerId),
        companyName: companyName || undefined,
        connectedAt: new Date().toISOString(),
        expenseCategoryMapping: connection.expenseCategoryMapping || seedDefaultMapping(),
        discoveredAccounts:
          mode === "sandbox" ? SANDBOX_ACCOUNTS : connection.discoveredAccounts,
      },
      overrideAccess: true,
    });

    return NextResponse.redirect(
      `${appBaseUrl(req)}/integrations/accounting?connected=true&provider=${provider}&mode=${mode}`,
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
      `${appBaseUrl(req)}/integrations/accounting?error=${encodeURIComponent(errorMsg)}`,
    );
  }
}
