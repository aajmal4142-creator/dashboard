export type IntegrationProvider =
  | "salesforce"
  | "netsuite"
  | "xero"
  | "quickbooks"
  | "sap"
  | "snowflake"
  | "bigquery"
  | "databricks"
  | "powerbi"
  | "tableau";

export type IntegrationConnectionStatus =
  "pending" | "connected" | "failed" | "expired" | "revoked";

export type OAuthTokens = {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
};

export type OAuthErrorType =
  | "invalid_grant"
  | "token_revoked"
  | "token_expired"
  | "network_error"
  | "invalid_scope"
  | "server_error"
  | "rate_limit";

export type OAuthError = {
  type: OAuthErrorType;
  message: string;
  statusCode?: number;
  retryable: boolean;
};

export type SyncResult = {
  status: "success" | "partial" | "failed";
  recordsProcessed: number;
  recordsFailed: number;
  errors: Array<{ message: string; recordId?: string }>;
  details: Record<string, unknown>;
  syncDurationMs: number;
};

export type SalesforceAccount = {
  id: string;
  name: string;
  industry?: string;
  billingCity?: string;
  billingCountry?: string;
};

export type SalesforceContact = {
  id: string;
  accountId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  title?: string;
};

export type NetSuiteGLRecord = {
  accountId: string;
  periodId: string;
  balance: number;
  accountType: string;
};

export type XeroInvoice = {
  invoiceID: string;
  contactID: string;
  lineItems: Array<{
    description: string;
    quantity: number;
    unitAmount: number;
    accountCode: string;
  }>;
  total: number;
  date: string;
};

export type QuickBooksExpense = {
  id: string;
  vendorRef: { value: string };
  accountRef: { value: string };
  amount: number;
  txnDate: string;
  docNumber?: string;
};

export type DataMappingConfig = {
  sourceName: string;
  sourceFields: string[];
  targetCollection: string;
  targetFields: string[];
  transformations?: Record<string, (value: unknown) => unknown>;
};

export type SyncWebhookPayload = {
  integrationId: string;
  provider: IntegrationProvider;
  event:
    | "account_created"
    | "contact_updated"
    | "invoice_synced"
    | "gl_updated"
    | "data_exported"
    | "webhook_triggered";
  data: Record<string, unknown>;
  timestamp: string;
};

// SAP S/4HANA types
export type SAPGLPosting = {
  company: string;
  fiscalYear: number;
  period: number;
  account: string;
  costCenter: string;
  amount: number;
  currency: string;
  documentDate: string;
};

export type SAPBOM = {
  materialId: string;
  materialDescription: string;
  bomVersion: string;
  components: Array<{
    componentId: string;
    quantity: number;
    unit: string;
  }>;
};

export type SAPProductionData = {
  orderId: string;
  materialId: string;
  quantity: number;
  unit: string;
  duration: number;
  startDate: string;
  completionDate: string;
  status: "planning" | "running" | "completed" | "closed";
};

// Data Warehouse types
export type DataWarehouseProvider = "snowflake" | "bigquery" | "databricks";

export type SnowflakeConfig = {
  account: string;
  warehouse: string;
  database: string;
  schema: string;
  role: string;
  username: string;
  password?: string;
  privateKey?: string;
};

export type BigQueryConfig = {
  projectId: string;
  datasetId: string;
  credentials: {
    type: string;
    project_id: string;
    private_key_id: string;
    private_key: string;
    client_email: string;
    client_id: string;
    auth_uri: string;
    token_uri: string;
  };
};

export type DatabricksConfig = {
  instanceUrl: string;
  token: string;
  warehouseId: string;
  catalogName?: string;
  schemaName: string;
};

export type DataWarehouseExportConfig = {
  frequency: "manual" | "hourly" | "daily" | "weekly" | "monthly";
  tablePrefix: string;
  incremental: boolean;
  lastExportTime?: string;
  transformations?: Record<string, unknown>;
};

// Webhook types
export type WebhookEvent =
  | "data.updated"
  | "data.created"
  | "data.deleted"
  | "alert.triggered"
  | "sync.completed"
  | "report.generated"
  | "export.completed";

export type WebhookConfig = {
  url: string;
  events: WebhookEvent[];
  active: boolean;
  retryPolicy: {
    maxRetries: number;
    retryDelayMs: number;
    exponentialBackoff: boolean;
  };
  headers?: Record<string, string>;
  authentication?: {
    type: "bearer" | "apikey" | "basic";
    value?: string;
    apiKeyHeader?: string;
    username?: string;
    password?: string;
  };
};

export type WebhookTemplate = {
  name: string;
  provider: "zapier" | "make" | "custom";
  events: WebhookEvent[];
  mapping: Record<string, string>;
  description?: string;
};

// Power BI / Tableau types
export type BiConnectorType = "powerbi" | "tableau";

export type PowerBIConfig = {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  workspaceId: string;
  reportId: string;
  datasetRefreshSchedule?: {
    time: string;
    days: string[];
  };
};

export type TableauConfig = {
  serverUrl: string;
  siteId: string;
  accessToken: string;
  userId: string;
  contentUrl: string;
  rowLevelSecurity?: {
    enabled: boolean;
    column: string;
    mapping: Record<string, string[]>;
  };
};

export type BiDatasetMapping = {
  sourceTable: string;
  sourceFields: string[];
  targetDataset: string;
  targetFields: string[];
  refreshSchedule: "manual" | "hourly" | "daily" | "weekly";
};
