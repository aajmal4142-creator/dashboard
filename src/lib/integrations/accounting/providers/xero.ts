import type { OAuthTokens } from "../../types";
import {
  isSandboxToken,
  SANDBOX_ACCOUNTS,
  sandboxCompanyName,
  sandboxSpendLines,
} from "../mockData";
import type {
  AccountingSpendLine,
  DiscoveredAccount,
  ProviderCredentials,
  ProviderFetchResult,
} from "../types";

const XERO_AUTH_URL = "https://login.xero.com/identity/connect/authorize";
const XERO_TOKEN_URL = "https://identity.xero.com/connect/token";
const XERO_API_URL = "https://api.xero.com/api.xro/2.0";
const XERO_CONNECTIONS_URL = "https://api.xero.com/connections";

export const XERO_SCOPE =
  "openid profile email accounting.transactions accounting.settings.read offline_access";

export function xeroAuthUrl(
  credentials: ProviderCredentials,
  connectionId: string,
): string {
  const params = new URLSearchParams({
    client_id: credentials.clientId,
    redirect_uri: credentials.redirectUri,
    response_type: "code",
    scope: XERO_SCOPE,
    state: connectionId,
  });
  return `${XERO_AUTH_URL}?${params.toString()}`;
}

export async function xeroExchangeCode(
  credentials: ProviderCredentials,
  code: string,
): Promise<OAuthTokens & { tenantId?: string }> {
  const response = await fetch(XERO_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${credentials.clientId}:${credentials.clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: credentials.redirectUri,
    }).toString(),
  });

  if (!response.ok) {
    throw new Error(`Xero OAuth failed: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
  };
}

export async function xeroRefreshToken(
  credentials: ProviderCredentials,
  refreshToken: string,
): Promise<OAuthTokens> {
  const response = await fetch(XERO_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${credentials.clientId}:${credentials.clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }).toString(),
  });

  if (!response.ok) {
    throw new Error(`Xero token refresh failed: ${response.status}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken,
    expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
  };
}

async function resolveTenantId(
  accessToken: string,
  knownTenantId?: string,
): Promise<string> {
  if (knownTenantId) return knownTenantId;
  const response = await fetch(XERO_CONNECTIONS_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new Error(`Failed to resolve Xero tenant: ${response.statusText}`);
  }
  const connections = (await response.json()) as Array<{ tenantId: string }>;
  if (!connections[0]?.tenantId) {
    throw new Error("No Xero tenant connected");
  }
  return connections[0].tenantId;
}

export async function xeroFetchSpend(
  accessToken: string,
  opts: {
    tenantId?: string;
    periodStart: Date;
    periodEnd: Date;
  },
): Promise<ProviderFetchResult> {
  if (isSandboxToken(accessToken)) {
    return {
      companyName: sandboxCompanyName("xero"),
      accounts: SANDBOX_ACCOUNTS,
      spendLines: sandboxSpendLines("xero", opts.periodStart, opts.periodEnd),
    };
  }

  const tenantId = await resolveTenantId(accessToken, opts.tenantId);
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "Xero-tenant-id": tenantId,
    Accept: "application/json",
  };

  const [orgRes, accountsRes, invoicesRes] = await Promise.all([
    fetch(`${XERO_API_URL}/Organisation`, { headers }),
    fetch(`${XERO_API_URL}/Accounts`, { headers }),
    fetch(`${XERO_API_URL}/Invoices?where=Type=="ACCPAY"&&Status=="AUTHORISED"`, {
      headers,
    }),
  ]);

  if (!invoicesRes.ok) {
    if (invoicesRes.status === 401) {
      throw new Error("Xero API returned 401 — token expired or revoked");
    }
    throw new Error(`Failed to fetch Xero invoices: ${invoicesRes.statusText}`);
  }

  let companyName: string | null = null;
  if (orgRes.ok) {
    const orgData = (await orgRes.json()) as {
      Organisations?: Array<{ Name?: string }>;
    };
    companyName = orgData.Organisations?.[0]?.Name ?? null;
  }

  const accounts: DiscoveredAccount[] = [];
  if (accountsRes.ok) {
    const accData = (await accountsRes.json()) as {
      Accounts?: Array<{ Code?: string; Name?: string; AccountID?: string }>;
    };
    for (const a of accData.Accounts ?? []) {
      if (!a.Code) continue;
      accounts.push({
        code: a.Code,
        name: a.Name ?? a.Code,
        providerAccountId: a.AccountID,
      });
    }
  }

  const invData = (await invoicesRes.json()) as {
    Invoices?: Array<{
      InvoiceID: string;
      DateString?: string;
      Date?: string;
      CurrencyCode?: string;
      LineItems?: Array<{
        Description?: string;
        Quantity?: number;
        UnitAmount?: number;
        LineAmount?: number;
        AccountCode?: string;
      }>;
    }>;
  };

  const spendLines: AccountingSpendLine[] = [];
  for (const inv of invData.Invoices ?? []) {
    const txnDate = (inv.DateString || inv.Date || "").slice(0, 10);
    for (const [idx, li] of (inv.LineItems ?? []).entries()) {
      const amount =
        typeof li.LineAmount === "number"
          ? li.LineAmount
          : (li.Quantity ?? 0) * (li.UnitAmount ?? 0);
      if (!li.AccountCode || amount <= 0) continue;
      spendLines.push({
        accountCode: li.AccountCode,
        accountName: li.Description || li.AccountCode,
        amount,
        currency: inv.CurrencyCode || "USD",
        txnDate,
        externalId: `${inv.InvoiceID}-${idx}`,
        description: li.Description,
      });
    }
  }

  return { companyName, accounts, spendLines };
}
