import type { Payload } from "payload";
import type {
  DataWarehouseProvider,
  SnowflakeConfig,
  BigQueryConfig,
  DatabricksConfig,
  DataWarehouseExportConfig,
  SyncResult,
} from "./types";

/**
 * Abstract base for data warehouse connectors
 */
abstract class DataWarehouseConnector {
  abstract testConnection(): Promise<boolean>;
  abstract exportDatasets(tables: string[]): Promise<Record<string, unknown>[]>;
  abstract createOrUpdateTable(
    tableName: string,
    schema: Record<string, string>,
    data: Record<string, unknown>[],
  ): Promise<void>;
}

/**
 * Snowflake connector using JDBC-style REST API
 */
export class SnowflakeConnector extends DataWarehouseConnector {
  private config: SnowflakeConfig;

  constructor(config: SnowflakeConfig) {
    super();
    this.config = config;
  }

  private getBaseUrl(): string {
    return `https://${this.config.account}.snowflakecomputing.com`;
  }

  private async getAccessToken(): Promise<string> {
    const response = await fetch(`${this.getBaseUrl()}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "password",
        username: this.config.username,
        password: this.config.password || "",
        client_id: this.config.warehouse,
      }).toString(),
    });

    if (!response.ok) {
      throw new Error(`Failed to authenticate with Snowflake: ${response.statusText}`);
    }

    const data = (await response.json()) as { access_token: string };
    return data.access_token;
  }

  async testConnection(): Promise<boolean> {
    try {
      const token = await this.getAccessToken();
      const response = await fetch(`${this.getBaseUrl()}/api/v2/statements`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          statement: "SELECT 1",
          database: this.config.database,
          schema: this.config.schema,
          warehouse: this.config.warehouse,
        }),
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  async exportDatasets(tables: string[]): Promise<Record<string, unknown>[]> {
    const token = await this.getAccessToken();
    const results: Record<string, unknown>[] = [];

    for (const table of tables) {
      const response = await fetch(`${this.getBaseUrl()}/api/v2/statements`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          statement: `SELECT * FROM ${this.config.schema}.${table} LIMIT 10000`,
          database: this.config.database,
          schema: this.config.schema,
          warehouse: this.config.warehouse,
        }),
      });

      if (response.ok) {
        const data = (await response.json()) as { data: Record<string, unknown>[] };
        results.push(...data.data);
      }
    }

    return results;
  }

  async createOrUpdateTable(
    tableName: string,
    schema: Record<string, string>,
    data: Record<string, unknown>[],
  ): Promise<void> {
    const token = await this.getAccessToken();

    const schemaDefinition = Object.entries(schema)
      .map(([col, type]) => `${col} ${type}`)
      .join(", ");

    const createStatement = `
      CREATE OR REPLACE TABLE ${this.config.schema}.${tableName} (
        ${schemaDefinition}
      )
    `;

    await fetch(`${this.getBaseUrl()}/api/v2/statements`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        statement: createStatement,
        database: this.config.database,
        schema: this.config.schema,
        warehouse: this.config.warehouse,
      }),
    });

    // Insert data in batches
    const batchSize = 1000;
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      const values = batch
        .map(
          (row) =>
            `(${Object.values(row)
              .map((v) => `'${v}'`)
              .join(", ")})`,
        )
        .join(", ");

      const insertStatement = `INSERT INTO ${this.config.schema}.${tableName} VALUES ${values}`;

      await fetch(`${this.getBaseUrl()}/api/v2/statements`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          statement: insertStatement,
          database: this.config.database,
          schema: this.config.schema,
          warehouse: this.config.warehouse,
        }),
      });
    }
  }
}

/**
 * BigQuery connector using Google Cloud APIs
 */
export class BigQueryConnector extends DataWarehouseConnector {
  private config: BigQueryConfig;
  private token?: string;

  constructor(config: BigQueryConfig) {
    super();
    this.config = config;
  }

  private async getAccessToken(): Promise<string> {
    if (this.token) return this.token;

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: this.config.credentials.type,
        project_id: this.config.credentials.project_id,
        private_key_id: this.config.credentials.private_key_id,
        private_key: this.config.credentials.private_key,
        client_email: this.config.credentials.client_email,
        client_id: this.config.credentials.client_id,
        auth_uri: this.config.credentials.auth_uri,
        token_uri: this.config.credentials.token_uri,
        auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to authenticate with BigQuery: ${response.statusText}`);
    }

    const data = (await response.json()) as { access_token: string };
    this.token = data.access_token;
    return this.token;
  }

  async testConnection(): Promise<boolean> {
    try {
      const token = await this.getAccessToken();
      const response = await fetch(
        `https://www.googleapis.com/bigquery/v2/projects/${this.config.projectId}/datasets/${this.config.datasetId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      return response.ok;
    } catch {
      return false;
    }
  }

  async exportDatasets(tables: string[]): Promise<Record<string, unknown>[]> {
    const token = await this.getAccessToken();
    const results: Record<string, unknown>[] = [];

    for (const table of tables) {
      const query = `SELECT * FROM \`${this.config.projectId}.${this.config.datasetId}.${table}\` LIMIT 10000`;

      const response = await fetch(
        "https://www.googleapis.com/bigquery/v2/projects/query",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query,
            projectId: this.config.projectId,
            useLegacySql: false,
          }),
        },
      );

      if (response.ok) {
        const data = (await response.json()) as { rows?: Array<{ f: unknown[] }> };
        if (data.rows) {
          results.push(
            ...data.rows.map((row) => ({
              data: row.f,
            })),
          );
        }
      }
    }

    return results;
  }

  async createOrUpdateTable(
    tableName: string,
    schema: Record<string, string>,
    data: Record<string, unknown>[],
  ): Promise<void> {
    const token = await this.getAccessToken();

    const fields = Object.entries(schema).map(([name, type]) => ({
      name,
      type,
      mode: "NULLABLE",
    }));

    await fetch(
      `https://www.googleapis.com/bigquery/v2/projects/${this.config.projectId}/datasets/${this.config.datasetId}/tables`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tableReference: {
            projectId: this.config.projectId,
            datasetId: this.config.datasetId,
            tableId: tableName,
          },
          schema: { fields },
        }),
      },
    );

    // Stream insert rows
    if (data.length > 0) {
      const rows = data.map((row) => ({
        json: row,
        insertId: Math.random().toString(36),
      }));

      await fetch(
        `https://www.googleapis.com/bigquery/v2/projects/${this.config.projectId}/datasets/${this.config.datasetId}/tables/${tableName}/insertAll`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ rows }),
        },
      );
    }
  }
}

/**
 * Databricks connector using Delta Lake and REST API
 */
export class DatabricksConnector extends DataWarehouseConnector {
  private config: DatabricksConfig;

  constructor(config: DatabricksConfig) {
    super();
    this.config = config;
  }

  private getApiUrl(): string {
    return `${this.config.instanceUrl}/api/2.1/sql`;
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.getApiUrl()}/warehouses`, {
        headers: {
          Authorization: `Bearer ${this.config.token}`,
          "Content-Type": "application/json",
        },
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  async exportDatasets(tables: string[]): Promise<Record<string, unknown>[]> {
    const results: Record<string, unknown>[] = [];

    for (const table of tables) {
      const response = await fetch(`${this.getApiUrl()}/execute`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          warehouse_id: this.config.warehouseId,
          statement: `SELECT * FROM ${this.config.schemaName}.${table} LIMIT 10000`,
        }),
      });

      if (response.ok) {
        const data = (await response.json()) as { result?: { data_array?: unknown[][] } };
        if (data.result?.data_array) {
          results.push(
            ...data.result.data_array.map((row) => ({
              data: row,
            })),
          );
        }
      }
    }

    return results;
  }

  async createOrUpdateTable(
    tableName: string,
    schema: Record<string, string>,
    data: Record<string, unknown>[],
  ): Promise<void> {
    const schemaDefinition = Object.entries(schema)
      .map(([col, type]) => `${col} ${type}`)
      .join(", ");

    const createStatement = `
      CREATE OR REPLACE TABLE ${this.config.schemaName}.${tableName} (
        ${schemaDefinition}
      )
      USING DELTA
    `;

    await fetch(`${this.getApiUrl()}/execute`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        warehouse_id: this.config.warehouseId,
        statement: createStatement,
      }),
    });

    // Insert data
    if (data.length > 0) {
      const columns = Object.keys(data[0]).join(", ");
      const values = data
        .map(
          (row) =>
            `(${Object.values(row)
              .map((v) => `'${v}'`)
              .join(", ")})`,
        )
        .join(", ");

      const insertStatement = `INSERT INTO ${this.config.schemaName}.${tableName} (${columns}) VALUES ${values}`;

      await fetch(`${this.getApiUrl()}/execute`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          warehouse_id: this.config.warehouseId,
          statement: insertStatement,
        }),
      });
    }
  }
}

/**
 * Data warehouse service factory and manager
 */
export class DataWarehouseService {
  constructor(private payload: Payload) {}

  createConnector(
    provider: DataWarehouseProvider,
    config: SnowflakeConfig | BigQueryConfig | DatabricksConfig,
  ): DataWarehouseConnector {
    switch (provider) {
      case "snowflake":
        return new SnowflakeConnector(config as SnowflakeConfig);
      case "bigquery":
        return new BigQueryConnector(config as BigQueryConfig);
      case "databricks":
        return new DatabricksConnector(config as DatabricksConfig);
      default:
        throw new Error(`Unsupported data warehouse provider: ${provider}`);
    }
  }

  /**
   * Export ClearESG data to data warehouse
   */
  async exportToDataWarehouse(
    connectionId: string,
    organisationId: string,
    exportConfig: DataWarehouseExportConfig,
  ): Promise<SyncResult> {
    const startTime = Date.now();
    const errors: Array<{ message: string; recordId?: string }> = [];
    let processed = 0;

    try {
      const connection = await this.payload.findByID({
        collection: "datawarehouse-connections",
        id: connectionId,
      });

      if (!connection?.provider || !connection?.config) {
        throw new Error("Data warehouse connection not properly configured");
      }

      const provider = connection.provider as DataWarehouseProvider;
      const config = connection.config as
        SnowflakeConfig | BigQueryConfig | DatabricksConfig;

      const connector = this.createConnector(provider, config);

      // Test connection
      const connected = await connector.testConnection();
      if (!connected) {
        throw new Error("Failed to connect to data warehouse");
      }

      // Fetch data from ClearESG
      const datapoints = await this.payload.find({
        collection: "datapoints",
        where: {
          organisation: {
            equals: organisationId,
          },
        },
        limit: 10000,
      });

      processed = datapoints.docs.length;

      // Transform and export data
      const tableName = `${exportConfig.tablePrefix}_datapoints`;
      const schema: Record<string, string> = {
        id: "STRING",
        metricKey: "STRING",
        value: "FLOAT64",
        unit: "STRING",
        quality: "STRING",
        provenance: "STRING",
        source: "STRING",
        approvalState: "STRING",
        createdAt: "TIMESTAMP",
      };

      const exportData = datapoints.docs.map((dp) => ({
        id: dp.id,
        metricKey: dp.metricKey,
        value: dp.value,
        unit: dp.unit,
        quality: dp.quality,
        provenance: dp.provenance,
        source: dp.source,
        approvalState: dp.approvalState,
        createdAt: dp.createdAt,
      }));

      await connector.createOrUpdateTable(tableName, schema, exportData);

      // Update connection metadata
      await this.payload.update({
        collection: "datawarehouse-connections",
        id: connectionId,
        data: {
          lastExportAt: new Date().toISOString(),
          lastExportStatus: "success",
          lastExportRecords: processed,
        },
        overrideAccess: true,
      });

      return {
        status: "success",
        recordsProcessed: processed,
        recordsFailed: errors.length,
        errors,
        details: {
          provider,
          tableName,
          recordsExported: processed,
          exportFrequency: exportConfig.frequency,
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
