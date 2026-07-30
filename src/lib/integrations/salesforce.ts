import type { Payload } from "payload";
import type { SalesforceAccount, SalesforceContact, SyncResult } from "./types";
import {
  OAuthBase,
  OAuthErrorException,
  type OAuthConfig,
  type OAuthConnection,
  type TokenResponseBody,
} from "./oauth.base";
import { SyncUtils } from "./sync-utils";
import type { SalesforceConnection } from "@/payload-types";

const SALESFORCE_AUTH_URL = "https://login.salesforce.com/services/oauth2/authorize";
const SALESFORCE_TOKEN_URL = "https://login.salesforce.com/services/oauth2/token";

export class SalesforceService extends OAuthBase {
  private instanceUrl?: string;

  constructor(
    payload: Payload,
    clientId: string,
    clientSecret: string,
    redirectUri: string,
    instanceUrl?: string,
  ) {
    const config: OAuthConfig = {
      authUrl: SALESFORCE_AUTH_URL,
      tokenUrl: SALESFORCE_TOKEN_URL,
      clientId,
      clientSecret,
      redirectUri,
      scope: "api refresh_token",
    };
    super(payload, config, "salesforce-connections");
    this.instanceUrl = instanceUrl;
  }

  protected parseTokenResponse(data: TokenResponseBody, previousRefreshToken?: string) {
    if (data.instance_url && !this.instanceUrl) {
      this.instanceUrl = data.instance_url;
    }
    return super.parseTokenResponse(data, previousRefreshToken);
  }

  async fetchAccounts(accessToken: string): Promise<SalesforceAccount[]> {
    if (!this.instanceUrl) {
      throw new Error("Instance URL not configured");
    }

    const response = await fetch(
      `${this.instanceUrl}/services/data/v61.0/query?q=SELECT Id,Name,Industry,BillingCity,BillingCountry FROM Account`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw this.createOAuthError(
          {
            type: "token_revoked",
            message: "Token revoked or permission denied",
            retryable: false,
          },
          response.status,
        );
      }
      throw new Error(`Failed to fetch Salesforce accounts: ${response.statusText}`);
    }

    const data = (await response.json()) as {
      records: Array<{
        Id: string;
        Name: string;
        Industry?: string;
        BillingCity?: string;
        BillingCountry?: string;
      }>;
    };

    return data.records.map((r) => ({
      id: r.Id,
      name: r.Name,
      industry: r.Industry,
      billingCity: r.BillingCity,
      billingCountry: r.BillingCountry,
    }));
  }

  async fetchContacts(accessToken: string): Promise<SalesforceContact[]> {
    if (!this.instanceUrl) {
      throw new Error("Instance URL not configured");
    }

    const response = await fetch(
      `${this.instanceUrl}/services/data/v61.0/query?q=SELECT Id,AccountId,FirstName,LastName,Email,Phone,Title FROM Contact WHERE Email != null`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw this.createOAuthError(
          {
            type: "token_revoked",
            message: "Token revoked or permission denied",
            retryable: false,
          },
          response.status,
        );
      }
      throw new Error(`Failed to fetch Salesforce contacts: ${response.statusText}`);
    }

    const data = (await response.json()) as {
      records: Array<{
        Id: string;
        AccountId: string;
        FirstName: string;
        LastName: string;
        Email: string;
        Phone?: string;
        Title?: string;
      }>;
    };

    return data.records.map((r) => ({
      id: r.Id,
      accountId: r.AccountId,
      firstName: r.FirstName,
      lastName: r.LastName,
      email: r.Email,
      phone: r.Phone,
      title: r.Title,
    }));
  }

  async writeMetricsToAccounts(
    accessToken: string,
    metrics: Array<{ accountId: string; emissions: number; intensity: number }>,
  ): Promise<void> {
    if (!this.instanceUrl) {
      throw new Error("Instance URL not configured");
    }

    const updates = metrics.map((m) => ({
      Id: m.accountId,
      ESG_Emissions_tCO2e__c: m.emissions,
      ESG_Intensity__c: m.intensity,
    }));

    for (const update of updates) {
      const response = await fetch(
        `${this.instanceUrl}/services/data/v61.0/sobjects/Account/${update.Id}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(update),
        },
      );

      if (!response.ok && (response.status === 401 || response.status === 403)) {
        throw this.createOAuthError(
          {
            type: "token_revoked",
            message: "Token revoked or permission denied",
            retryable: false,
          },
          response.status,
        );
      }
    }
  }

  /**
   * Sync Salesforce data with ClearESG
   */
  async syncData(connectionId: string, organisationId: string): Promise<SyncResult> {
    const startTime = Date.now();
    const errors: Array<{ message: string; recordId?: string }> = [];
    let processed = 0;
    let failed = 0;
    let createdCount = 0;

    try {
      const connection = (await this.payload.findByID({
        collection: "salesforce-connections",
        id: connectionId,
      })) as SalesforceConnection;

      if (!connection?.instanceUrl || !connection?.accessToken) {
        throw new Error("Salesforce connection not properly configured");
      }

      const oauthConnection: OAuthConnection = {
        id: connectionId,
        accessToken: connection.accessToken,
        refreshToken: connection.refreshToken ?? undefined,
        expiresAt: connection.expiresAt ?? undefined,
        status: connection.status ?? undefined,
      };

      let accessToken: string;
      try {
        accessToken = await this.ensureValidToken(oauthConnection);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        errors.push({ message: `Token validation failed: ${errorMsg}` });
        failed += 1;
        if (err instanceof OAuthErrorException && err.type === "token_revoked") {
          return {
            status: "failed",
            recordsProcessed: processed,
            recordsFailed: failed,
            errors,
            details: { reason: "connection_revoked" },
            syncDurationMs: Date.now() - startTime,
          };
        }
        throw err;
      }

      this.instanceUrl = connection.instanceUrl;

      const config = connection.syncConfig;

      if (config?.enableAccountSync) {
        try {
          const accounts = await this.fetchAccounts(accessToken);

          // Deduplicate before creating
          const recordsToCreate = await SyncUtils.deduplicateBeforeCreate(
            this.payload,
            "suppliers",
            accounts.map((acc) => ({
              id: acc.id,
              externalId: acc.id,
              name: acc.name,
              industry: acc.industry,
              location: `${acc.billingCity}, ${acc.billingCountry}`,
              sourceSystem: "salesforce",
              externalId_sf: acc.id,
            })),
            "externalId_sf",
          );

          for (const supplier of recordsToCreate) {
            try {
              await this.payload.create({
                collection: "suppliers",
                data: {
                  organisation: organisationId,
                  name: String(supplier.name ?? "Unknown"),
                  contactEmail: "unknown@example.com",
                  category: "other",
                  country:
                    typeof supplier.location === "string" ? supplier.location : undefined,
                },
                overrideAccess: true,
              });
              createdCount += 1;
            } catch (err) {
              errors.push({
                message: `Failed to create supplier ${String(supplier.name)}: ${String(err)}`,
                recordId: supplier.externalId,
              });
              failed += 1;
            }
          }

          processed += accounts.length;
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          failed += 1;
          errors.push({ message: `Account sync failed: ${errorMsg}` });

          if (err instanceof OAuthErrorException && err.type === "token_revoked") {
            await this.payload.update({
              collection: "salesforce-connections",
              id: connectionId,
              data: { status: "revoked", lastSyncStatus: errorMsg },
              overrideAccess: true,
            });
            return {
              status: "failed",
              recordsProcessed: processed,
              recordsFailed: failed,
              errors,
              details: { reason: "connection_revoked" },
              syncDurationMs: Date.now() - startTime,
            };
          }
        }
      }

      if (config?.enableContactSync) {
        try {
          const contacts = await this.fetchContacts(accessToken);
          processed += contacts.length;
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          failed += 1;
          errors.push({ message: `Contact sync failed: ${errorMsg}` });

          if (err instanceof OAuthErrorException && err.type === "token_revoked") {
            await this.payload.update({
              collection: "salesforce-connections",
              id: connectionId,
              data: { status: "revoked", lastSyncStatus: errorMsg },
              overrideAccess: true,
            });
            return {
              status: "failed",
              recordsProcessed: processed,
              recordsFailed: failed,
              errors,
              details: { reason: "connection_revoked" },
              syncDurationMs: Date.now() - startTime,
            };
          }
        }
      }

      await this.payload.update({
        collection: "salesforce-connections",
        id: connectionId,
        data: {
          lastSyncAt: new Date().toISOString(),
          lastSyncStatus: errors.length === 0 ? "success" : "partial",
          syncErrorCount: errors.length,
        },
        overrideAccess: true,
      });

      return {
        status: errors.length === 0 ? "success" : failed > 0 ? "failed" : "partial",
        recordsProcessed: processed,
        recordsFailed: failed,
        errors,
        details: {
          accountsSynced: config?.enableAccountSync ? processed : 0,
          contactsSynced: config?.enableContactSync ? processed : 0,
          suppliersCreated: createdCount,
        },
        syncDurationMs: Date.now() - startTime,
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      errors.push({ message: errorMsg });
      return {
        status: "failed",
        recordsProcessed: processed,
        recordsFailed: failed + 1,
        errors,
        details: {},
        syncDurationMs: Date.now() - startTime,
      };
    }
  }
}
