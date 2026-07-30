export type DatabaseEngine = "postgresql" | "mysql" | "bigquery";

export type SyncFrequency = "manual" | "hourly" | "daily" | "weekly";

export type SqlCredentials = {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl: boolean;
  /** Optional schema / search_path for discovery */
  schema?: string;
};

export type BigQueryCredentials = {
  projectId: string;
  datasetId: string;
  /** Full service-account JSON as a string */
  serviceAccountJson: string;
};

export type ConnectorCredentials = SqlCredentials | BigQueryCredentials;

export type DiscoveredColumn = {
  name: string;
  dataType: string;
  nullable: boolean;
};

export type DiscoveredTable = {
  schema: string;
  name: string;
  columns: DiscoveredColumn[];
};

export type DatapointTargetField =
  "metricKey" | "value" | "unit" | "quality" | "externalId" | "supplierId";

export type FieldMappingColumn = {
  source: string;
  target: DatapointTargetField;
};

export type FieldMappings = {
  columns: FieldMappingColumn[];
  defaults?: {
    metricKey?: string;
    quality?: "measured" | "calculated" | "estimated" | "missing";
    unit?: string;
  };
};

export type QueryRowsOptions = {
  schema?: string;
  table: string;
  columns: string[];
  incrementalColumn?: string;
  lastIncrementalValue?: string;
  limit?: number;
};

export type QueryRowsResult = {
  rows: Record<string, unknown>[];
  maxIncrementalValue?: string;
};

export type TestConnectionResult = {
  ok: boolean;
  message: string;
};

export type DatabaseConnector = {
  readonly engine: DatabaseEngine;
  testConnection(): Promise<TestConnectionResult>;
  listTables(schema?: string): Promise<DiscoveredTable[]>;
  queryRows(options: QueryRowsOptions): Promise<QueryRowsResult>;
  close(): Promise<void>;
};

export function isSqlCredentials(
  creds: ConnectorCredentials,
  engine: DatabaseEngine,
): creds is SqlCredentials {
  return engine === "postgresql" || engine === "mysql";
}

export function isBigQueryCredentials(
  creds: ConnectorCredentials,
  engine: DatabaseEngine,
): creds is BigQueryCredentials {
  return engine === "bigquery";
}

export function calculateNextSyncAt(
  frequency: SyncFrequency,
  from: Date = new Date(),
): Date | null {
  switch (frequency) {
    case "hourly":
      return new Date(from.getTime() + 60 * 60 * 1000);
    case "daily":
      return new Date(from.getTime() + 24 * 60 * 60 * 1000);
    case "weekly":
      return new Date(from.getTime() + 7 * 24 * 60 * 60 * 1000);
    case "manual":
    default:
      return null;
  }
}
