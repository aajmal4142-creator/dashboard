import type { Payload } from "payload";

import { calculateSpendBasedEmissions } from "@/lib/calc/spendBasedEmissions";
import type { SpendFactor } from "@/lib/calc/spendBasedEmissions";
import { SPEND_BASED_EMISSIONS_SLUG } from "@/collections/SpendBasedEmissions";
import type { OAuthTokens, SyncResult } from "../types";
import {
  DEFAULT_ACCOUNT_MAPPINGS,
  parseCategoryMapping,
  resolveAccountMapping,
  toSpendLedgerCategory,
} from "./categoryMapping";
import {
  SANDBOX_ACCESS_TOKEN,
  SANDBOX_ACCOUNTS,
  SANDBOX_REFRESH_TOKEN,
  isSandboxToken,
  sandboxCompanyName,
} from "./mockData";
import {
  quickbooksAuthUrl,
  quickbooksExchangeCode,
  quickbooksFetchSpend,
  quickbooksRefreshToken,
} from "./providers/quickbooks";
import {
  waveAuthUrl,
  waveExchangeCode,
  waveFetchSpend,
  waveRefreshToken,
} from "./providers/wave";
import {
  xeroAuthUrl,
  xeroExchangeCode,
  xeroFetchSpend,
  xeroRefreshToken,
} from "./providers/xero";
import { decryptTokenBundle, encryptTokenBundle } from "./tokens";
import type {
  AccountingConnectionMode,
  AccountingProvider,
  CategoryMapping,
  DiscoveredAccount,
  ProviderCredentials,
  ProviderFetchResult,
} from "./types";

const REFRESH_THRESHOLD_MS = 5 * 60 * 1000;

/** Sandbox-only IO factors (kg CO2e / USD) when registry factors are unavailable. */
const SANDBOX_FACTORS: Record<string, SpendFactor> = {
  fuel_energy: {
    value: 0.45,
    confidence: "low",
    uncertainty: 40,
    source: "sandbox",
    region: "Global",
  },
  transportation: {
    value: 0.22,
    confidence: "low",
    uncertainty: 40,
    source: "sandbox",
    region: "Global",
  },
  services: {
    value: 0.12,
    confidence: "low",
    uncertainty: 45,
    source: "sandbox",
    region: "Global",
  },
  facilities: {
    value: 0.18,
    confidence: "low",
    uncertainty: 40,
    source: "sandbox",
    region: "Global",
  },
  it: {
    value: 0.08,
    confidence: "low",
    uncertainty: 40,
    source: "sandbox",
    region: "Global",
  },
  waste: {
    value: 0.3,
    confidence: "low",
    uncertainty: 50,
    source: "sandbox",
    region: "Global",
  },
  packaging: {
    value: 0.25,
    confidence: "low",
    uncertainty: 40,
    source: "sandbox",
    region: "Global",
  },
  raw_materials: {
    value: 0.35,
    confidence: "low",
    uncertainty: 40,
    source: "sandbox",
    region: "Global",
  },
};

function orgIdOf(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "id" in value) {
    return String((value as { id: string }).id);
  }
  return null;
}

export function isAccountingProvider(value: string): value is AccountingProvider {
  return value === "xero" || value === "quickbooks" || value === "wave";
}

export function resolveProviderCredentials(
  provider: AccountingProvider,
  redirectUri: string,
): { credentials: ProviderCredentials; mode: AccountingConnectionMode } {
  const envMap: Record<AccountingProvider, { id?: string; secret?: string }> = {
    xero: {
      id: process.env.XERO_CLIENT_ID,
      secret: process.env.XERO_CLIENT_SECRET,
    },
    quickbooks: {
      id: process.env.QB_CLIENT_ID || process.env.QUICKBOOKS_CLIENT_ID,
      secret: process.env.QB_CLIENT_SECRET || process.env.QUICKBOOKS_CLIENT_SECRET,
    },
    wave: {
      id: process.env.WAVE_CLIENT_ID,
      secret: process.env.WAVE_CLIENT_SECRET,
    },
  };

  const cfg = envMap[provider];
  const clientId = cfg.id?.trim() || "";
  const clientSecret = cfg.secret?.trim() || "";

  if (!clientId || !clientSecret) {
    return {
      mode: "sandbox",
      credentials: {
        clientId: "sandbox",
        clientSecret: "sandbox",
        redirectUri,
      },
    };
  }

  return {
    mode: "live",
    credentials: { clientId, clientSecret, redirectUri },
  };
}

export function buildSandboxCallbackUrl(
  appUrl: string,
  connectionId: string,
  provider: AccountingProvider,
): string {
  const params = new URLSearchParams({
    code: "sandbox",
    state: connectionId,
    mock: "1",
    provider,
  });
  if (provider === "quickbooks") {
    params.set("realmId", `sandbox-realm-${connectionId}`);
  }
  return `${appUrl}/api/app/integrations/accounting/callback?${params.toString()}`;
}

export class AccountingService {
  constructor(
    private payload: Payload,
    private provider: AccountingProvider,
    private credentials: ProviderCredentials,
    private mode: AccountingConnectionMode = "live",
  ) {}

  getAuthUrl(connectionId: string, appUrlOverride?: string): string {
    if (this.mode === "sandbox") {
      const appUrl =
        appUrlOverride?.replace(/\/$/, "") ||
        process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
        "http://localhost:3000";
      return buildSandboxCallbackUrl(appUrl, connectionId, this.provider);
    }
    if (this.provider === "xero") {
      return xeroAuthUrl(this.credentials, connectionId);
    }
    if (this.provider === "wave") {
      return waveAuthUrl(this.credentials, connectionId);
    }
    return quickbooksAuthUrl(this.credentials, connectionId);
  }

  async exchangeCodeForToken(
    code: string,
    realmId?: string,
  ): Promise<OAuthTokens & { providerId?: string; companyName?: string }> {
    if (this.mode === "sandbox" || code === "sandbox") {
      return {
        accessToken: SANDBOX_ACCESS_TOKEN,
        refreshToken: SANDBOX_REFRESH_TOKEN,
        expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
        providerId:
          realmId ||
          (this.provider === "quickbooks"
            ? `sandbox-realm`
            : `sandbox-tenant-${this.provider}`),
        companyName: sandboxCompanyName(this.provider),
      };
    }

    if (this.provider === "xero") {
      const tokens = await xeroExchangeCode(this.credentials, code);
      return { ...tokens, providerId: realmId || "" };
    }
    if (this.provider === "wave") {
      const tokens = await waveExchangeCode(this.credentials, code);
      return { ...tokens, providerId: realmId || "" };
    }
    const tokens = await quickbooksExchangeCode(this.credentials, code);
    return { ...tokens, providerId: realmId || "" };
  }

  async refreshAccessToken(refreshToken: string): Promise<OAuthTokens> {
    if (this.mode === "sandbox" || isSandboxToken(refreshToken)) {
      return {
        accessToken: SANDBOX_ACCESS_TOKEN,
        refreshToken: SANDBOX_REFRESH_TOKEN,
        expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
      };
    }
    if (this.provider === "xero") {
      return xeroRefreshToken(this.credentials, refreshToken);
    }
    if (this.provider === "wave") {
      return waveRefreshToken(this.credentials, refreshToken);
    }
    return quickbooksRefreshToken(this.credentials, refreshToken);
  }

  /**
   * Ensure a valid (possibly refreshed) plaintext access token.
   * Persists re-encrypted tokens when refreshed.
   */
  async ensureValidAccessToken(connectionId: string): Promise<{
    accessToken: string;
    providerId: string;
    mode: AccountingConnectionMode;
  }> {
    const connection = await this.payload.findByID({
      collection: "accounting-connections",
      id: connectionId,
      overrideAccess: true,
    });

    if (!connection?.accessToken) {
      throw new Error("Accounting connection is missing credentials");
    }

    const mode =
      (connection.connectionMode as AccountingConnectionMode | null) || this.mode;
    const decrypted = decryptTokenBundle({
      accessToken: connection.accessToken as string,
      refreshToken: (connection.refreshToken as string) || undefined,
      expiresAt: connection.expiresAt ? String(connection.expiresAt) : undefined,
    });

    const expiresAt = decrypted.expiresAt ? new Date(decrypted.expiresAt) : null;
    const needsRefresh =
      expiresAt !== null && expiresAt.getTime() - Date.now() <= REFRESH_THRESHOLD_MS;

    if (!needsRefresh) {
      return {
        accessToken: decrypted.accessToken,
        providerId: String(connection.providerId || ""),
        mode,
      };
    }

    if (!decrypted.refreshToken) {
      throw new Error("Token expired and no refresh token available");
    }

    try {
      const refreshed = await this.refreshAccessToken(decrypted.refreshToken);
      const encrypted = encryptTokenBundle({
        accessToken: refreshed.accessToken,
        refreshToken: refreshed.refreshToken || decrypted.refreshToken,
        expiresAt: refreshed.expiresAt,
      });

      await this.payload.update({
        collection: "accounting-connections",
        id: connectionId,
        data: {
          accessToken: encrypted.accessToken,
          refreshToken: encrypted.refreshToken,
          expiresAt: encrypted.expiresAt,
          status: "connected",
        },
        overrideAccess: true,
      });

      return {
        accessToken: refreshed.accessToken,
        providerId: String(connection.providerId || ""),
        mode,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await this.payload.update({
        collection: "accounting-connections",
        id: connectionId,
        data: {
          status:
            msg.includes("401") || msg.toLowerCase().includes("revok")
              ? "expired"
              : "failed",
          lastSyncStatus: msg,
        },
        overrideAccess: true,
      });
      throw err;
    }
  }

  private async fetchProviderData(
    accessToken: string,
    providerId: string,
    periodStart: Date,
    periodEnd: Date,
    mode: AccountingConnectionMode,
  ): Promise<ProviderFetchResult> {
    if (this.provider === "xero") {
      return xeroFetchSpend(accessToken, {
        tenantId: providerId || undefined,
        periodStart,
        periodEnd,
      });
    }
    if (this.provider === "wave") {
      return waveFetchSpend(accessToken, {
        businessId: providerId || undefined,
        periodStart,
        periodEnd,
      });
    }
    return quickbooksFetchSpend(accessToken, providerId, {
      periodStart,
      periodEnd,
      useSandboxApi: mode === "sandbox",
    });
  }

  async syncExpenses(
    connectionId: string,
    organisationId: string,
    periodId: string,
    opts?: { actorId?: string },
  ): Promise<SyncResult> {
    const startTime = Date.now();
    const errors: Array<{ message: string; recordId?: string }> = [];
    let processed = 0;

    try {
      const connection = await this.payload.findByID({
        collection: "accounting-connections",
        id: connectionId,
        overrideAccess: true,
      });

      if (!connection) {
        throw new Error("Accounting connection not found");
      }
      if (orgIdOf(connection.organisationId) !== organisationId) {
        throw new Error("Connection does not belong to active organisation");
      }

      const period = await this.payload.findByID({
        collection: "reporting-periods",
        id: periodId,
        overrideAccess: true,
      });
      if (!period || orgIdOf(period.organisation) !== organisationId) {
        throw new Error("Reporting period not found for organisation");
      }

      const periodStart = new Date(String(period.startDate));
      const periodEnd = new Date(String(period.endDate));

      const { accessToken, providerId, mode } =
        await this.ensureValidAccessToken(connectionId);

      let fetchResult: ProviderFetchResult;
      try {
        fetchResult = await this.fetchProviderData(
          accessToken,
          providerId,
          periodStart,
          periodEnd,
          mode,
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("401")) {
          // Attempt one refresh then retry
          if (connection.refreshToken) {
            const decrypted = decryptTokenBundle({
              accessToken: connection.accessToken as string,
              refreshToken: connection.refreshToken as string,
            });
            if (decrypted.refreshToken) {
              const refreshed = await this.refreshAccessToken(decrypted.refreshToken);
              const encrypted = encryptTokenBundle(refreshed);
              await this.payload.update({
                collection: "accounting-connections",
                id: connectionId,
                data: {
                  accessToken: encrypted.accessToken,
                  refreshToken: encrypted.refreshToken,
                  expiresAt: encrypted.expiresAt,
                },
                overrideAccess: true,
              });
              fetchResult = await this.fetchProviderData(
                refreshed.accessToken,
                providerId,
                periodStart,
                periodEnd,
                mode,
              );
            } else {
              throw err;
            }
          } else {
            throw err;
          }
        } else {
          throw err;
        }
      }

      processed = fetchResult.spendLines.length;
      const mapping = parseCategoryMapping(connection.expenseCategoryMapping);
      const accounts: DiscoveredAccount[] =
        fetchResult.accounts.length > 0 ? fetchResult.accounts : SANDBOX_ACCOUNTS;

      // Aggregate spend by ledger category + scope
      const buckets = new Map<
        string,
        {
          category: ReturnType<typeof toSpendLedgerCategory>;
          scope: "1" | "2" | "3";
          amount: number;
          currency: string;
          glCodes: Set<string>;
          unmatched: boolean;
        }
      >();

      for (const line of fetchResult.spendLines) {
        const resolved = resolveAccountMapping(
          { code: line.accountCode, name: line.accountName },
          mapping,
        );
        const ledger = toSpendLedgerCategory(resolved.category);
        const key = `${ledger}:${resolved.scope}:${line.currency || "USD"}`;
        const existing = buckets.get(key);
        if (existing) {
          existing.amount += line.amount;
          existing.glCodes.add(line.accountCode);
        } else {
          buckets.set(key, {
            category: ledger,
            scope: resolved.scope,
            amount: line.amount,
            currency: line.currency || "USD",
            glCodes: new Set([line.accountCode]),
            unmatched: resolved.category === "other",
          });
        }
      }

      const spendRecordIds: string[] = [];
      const categoryBreakdown: Record<string, number> = {};

      for (const bucket of buckets.values()) {
        try {
          const factor =
            mode === "sandbox"
              ? SANDBOX_FACTORS[bucket.category] || SANDBOX_FACTORS.services
              : await this.loadRegistryFactor(organisationId, bucket.category);

          if (!factor) {
            errors.push({
              message: `No emissions factor for category ${bucket.category}. Seed custom spend factors or sync in sandbox mode.`,
              recordId: bucket.category,
            });
            continue;
          }

          const currencyRaw = (bucket.currency || "USD").toUpperCase();
          const currency =
            currencyRaw === "EUR" ||
            currencyRaw === "GBP" ||
            currencyRaw === "INR" ||
            currencyRaw === "USD"
              ? currencyRaw
              : "USD";

          const result = calculateSpendBasedEmissions(
            {
              category: bucket.category,
              totalSpend: bucket.amount,
              currency,
              periodStart: periodStart.toISOString(),
              periodEnd: periodEnd.toISOString(),
              glCodeRange: [...bucket.glCodes],
              subcategory: bucket.unmatched ? "Other (unmatched)" : undefined,
            },
            factor,
          );

          categoryBreakdown[bucket.category] =
            (categoryBreakdown[bucket.category] || 0) + result.calculatedEmissions;

          const now = new Date().toISOString();
          const created = await this.payload.create({
            collection: SPEND_BASED_EMISSIONS_SLUG,
            data: {
              organisation: organisationId,
              periodStart: periodStart.toISOString(),
              periodEnd: periodEnd.toISOString(),
              category: bucket.category,
              subcategory: bucket.unmatched
                ? "Other (unmatched)"
                : `${this.provider} sync`,
              totalSpend: result.totalSpend,
              currency,
              emissionsFactor: result.emissionsFactor,
              calculatedEmissions: result.calculatedEmissions,
              emissionsFactorSource: "custom",
              confidence: result.confidence,
              uncertainty: result.uncertainty,
              region: result.region ?? "Global",
              glCodeRange: [...bucket.glCodes].map((glCode) => ({ glCode })),
              scope: bucket.scope,
              dataQuality: "estimated",
              notes: `source=accounting provider=${this.provider} connection=${connectionId} mode=${mode}`,
              auditTrail: opts?.actorId
                ? [
                    {
                      timestamp: now,
                      action: "accounting_sync",
                      changedBy: opts.actorId,
                      changes: {
                        provider: this.provider,
                        connectionId,
                        quality: "estimated",
                        provenance: "spend_estimate",
                      },
                    },
                  ]
                : undefined,
            },
            overrideAccess: true,
          });
          spendRecordIds.push(created.id);

          if (opts?.actorId) {
            await this.payload.create({
              collection: "datapoints",
              data: {
                organisation: organisationId,
                period: periodId,
                metricKey: `emissions.spend.${this.provider}.${bucket.category}`,
                value: result.calculatedEmissions / 1000,
                unit: "tCO2e",
                quality: "estimated",
                provenance: "spend_estimate",
                source: "api",
                approvalState: "pending",
                note: `Accounting sync (${this.provider}): ${result.totalSpend} ${currency} → ${result.calculatedEmissions.toFixed(2)} kgCO2e`,
                enteredBy: opts.actorId,
                enteredAt: now,
              },
              overrideAccess: true,
            });
          }
        } catch (err) {
          errors.push({
            message: `Failed to persist ${bucket.category}: ${err instanceof Error ? err.message : String(err)}`,
            recordId: bucket.category,
          });
        }
      }

      const nextSyncAt = computeNextSyncAt(
        connection.syncConfig?.syncFrequency || "manual",
      );

      await this.payload.update({
        collection: "accounting-connections",
        id: connectionId,
        data: {
          lastSyncAt: new Date().toISOString(),
          lastSyncStatus: errors.length === 0 ? "success" : "partial",
          syncErrorCount: errors.length,
          companyName: fetchResult.companyName || connection.companyName,
          discoveredAccounts: accounts,
          nextSyncAt,
          expenseCategoryMapping:
            connection.expenseCategoryMapping || DEFAULT_ACCOUNT_MAPPINGS,
        },
        overrideAccess: true,
      });

      return {
        status: errors.length === 0 ? "success" : "partial",
        recordsProcessed: processed,
        recordsFailed: errors.length,
        errors,
        details: {
          expensesSynced: processed,
          categoriesProcessed: buckets.size,
          categoryBreakdown,
          spendRecordIds,
          companyName: fetchResult.companyName,
          mode,
        },
        syncDurationMs: Date.now() - startTime,
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      errors.push({ message: errorMsg });

      await this.payload
        .update({
          collection: "accounting-connections",
          id: connectionId,
          data: {
            lastSyncAt: new Date().toISOString(),
            lastSyncStatus: "failed",
            syncErrorCount: 1,
          },
          overrideAccess: true,
        })
        .catch(() => undefined);

      return {
        status: "failed",
        recordsProcessed: processed,
        recordsFailed: 1,
        errors,
        details: {},
        syncDurationMs: Date.now() - startTime,
      };
    }
  }

  private async loadRegistryFactor(
    organisationId: string,
    category: string,
  ): Promise<SpendFactor | null> {
    const result = await this.payload.find({
      collection: "custom-emission-factors",
      where: {
        and: [
          { organisation: { equals: organisationId } },
          { category: { equals: category } },
          { status: { equals: "active" } },
        ],
      },
      sort: "-effectiveDate",
      limit: 1,
      overrideAccess: true,
    });

    const doc = result.docs[0];
    if (!doc || !Number.isFinite(doc.value)) return null;

    const confidence =
      doc.confidence === "low" || doc.confidence === "medium" || doc.confidence === "high"
        ? doc.confidence
        : "medium";

    return {
      value: doc.value,
      confidence,
      uncertainty: typeof doc.uncertainty === "number" ? doc.uncertainty : 25,
      source: doc.source || "custom",
      region: doc.region ?? "Global",
    };
  }
}

export function computeNextSyncAt(frequency: string | null | undefined): string | null {
  if (!frequency || frequency === "manual") return null;
  const next = new Date();
  if (frequency === "daily") next.setDate(next.getDate() + 1);
  else if (frequency === "weekly") next.setDate(next.getDate() + 7);
  else if (frequency === "monthly") next.setMonth(next.getMonth() + 1);
  else return null;
  return next.toISOString();
}

export function seedDefaultMapping(): CategoryMapping {
  return { ...DEFAULT_ACCOUNT_MAPPINGS };
}

export { encryptTokenBundle, decryptTokenBundle };
