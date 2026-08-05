export type IntegrationProvider =
  "xero" | "quickbooks" | "wave" | "csv" | "webhook" | "manual";

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

// Webhook types
export type WebhookEvent =
  | "datapoint.created"
  | "datapoint.updated"
  | "report.generated"
  | "data.updated"
  | "data.created"
  | "data.deleted"
  | "alert.triggered"
  | "sync.completed"
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
