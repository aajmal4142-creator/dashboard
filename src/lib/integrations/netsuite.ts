import type { Payload } from "payload";
import type { NetSuiteGLRecord, SyncResult, OAuthTokens } from "./types";

const NETSUITE_AUTH_URL = "https://system.netsuite.com/pages/customerlogin.jsp";
const NETSUITE_TOKEN_URL = "https://system.netsuite.com/services/rest/auth/oauth2/token";
const NETSUITE_API_URL = "https://tstdrv.suiteapis.com/services/rest/record/v1"; // Sandbox

export class NetSuiteService {
  constructor(
    private payload: Payload,
    private clientId: string,
    private clientSecret: string,
    private redirectUri: string,
  ) {}

  /**
   * Generate NetSuite OAuth authorization URL
   */
  getAuthUrl(connectionId: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: "code",
      scope: "rest_webservices",
      state: connectionId,
    });
    return `${NETSUITE_AUTH_URL}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(code: string): Promise<OAuthTokens> {
    const response = await fetch(NETSUITE_TOKEN_URL, {
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
      throw new Error(`NetSuite OAuth failed: ${response.statusText}`);
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

  /**
   * Refresh expired access token
   */
  async refreshAccessToken(refreshToken: string): Promise<OAuthTokens> {
    const response = await fetch(NETSUITE_TOKEN_URL, {
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
    };

    return {
      accessToken: data.access_token,
      refreshToken,
      expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    };
  }

  /**
   * Fetch General Ledger records from NetSuite
   */
  async fetchGLRecords(
    accountId: string,
    accessToken: string,
    periodId: string,
  ): Promise<NetSuiteGLRecord[]> {
    const response = await fetch(`${NETSUITE_API_URL}/generalledger?period=${periodId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch GL records: ${response.statusText}`);
    }

    const data = (await response.json()) as {
      items: Array<{
        account: { id: string };
        period: { id: string };
        balance: number;
        accountType: string;
      }>;
    };

    return data.items.map((item) => ({
      accountId: item.account.id,
      periodId: item.period.id,
      balance: item.balance,
      accountType: item.accountType,
    }));
  }

  /**
   * Calculate spend-based emissions from GL balances
   */
  calculateEmissionsFromGL(
    glRecords: NetSuiteGLRecord[],
    glCodeMapping: Record<string, string>,
  ): Array<{
    category: string;
    amount: number;
    estimatedEmissions: number;
  }> {
    const categorySpend: Record<string, number> = {};

    for (const record of glRecords) {
      const category = glCodeMapping[record.accountId];
      if (category) {
        categorySpend[category] = (categorySpend[category] || 0) + record.balance;
      }
    }

    // Simplified emissions factors (kg CO2e per £ spent)
    const emissionsFactors: Record<string, number> = {
      electricity: 0.45,
      gas: 0.21,
      water: 0.35,
      travel: 0.22,
      waste: 0.18,
      procurement: 0.15,
    };

    return Object.entries(categorySpend).map(([category, amount]) => ({
      category,
      amount,
      estimatedEmissions: amount * (emissionsFactors[category] || 0.1),
    }));
  }

  /**
   * Sync NetSuite GL data with ClearESG
   */
  async syncGLData(
    connectionId: string,
    organisationId: string,
    periodId: string,
  ): Promise<SyncResult> {
    const startTime = Date.now();
    const errors: Array<{ message: string; recordId?: string }> = [];
    let processed = 0;

    try {
      const connection = await this.payload.findByID({
        collection: "netsuite-connections",
        id: connectionId,
      });

      if (!connection?.accessToken) {
        throw new Error("NetSuite connection not properly configured");
      }

      let accessToken = connection.accessToken as string;

      if (connection.expiresAt && new Date(connection.expiresAt) < new Date()) {
        if (!connection.refreshToken) {
          throw new Error("Token expired and no refresh token available");
        }
        const tokens = await this.refreshAccessToken(connection.refreshToken as string);
        accessToken = tokens.accessToken;
        await this.payload.update({
          collection: "netsuite-connections",
          id: connectionId,
          data: {
            accessToken: tokens.accessToken,
            expiresAt: tokens.expiresAt,
          },
          overrideAccess: true,
        });
      }

      const glRecords = await this.fetchGLRecords(
        connection.accountId as string,
        accessToken,
        periodId,
      );
      processed = glRecords.length;

      const glCodeMapping = (connection.glCodeMapping as Record<string, string>) || {};
      const emissions = this.calculateEmissionsFromGL(glRecords, glCodeMapping);

      // Create datapoints for each category
      for (const emissionData of emissions) {
        try {
          await this.payload.create({
            collection: "datapoints",
            data: {
              organisation: organisationId,
              period: periodId,
              metricKey: `emissions.spend.netsuite.${emissionData.category}`,
              value: emissionData.estimatedEmissions,
              unit: "kgCO2e",
              quality: "estimated",
              provenance: "spend_estimate",
              source: "api",
              approvalState: "pending",
              note: `Synced from NetSuite GL: ${emissionData.amount} spent → ${emissionData.estimatedEmissions} kg CO2e`,
            },
            overrideAccess: true,
          });
        } catch (err) {
          errors.push({
            message: `Failed to create datapoint for ${emissionData.category}: ${String(err)}`,
            recordId: emissionData.category,
          });
        }
      }

      await this.payload.update({
        collection: "netsuite-connections",
        id: connectionId,
        data: {
          lastSyncAt: new Date().toISOString(),
          lastSyncStatus: errors.length === 0 ? "success" : "partial",
          syncErrorCount: errors.length,
        },
        overrideAccess: true,
      });

      return {
        status: errors.length === 0 ? "success" : "partial",
        recordsProcessed: processed,
        recordsFailed: errors.length,
        errors,
        details: {
          glRecordsSynced: processed,
          emissionsCalculated: emissions.length,
          categories: emissions.map((e) => ({
            category: e.category,
            spend: e.amount,
            emissions: e.estimatedEmissions,
          })),
        },
        syncDurationMs: Date.now() - startTime,
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      errors.push({ message: errorMsg });
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
}
