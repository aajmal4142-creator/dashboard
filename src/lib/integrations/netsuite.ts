import type { Payload } from "payload";
import type { NetSuiteGLRecord, SyncResult } from "./types";
import {
  OAuthBase,
  OAuthErrorException,
  type OAuthConfig,
  type OAuthConnection,
} from "./oauth.base";
import { SyncUtils } from "./sync-utils";
import type { NetsuiteConnection } from "@/payload-types";

const NETSUITE_AUTH_URL = "https://system.netsuite.com/pages/customerlogin.jsp";
const NETSUITE_TOKEN_URL = "https://system.netsuite.com/services/rest/auth/oauth2/token";
const NETSUITE_API_URL = "https://tstdrv.suiteapis.com/services/rest/record/v1"; // Sandbox

export class NetSuiteService extends OAuthBase {
  constructor(
    payload: Payload,
    clientId: string,
    clientSecret: string,
    redirectUri: string,
  ) {
    const config: OAuthConfig = {
      authUrl: NETSUITE_AUTH_URL,
      tokenUrl: NETSUITE_TOKEN_URL,
      clientId,
      clientSecret,
      redirectUri,
      scope: "rest_webservices",
    };
    super(payload, config, "netsuite-connections");
  }

  async fetchGLRecords(
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

  async syncGLData(
    connectionId: string,
    organisationId: string,
    periodId: string,
  ): Promise<SyncResult> {
    const startTime = Date.now();
    const errors: Array<{ message: string; recordId?: string }> = [];
    let processed = 0;
    let failed = 0;
    let createdCount = 0;

    try {
      const connection = (await this.payload.findByID({
        collection: "netsuite-connections",
        id: connectionId,
      })) as NetsuiteConnection;

      if (!connection?.accessToken) {
        throw new Error("NetSuite connection not properly configured");
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
        if (err instanceof OAuthErrorException && err.type === "token_revoked") {
          return {
            status: "failed",
            recordsProcessed: processed,
            recordsFailed: 1,
            errors,
            details: { reason: "connection_revoked" },
            syncDurationMs: Date.now() - startTime,
          };
        }
        throw err;
      }

      const glRecords = await this.fetchGLRecords(accessToken, periodId);
      processed = glRecords.length;

      const glCodeMapping =
        connection.glCodeMapping &&
        typeof connection.glCodeMapping === "object" &&
        !Array.isArray(connection.glCodeMapping)
          ? (connection.glCodeMapping as Record<string, string>)
          : {};
      const emissions = this.calculateEmissionsFromGL(glRecords, glCodeMapping);

      for (const emissionData of emissions) {
        try {
          const estimatedEmissions = SyncUtils.calculateEmissions(
            emissionData.amount,
            emissionData.category,
          );

          await this.payload.create({
            collection: "datapoints",
            data: {
              organisation: organisationId,
              period: periodId,
              metricKey: `emissions.spend.netsuite.${emissionData.category}`,
              value: estimatedEmissions,
              unit: "kgCO2e",
              quality: "estimated",
              provenance: "spend_estimate",
              source: "api",
              approvalState: "pending",
              note: `Synced from NetSuite GL: £${emissionData.amount.toFixed(2)} spent in ${emissionData.category} → ${estimatedEmissions.toFixed(2)} kg CO2e`,
            },
            overrideAccess: true,
          });
          createdCount += 1;
        } catch (err) {
          errors.push({
            message: `Failed to create datapoint for ${emissionData.category}: ${String(err)}`,
            recordId: emissionData.category,
          });
          failed += 1;
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
        recordsFailed: failed,
        errors,
        details: {
          glRecordsSynced: processed,
          emissionsCalculated: emissions.length,
          datapointsCreated: createdCount,
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
