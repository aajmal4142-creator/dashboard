export type IntegrationProvider = "salesforce" | "netsuite" | "xero" | "quickbooks";

export type IntegrationConnectionStatus = "pending" | "connected" | "failed" | "expired";

export type OAuthTokens = {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
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
  event: "account_created" | "contact_updated" | "invoice_synced" | "gl_updated";
  data: Record<string, unknown>;
  timestamp: string;
};
