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

const QB_AUTH_URL = "https://appcenter.intuit.com/connect/oauth2";
const QB_TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
const QB_API_BASE = "https://quickbooks.api.intuit.com/v3/company";
const QB_SANDBOX_API_BASE = "https://sandbox-quickbooks.api.intuit.com/v3/company";

export const QB_SCOPE = "com.intuit.quickbooks.accounting";

export function quickbooksAuthUrl(
  credentials: ProviderCredentials,
  connectionId: string,
): string {
  const params = new URLSearchParams({
    client_id: credentials.clientId,
    redirect_uri: credentials.redirectUri,
    response_type: "code",
    scope: QB_SCOPE,
    state: connectionId,
  });
  return `${QB_AUTH_URL}?${params.toString()}`;
}

function basicAuth(credentials: ProviderCredentials): string {
  return Buffer.from(`${credentials.clientId}:${credentials.clientSecret}`).toString(
    "base64",
  );
}

export async function quickbooksExchangeCode(
  credentials: ProviderCredentials,
  code: string,
): Promise<OAuthTokens> {
  const response = await fetch(QB_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basicAuth(credentials)}`,
      Accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: credentials.redirectUri,
    }).toString(),
  });

  if (!response.ok) {
    throw new Error(`QuickBooks OAuth failed: ${response.status} ${response.statusText}`);
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

export async function quickbooksRefreshToken(
  credentials: ProviderCredentials,
  refreshToken: string,
): Promise<OAuthTokens> {
  const response = await fetch(QB_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basicAuth(credentials)}`,
      Accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }).toString(),
  });

  if (!response.ok) {
    throw new Error(`QuickBooks token refresh failed: ${response.status}`);
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

function apiBase(useSandbox: boolean): string {
  return useSandbox ? QB_SANDBOX_API_BASE : QB_API_BASE;
}

export async function quickbooksFetchSpend(
  accessToken: string,
  realmId: string,
  opts: {
    periodStart: Date;
    periodEnd: Date;
    useSandboxApi?: boolean;
  },
): Promise<ProviderFetchResult> {
  if (isSandboxToken(accessToken) || !realmId || realmId.startsWith("sandbox-")) {
    return {
      companyName: sandboxCompanyName("quickbooks"),
      accounts: SANDBOX_ACCOUNTS,
      spendLines: sandboxSpendLines("quickbooks", opts.periodStart, opts.periodEnd),
    };
  }

  const base = apiBase(Boolean(opts.useSandboxApi));
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/json",
  };

  const start = opts.periodStart.toISOString().slice(0, 10);
  const end = opts.periodEnd.toISOString().slice(0, 10);

  const [companyRes, accountsRes, purchasesRes] = await Promise.all([
    fetch(`${base}/${realmId}/companyinfo/${realmId}`, { headers }),
    fetch(
      `${base}/${realmId}/query?query=${encodeURIComponent("select * from Account maxresults 1000")}`,
      { headers },
    ),
    fetch(
      `${base}/${realmId}/query?query=${encodeURIComponent(
        `select * from Purchase where TxnDate >= '${start}' and TxnDate <= '${end}'`,
      )}`,
      { headers },
    ),
  ]);

  if (!purchasesRes.ok) {
    if (purchasesRes.status === 401) {
      throw new Error("QuickBooks API returned 401 — token expired or revoked");
    }
    throw new Error(`Failed to fetch QuickBooks purchases: ${purchasesRes.statusText}`);
  }

  let companyName: string | null = null;
  if (companyRes.ok) {
    const companyData = (await companyRes.json()) as {
      CompanyInfo?: { CompanyName?: string };
    };
    companyName = companyData.CompanyInfo?.CompanyName ?? null;
  }

  const accounts: DiscoveredAccount[] = [];
  if (accountsRes.ok) {
    const accData = (await accountsRes.json()) as {
      QueryResponse?: {
        Account?: Array<{
          Id?: string;
          Name?: string;
          AcctNum?: string;
          FullyQualifiedName?: string;
        }>;
      };
    };
    for (const a of accData.QueryResponse?.Account ?? []) {
      const code = a.AcctNum || a.Id || "";
      if (!code) continue;
      accounts.push({
        code,
        name: a.Name || a.FullyQualifiedName || code,
        providerAccountId: a.Id,
      });
    }
  }

  const purchaseData = (await purchasesRes.json()) as {
    QueryResponse?: {
      Purchase?: Array<{
        Id: string;
        TxnDate?: string;
        CurrencyRef?: { value?: string };
        Line?: Array<{
          Amount?: number;
          Description?: string;
          AccountBasedExpenseLineDetail?: {
            AccountRef?: { value?: string; name?: string };
          };
        }>;
      }>;
    };
  };

  const spendLines: AccountingSpendLine[] = [];
  for (const purchase of purchaseData.QueryResponse?.Purchase ?? []) {
    for (const [idx, line] of (purchase.Line ?? []).entries()) {
      const amount = line.Amount ?? 0;
      const accountRef = line.AccountBasedExpenseLineDetail?.AccountRef;
      if (!accountRef?.value || amount <= 0) continue;
      spendLines.push({
        accountCode: accountRef.value,
        accountName: accountRef.name || accountRef.value,
        amount,
        currency: purchase.CurrencyRef?.value || "USD",
        txnDate: (purchase.TxnDate || "").slice(0, 10),
        externalId: `${purchase.Id}-${idx}`,
        description: line.Description,
      });
    }
  }

  return { companyName, accounts, spendLines };
}
