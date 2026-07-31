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

/**
 * Wave Accounting — OAuth + GraphQL.
 * Public docs: https://developer.waveapps.com/hc/en-us/articles/360019968212
 */
const WAVE_AUTH_URL = "https://api.waveapps.com/oauth2/authorize/";
const WAVE_TOKEN_URL = "https://api.waveapps.com/oauth2/token/";
const WAVE_GRAPHQL_URL = "https://gql.waveapps.com/graphql/public";

export const WAVE_SCOPE = "account:read business:read transaction:read";

export function waveAuthUrl(
  credentials: ProviderCredentials,
  connectionId: string,
): string {
  const params = new URLSearchParams({
    client_id: credentials.clientId,
    redirect_uri: credentials.redirectUri,
    response_type: "code",
    scope: WAVE_SCOPE,
    state: connectionId,
  });
  return `${WAVE_AUTH_URL}?${params.toString()}`;
}

export async function waveExchangeCode(
  credentials: ProviderCredentials,
  code: string,
): Promise<OAuthTokens> {
  const response = await fetch(WAVE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: credentials.redirectUri,
      scope: WAVE_SCOPE,
    }).toString(),
  });

  if (!response.ok) {
    throw new Error(`Wave OAuth failed: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: data.expires_in
      ? new Date(Date.now() + data.expires_in * 1000).toISOString()
      : undefined,
  };
}

export async function waveRefreshToken(
  credentials: ProviderCredentials,
  refreshToken: string,
): Promise<OAuthTokens> {
  const response = await fetch(WAVE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
      scope: WAVE_SCOPE,
    }).toString(),
  });

  if (!response.ok) {
    throw new Error(`Wave token refresh failed: ${response.status}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken,
    expiresAt: data.expires_in
      ? new Date(Date.now() + data.expires_in * 1000).toISOString()
      : undefined,
  };
}

type WaveGraphqlResponse = {
  data?: {
    businesses?: {
      edges?: Array<{
        node?: {
          id?: string;
          name?: string;
          accounts?: {
            edges?: Array<{
              node?: {
                id?: string;
                name?: string;
                displayId?: string;
                subtype?: { name?: string; value?: string };
              };
            }>;
          };
          expenses?: {
            edges?: Array<{
              node?: {
                id?: string;
                amount?: { value?: string; currency?: { code?: string } };
                incurredAt?: string;
                description?: string;
                category?: { name?: string; id?: string };
                account?: { id?: string; name?: string; displayId?: string };
              };
            }>;
          };
        };
      }>;
    };
  };
  errors?: Array<{ message?: string }>;
};

const WAVE_SPEND_QUERY = `
query ClearEsgSpend($page: Int!) {
  businesses(page: $page, pageSize: 1) {
    edges {
      node {
        id
        name
        accounts(page: 1, pageSize: 200) {
          edges {
            node {
              id
              name
              displayId
              subtype { name value }
            }
          }
        }
        expenses(page: 1, pageSize: 200) {
          edges {
            node {
              id
              amount { value currency { code } }
              incurredAt
              description
              category { id name }
              account { id name displayId }
            }
          }
        }
      }
    }
  }
}
`;

export async function waveFetchSpend(
  accessToken: string,
  opts: {
    businessId?: string;
    periodStart: Date;
    periodEnd: Date;
  },
): Promise<ProviderFetchResult> {
  if (isSandboxToken(accessToken)) {
    return {
      companyName: sandboxCompanyName("wave"),
      accounts: SANDBOX_ACCOUNTS,
      spendLines: sandboxSpendLines("wave", opts.periodStart, opts.periodEnd),
    };
  }

  const response = await fetch(WAVE_GRAPHQL_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: WAVE_SPEND_QUERY, variables: { page: 1 } }),
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("Wave API returned 401 — token expired or revoked");
    }
    throw new Error(`Wave GraphQL failed: ${response.statusText}`);
  }

  const payload = (await response.json()) as WaveGraphqlResponse;
  if (payload.errors?.length) {
    throw new Error(payload.errors[0]?.message || "Wave GraphQL error");
  }

  const businesses = payload.data?.businesses?.edges ?? [];
  const preferred =
    businesses.find((e) => e.node?.id === opts.businessId)?.node || businesses[0]?.node;

  if (!preferred) {
    throw new Error("No Wave business found for this connection");
  }

  const accounts: DiscoveredAccount[] = [];
  for (const edge of preferred.accounts?.edges ?? []) {
    const node = edge.node;
    if (!node) continue;
    const code = node.displayId || node.id || "";
    if (!code) continue;
    accounts.push({
      code,
      name: node.name || code,
      providerAccountId: node.id,
    });
  }

  const startMs = opts.periodStart.getTime();
  const endMs = opts.periodEnd.getTime();
  const spendLines: AccountingSpendLine[] = [];

  for (const edge of preferred.expenses?.edges ?? []) {
    const node = edge.node;
    if (!node?.id) continue;
    const amount = Number(node.amount?.value ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    const txnDate = (node.incurredAt || "").slice(0, 10);
    const txnMs = txnDate ? new Date(txnDate).getTime() : NaN;
    if (Number.isFinite(txnMs) && (txnMs < startMs || txnMs > endMs)) continue;

    const code =
      node.account?.displayId || node.account?.id || node.category?.id || "uncategorised";
    const name = node.account?.name || node.category?.name || node.description || code;

    spendLines.push({
      accountCode: code,
      accountName: name,
      amount,
      currency: node.amount?.currency?.code || "USD",
      txnDate,
      externalId: node.id,
      description: node.description,
    });
  }

  return {
    companyName: preferred.name ?? null,
    accounts,
    spendLines,
  };
}
