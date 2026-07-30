import type { CollectionSlug, Payload } from "payload";
import type {
  BiConnectorType,
  PowerBIConfig,
  TableauConfig,
  BiDatasetMapping,
  SyncResult,
  OAuthTokens,
} from "./types";

/**
 * Power BI connector
 */
export class PowerBIConnector {
  constructor(
    private payload: Payload,
    private config: PowerBIConfig,
  ) {}

  /**
   * Get Power BI OAuth authorization URL
   */
  getAuthUrl(redirectUri: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "Dataset.ReadWrite.All Workspace.ReadWrite.All",
      state: this.config.workspaceId,
    });
    return `https://login.microsoftonline.com/${this.config.tenantId}/oauth2/v2.0/authorize?${params.toString()}`;
  }

  async exchangeCodeForToken(code: string, redirectUri: string): Promise<OAuthTokens> {
    const response = await fetch(
      `https://login.microsoftonline.com/${this.config.tenantId}/oauth2/v2.0/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          redirect_uri: redirectUri,
          scope: "Dataset.ReadWrite.All Workspace.ReadWrite.All",
        }).toString(),
      },
    );

    if (!response.ok) {
      throw new Error(`Power BI OAuth failed: ${response.statusText}`);
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

  async refreshAccessToken(refreshToken: string): Promise<OAuthTokens> {
    const response = await fetch(
      `https://login.microsoftonline.com/${this.config.tenantId}/oauth2/v2.0/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: refreshToken,
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          scope: "Dataset.ReadWrite.All Workspace.ReadWrite.All",
        }).toString(),
      },
    );

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        const error = new Error("Token revoked or invalid") as Error & {
          type: "token_revoked";
        };
        error.type = "token_revoked";
        throw error;
      }
      throw new Error(`Power BI token refresh failed: ${response.statusText}`);
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

  /**
   * Push dataset to Power BI
   */
  async pushDataset(
    accessToken: string,
    datasetName: string,
    schema: Array<{ name: string; dataType: string }>,
    data: Record<string, unknown>[],
  ): Promise<string> {
    const response = await fetch(
      `https://api.powerbi.com/v1.0/myorg/datasets?datasetDisplayName=${datasetName}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: datasetName,
          tables: [
            {
              name: "Table1",
              columns: schema,
              rows: data,
            },
          ],
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to push dataset to Power BI: ${response.statusText}`);
    }

    const result = (await response.json()) as { id: string };
    return result.id;
  }

  /**
   * Refresh Power BI dataset
   */
  async refreshDataset(accessToken: string, datasetId: string): Promise<void> {
    const response = await fetch(
      `https://api.powerbi.com/v1.0/myorg/datasets/${datasetId}/refreshes`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to refresh Power BI dataset: ${response.statusText}`);
    }
  }

  /**
   * Add rows to Power BI dataset
   */
  async addRows(
    accessToken: string,
    datasetId: string,
    tableName: string,
    rows: Record<string, unknown>[],
  ): Promise<void> {
    const response = await fetch(
      `https://api.powerbi.com/v1.0/myorg/datasets/${datasetId}/tables/${tableName}/rows`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ rows }),
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to add rows to Power BI dataset: ${response.statusText}`);
    }
  }

  /**
   * Get report and dashboard embeds
   */
  async getReportEmbedUrl(accessToken: string, reportId: string): Promise<string> {
    const response = await fetch(
      `https://api.powerbi.com/v1.0/myorg/reports/${reportId}/GenerateToken`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          accessLevel: "View",
          lifetimeInMinutes: 60,
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to generate Power BI embed token: ${response.statusText}`);
    }

    const data = (await response.json()) as { token: string };
    return data.token;
  }
}

/**
 * Tableau connector using REST API
 */
export class TableauConnector {
  constructor(
    private payload: Payload,
    private config: TableauConfig,
  ) {}

  /**
   * Sign in to Tableau Server
   */
  async authenticate(): Promise<string> {
    const response = await fetch(`${this.config.serverUrl}/api/3.7/auth/signin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        credentials: {
          token: this.config.accessToken,
          site: {
            contentUrl: this.config.siteId,
          },
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Tableau authentication failed: ${response.statusText}`);
    }

    const data = (await response.json()) as {
      credentials: { token: string };
    };
    return data.credentials.token;
  }

  /**
   * Publish datasource to Tableau
   */
  async publishDatasource(
    sessionToken: string,
    datasourceName: string,
    data: Record<string, unknown>[],
  ): Promise<string> {
    const formData = new FormData();
    formData.append("datasource.tds", JSON.stringify(data));

    const response = await fetch(
      `${this.config.serverUrl}/api/3.7/sites/${this.config.siteId}/datasources?datasourceName=${datasourceName}`,
      {
        method: "POST",
        headers: {
          "X-Tableau-Auth": sessionToken,
        },
        body: formData,
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to publish Tableau datasource: ${response.statusText}`);
    }

    const result = (await response.json()) as {
      datasource: { id: string };
    };
    return result.datasource.id;
  }

  /**
   * Create workbook with RLS
   */
  async createWorkbookWithRLS(
    sessionToken: string,
    workbookName: string,
    datasourceId: string,
    rlsConfig: {
      enabled: boolean;
      column: string;
      mapping: Record<string, string[]>;
    },
  ): Promise<string> {
    const workbook = {
      name: workbookName,
      datasources: [{ id: datasourceId }],
      rowLevelSecurity: rlsConfig.enabled
        ? {
            column: rlsConfig.column,
            filters: Object.entries(rlsConfig.mapping).map(([user, values]) => ({
              user,
              values,
            })),
          }
        : null,
    };

    const response = await fetch(
      `${this.config.serverUrl}/api/3.7/sites/${this.config.siteId}/workbooks`,
      {
        method: "POST",
        headers: {
          "X-Tableau-Auth": sessionToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(workbook),
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to create Tableau workbook: ${response.statusText}`);
    }

    const result = (await response.json()) as {
      workbook: { id: string };
    };
    return result.workbook.id;
  }

  /**
   * Download report
   */
  async downloadReport(
    sessionToken: string,
    workbookId: string,
    viewName: string,
    format: "pdf" | "png" | "csv",
  ): Promise<Buffer> {
    const response = await fetch(
      `${this.config.serverUrl}/api/3.7/sites/${this.config.siteId}/workbooks/${workbookId}/views/${viewName}/${format}`,
      {
        method: "GET",
        headers: {
          "X-Tableau-Auth": sessionToken,
        },
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to download Tableau report: ${response.statusText}`);
    }

    return Buffer.from(await response.arrayBuffer());
  }
}

/**
 * BI service factory for managing Power BI and Tableau
 */
export class BIConnectorService {
  constructor(private payload: Payload) {}

  private biCollection(
    biType: BiConnectorType,
  ): "powerbi-connections" | "tableau-connections" {
    return biType === "powerbi" ? "powerbi-connections" : "tableau-connections";
  }

  private rowValue(row: object, field: string): unknown {
    return (row as Record<string, unknown>)[field];
  }

  /**
   * Sync data to BI platform
   */
  async syncToBI(
    connectionId: string,
    organisationId: string,
    biType: BiConnectorType,
    mappings: BiDatasetMapping[],
  ): Promise<SyncResult> {
    const startTime = Date.now();
    const errors: Array<{ message: string; recordId?: string }> = [];
    let processed = 0;
    const collection = this.biCollection(biType);

    try {
      const connection = await this.payload.findByID({
        collection,
        id: connectionId,
        overrideAccess: true,
      });

      if (!connection?.accessToken) {
        throw new Error(`${biType} connection not properly configured`);
      }

      if (biType === "powerbi") {
        const powerBiConfig = connection.config as PowerBIConfig;
        const connector = new PowerBIConnector(this.payload, powerBiConfig);

        for (const mapping of mappings) {
          try {
            const sourceData = await this.payload.find({
              collection: mapping.sourceTable as CollectionSlug,
              where: {
                organisation: {
                  equals: organisationId,
                },
              },
              limit: 10000,
              overrideAccess: true,
            });

            const transformedData = sourceData.docs.map((row) => {
              const transformed: Record<string, unknown> = {};
              for (let i = 0; i < mapping.sourceFields.length; i++) {
                const sourceField = mapping.sourceFields[i];
                const targetField = mapping.targetFields[i];
                transformed[targetField] = this.rowValue(row, sourceField);
              }
              return transformed;
            });

            const schema = mapping.targetFields.map((field) => ({
              name: field,
              dataType: "String",
            }));

            await connector.pushDataset(
              connection.accessToken,
              mapping.targetDataset,
              schema,
              transformedData,
            );

            processed += sourceData.docs.length;
          } catch (err) {
            errors.push({
              message: `Failed to sync ${mapping.sourceTable}: ${String(err)}`,
              recordId: mapping.sourceTable,
            });
          }
        }
      } else {
        const tableauConfig = connection.config as TableauConfig;
        const connector = new TableauConnector(this.payload, tableauConfig);

        try {
          const sessionToken = await connector.authenticate();

          for (const mapping of mappings) {
            try {
              const sourceData = await this.payload.find({
                collection: mapping.sourceTable as CollectionSlug,
                where: {
                  organisation: {
                    equals: organisationId,
                  },
                },
                limit: 10000,
                overrideAccess: true,
              });

              const transformedData = sourceData.docs.map((row) => {
                const transformed: Record<string, unknown> = {};
                for (let i = 0; i < mapping.sourceFields.length; i++) {
                  const sourceField = mapping.sourceFields[i];
                  const targetField = mapping.targetFields[i];
                  transformed[targetField] = this.rowValue(row, sourceField);
                }
                return transformed;
              });

              await connector.publishDatasource(
                sessionToken,
                mapping.targetDataset,
                transformedData,
              );

              processed += sourceData.docs.length;
            } catch (err) {
              errors.push({
                message: `Failed to sync ${mapping.sourceTable}: ${String(err)}`,
                recordId: mapping.sourceTable,
              });
            }
          }
        } catch (err) {
          errors.push({
            message: `Tableau authentication failed: ${String(err)}`,
          });
        }
      }

      await this.payload.update({
        collection,
        id: connectionId,
        data: {
          lastSyncAt: new Date().toISOString(),
          lastSyncStatus: errors.length === 0 ? "success" : "partial",
          lastSyncRecords: processed,
        },
        overrideAccess: true,
      });

      return {
        status: errors.length === 0 ? "success" : "partial",
        recordsProcessed: processed,
        recordsFailed: errors.length,
        errors,
        details: {
          biType,
          mappingsSynced: mappings.length,
          datasetsSynced: mappings.filter((m) =>
            errors.every((e) => e.recordId !== m.sourceTable),
          ).length,
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

  /**
   * Schedule automatic refreshes
   */
  async scheduleRefresh(
    connectionId: string,
    biType: BiConnectorType,
    schedule: { time: string; days: string[] },
  ): Promise<void> {
    await this.payload.update({
      collection: this.biCollection(biType),
      id: connectionId,
      data: {
        refreshSchedule: schedule,
      },
      overrideAccess: true,
    });
  }

  /**
   * Test BI connection
   */
  async testConnection(connectionId: string, biType: BiConnectorType): Promise<boolean> {
    try {
      const connection = await this.payload.findByID({
        collection: this.biCollection(biType),
        id: connectionId,
        overrideAccess: true,
      });

      if (!connection?.accessToken) {
        return false;
      }

      if (biType === "powerbi") {
        const powerBiConfig = connection.config as PowerBIConfig;
        const connector = new PowerBIConnector(this.payload, powerBiConfig);

        try {
          await connector.refreshDataset(connection.accessToken, "test");
          return true;
        } catch {
          return false;
        }
      }

      const tableauConfig = connection.config as TableauConfig;
      const connector = new TableauConnector(this.payload, tableauConfig);

      try {
        await connector.authenticate();
        return true;
      } catch {
        return false;
      }
    } catch {
      return false;
    }
  }
}
