import type { Payload } from "payload";
import type {
  SalesforceAccount,
  SalesforceContact,
  SyncResult,
  OAuthTokens,
} from "./types";

const SALESFORCE_AUTH_URL = "https://login.salesforce.com/services/oauth2/authorize";
const SALESFORCE_TOKEN_URL = "https://login.salesforce.com/services/oauth2/token";

export class SalesforceService {
  constructor(
    private payload: Payload,
    private clientId: string,
    private clientSecret: string,
    private redirectUri: string,
  ) {}

  /**
   * Generate Salesforce OAuth authorization URL
   */
  getAuthUrl(connectionId: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: "code",
      scope: "api refresh_token",
      state: connectionId,
    });
    return `${SALESFORCE_AUTH_URL}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(code: string): Promise<OAuthTokens> {
    const response = await fetch(SALESFORCE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: this.redirectUri,
      }).toString(),
    });

    if (!response.ok) {
      throw new Error(`Salesforce OAuth failed: ${response.statusText}`);
    }

    const data = (await response.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
      instance_url: string;
    };

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    };
  }

  /**
   * Refresh expired access token
   */
  async refreshAccessToken(refreshToken: string): Promise<OAuthTokens> {
    const response = await fetch(SALESFORCE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: this.clientId,
        client_secret: this.clientSecret,
      }).toString(),
    });

    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.statusText}`);
    }

    const data = (await response.json()) as {
      access_token: string;
      expires_in: number;
      instance_url: string;
    };

    return {
      accessToken: data.access_token,
      refreshToken,
      expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    };
  }

  /**
   * Fetch Salesforce accounts
   */
  async fetchAccounts(
    instanceUrl: string,
    accessToken: string,
  ): Promise<SalesforceAccount[]> {
    const response = await fetch(
      `${instanceUrl}/services/data/v61.0/query?q=SELECT Id,Name,Industry,BillingCity,BillingCountry FROM Account`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    if (!response.ok) {
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

  /**
   * Fetch Salesforce contacts
   */
  async fetchContacts(
    instanceUrl: string,
    accessToken: string,
  ): Promise<SalesforceContact[]> {
    const response = await fetch(
      `${instanceUrl}/services/data/v61.0/query?q=SELECT Id,AccountId,FirstName,LastName,Email,Phone,Title FROM Contact WHERE Email != null`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    if (!response.ok) {
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

  /**
   * Write ESG metrics to Salesforce custom fields
   */
  async writeMetricsToAccounts(
    instanceUrl: string,
    accessToken: string,
    metrics: Array<{ accountId: string; emissions: number; intensity: number }>,
  ): Promise<void> {
    const updates = metrics.map((m) => ({
      Id: m.accountId,
      ESG_Emissions_tCO2e__c: m.emissions,
      ESG_Intensity__c: m.intensity,
    }));

    for (const update of updates) {
      await fetch(`${instanceUrl}/services/data/v61.0/sobjects/Account/${update.Id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(update),
      });
    }
  }

  /**
   * Sync Salesforce data with ClearESG
   */
  async syncData(connectionId: string, _organisationId: string): Promise<SyncResult> {
    const startTime = Date.now();
    const errors: Array<{ message: string; recordId?: string }> = [];
    let processed = 0;
    let failed = 0;

    try {
      const connection = await this.payload.findByID({
        collection: "salesforce-connections",
        id: connectionId,
      });

      if (!connection?.instanceUrl || !connection?.accessToken) {
        throw new Error("Salesforce connection not properly configured");
      }

      let accessToken = connection.accessToken as string;

      if (connection.expiresAt && new Date(connection.expiresAt) < new Date()) {
        if (!connection.refreshToken) {
          throw new Error("Token expired and no refresh token available");
        }
        const tokens = await this.refreshAccessToken(connection.refreshToken as string);
        accessToken = tokens.accessToken;
        await this.payload.update({
          collection: "salesforce-connections",
          id: connectionId,
          data: {
            accessToken: tokens.accessToken,
            expiresAt: tokens.expiresAt,
          },
          overrideAccess: true,
        });
      }

      const config = connection.syncConfig as
        | {
            enableAccountSync?: boolean | null;
            enableContactSync?: boolean | null;
            enableMetricsWrite?: boolean | null;
            syncFrequency?: string | null;
          }
        | null
        | undefined;

      if (config?.enableAccountSync) {
        try {
          const accounts = await this.fetchAccounts(
            connection.instanceUrl as string,
            accessToken,
          );
          processed += accounts.length;
        } catch (err) {
          failed += 1;
          errors.push({
            message: `Account sync failed: ${String(err)}`,
          });
        }
      }

      if (config?.enableContactSync) {
        try {
          const contacts = await this.fetchContacts(
            connection.instanceUrl as string,
            accessToken,
          );
          processed += contacts.length;
        } catch (err) {
          failed += 1;
          errors.push({
            message: `Contact sync failed: ${String(err)}`,
          });
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
