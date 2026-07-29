import type { Payload } from "payload";
import type { XeroInvoice, QuickBooksExpense, SyncResult, OAuthTokens } from "./types";

const XERO_AUTH_URL = "https://login.xero.com/identity/connect/authorize";
const XERO_TOKEN_URL = "https://identity.xero.com/connect/token";
const XERO_API_URL = "https://api.xero.com/api.xro/2.0";

const QB_AUTH_URL = "https://appcenter.intuit.com/connect/oauth2";
const QB_TOKEN_URL = "https://quickbooks.api.intuit.com/oauth2/tokens/oauth";
const QB_API_URL = "https://quickbooks.api.intuit.com/v2/company";

export type AccountingProvider = "xero" | "quickbooks";

export class AccountingService {
  constructor(
    private payload: Payload,
    private provider: AccountingProvider,
    private clientId: string,
    private clientSecret: string,
    private redirectUri: string,
  ) {}

  /**
   * Generate OAuth authorization URL
   */
  getAuthUrl(connectionId: string): string {
    if (this.provider === "xero") {
      const params = new URLSearchParams({
        client_id: this.clientId,
        redirect_uri: this.redirectUri,
        response_type: "code",
        scope: "accounting email profile",
        state: connectionId,
      });
      return `${XERO_AUTH_URL}?${params.toString()}`;
    } else {
      const params = new URLSearchParams({
        client_id: this.clientId,
        redirect_uri: this.redirectUri,
        response_type: "code",
        scope: "com.intuit.quickbooks.accounting",
        state: connectionId,
      });
      return `${QB_AUTH_URL}?${params.toString()}`;
    }
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(code: string, _realmId?: string): Promise<OAuthTokens> {
    let tokenUrl: string;
    const body: Record<string, string> = {
      grant_type: "authorization_code",
      code,
      client_id: this.clientId,
      client_secret: this.clientSecret,
      redirect_uri: this.redirectUri,
    };

    if (this.provider === "xero") {
      tokenUrl = XERO_TOKEN_URL;
    } else {
      tokenUrl = QB_TOKEN_URL;
    }

    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(body).toString(),
    });

    if (!response.ok) {
      throw new Error(`${this.provider} OAuth failed: ${response.statusText}`);
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
    const tokenUrl = this.provider === "xero" ? XERO_TOKEN_URL : QB_TOKEN_URL;

    const body: Record<string, string> = {
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: this.clientId,
      client_secret: this.clientSecret,
    };

    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(body).toString(),
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
   * Fetch Xero invoices
   */
  private async fetchXeroInvoices(accessToken: string): Promise<XeroInvoice[]> {
    const response = await fetch(`${XERO_API_URL}/Invoices?where=Status=="AUTHORISED"`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Xero-tenant-id": accessToken,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch Xero invoices: ${response.statusText}`);
    }

    const data = (await response.json()) as {
      Invoices: Array<{
        InvoiceID: string;
        ContactID: string;
        LineItems: Array<{
          Description: string;
          Quantity: number;
          UnitAmount: number;
          AccountCode: string;
        }>;
        Total: number;
        InvoiceDate: string;
      }>;
    };

    return data.Invoices.map((inv) => ({
      invoiceID: inv.InvoiceID,
      contactID: inv.ContactID,
      lineItems: inv.LineItems.map((li) => ({
        description: li.Description,
        quantity: li.Quantity,
        unitAmount: li.UnitAmount,
        accountCode: li.AccountCode,
      })),
      total: inv.Total,
      date: inv.InvoiceDate,
    }));
  }

  /**
   * Fetch QuickBooks expenses
   */
  private async fetchQBExpenses(
    accessToken: string,
    realmId: string,
  ): Promise<QuickBooksExpense[]> {
    const response = await fetch(
      `${QB_API_URL}/${realmId}/query?query=select * from Expense`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch QB expenses: ${response.statusText}`);
    }

    const data = (await response.json()) as {
      QueryResponse: {
        Expense: Array<{
          Id: string;
          VendorRef: { value: string };
          AccountRef: { value: string };
          TxnAmount: number;
          TxnDate: string;
          DocNumber?: string;
        }>;
      };
    };

    return (data.QueryResponse?.Expense || []).map((exp) => ({
      id: exp.Id,
      vendorRef: { value: exp.VendorRef.value },
      accountRef: { value: exp.AccountRef.value },
      amount: exp.TxnAmount,
      txnDate: exp.TxnDate,
      docNumber: exp.DocNumber,
    }));
  }

  /**
   * Sync expense data with ClearESG
   */
  async syncExpenses(
    connectionId: string,
    organisationId: string,
    periodId: string,
  ): Promise<SyncResult> {
    const startTime = Date.now();
    const errors: Array<{ message: string; recordId?: string }> = [];
    let processed = 0;

    try {
      const connection = await this.payload.findByID({
        collection: "accounting-connections",
        id: connectionId,
      });

      if (!connection?.accessToken) {
        throw new Error("Accounting connection not properly configured");
      }

      let accessToken = connection.accessToken as string;

      if (connection.expiresAt && new Date(connection.expiresAt) < new Date()) {
        if (!connection.refreshToken) {
          throw new Error("Token expired and no refresh token available");
        }
        const tokens = await this.refreshAccessToken(connection.refreshToken as string);
        accessToken = tokens.accessToken;
        await this.payload.update({
          collection: "accounting-connections",
          id: connectionId,
          data: {
            accessToken: tokens.accessToken,
            expiresAt: tokens.expiresAt,
          },
          overrideAccess: true,
        });
      }

      const categoryMapping =
        (connection.expenseCategoryMapping as Record<string, string>) || {};
      const expensesByCategory: Record<string, number> = {};

      if (this.provider === "xero") {
        try {
          const invoices = await this.fetchXeroInvoices(accessToken);
          processed = invoices.length;

          for (const invoice of invoices) {
            for (const lineItem of invoice.lineItems) {
              const category = categoryMapping[lineItem.accountCode] || "other";
              const amount = lineItem.quantity * lineItem.unitAmount;
              expensesByCategory[category] = (expensesByCategory[category] || 0) + amount;
            }
          }
        } catch (err) {
          errors.push({
            message: `Xero fetch failed: ${String(err)}`,
          });
        }
      } else if (this.provider === "quickbooks") {
        try {
          const expenses = await this.fetchQBExpenses(
            accessToken,
            connection.providerId as string,
          );
          processed = expenses.length;

          for (const expense of expenses) {
            const category = categoryMapping[expense.accountRef.value] || "other";
            expensesByCategory[category] =
              (expensesByCategory[category] || 0) + expense.amount;
          }
        } catch (err) {
          errors.push({
            message: `QB fetch failed: ${String(err)}`,
          });
        }
      }

      // Calculate emissions from expenses using spend-based factors
      const emissionsFactors: Record<string, number> = {
        travel: 0.22,
        utilities: 0.45,
        office: 0.12,
        it: 0.08,
        other: 0.1,
      };

      for (const [category, amount] of Object.entries(expensesByCategory)) {
        try {
          const emissions = amount * (emissionsFactors[category] || 0.1);
          await this.payload.create({
            collection: "datapoints",
            data: {
              organisation: organisationId,
              period: periodId,
              metricKey: `emissions.spend.${this.provider}.${category}`,
              value: emissions,
              unit: "kgCO2e",
              quality: "estimated",
              provenance: "spend_estimate",
              source: "api",
              approvalState: "pending",
              note: `Synced from ${this.provider}: ${amount} spent → ${emissions} kg CO2e`,
            },
            overrideAccess: true,
          });
        } catch (err) {
          errors.push({
            message: `Failed to create datapoint for ${category}: ${String(err)}`,
            recordId: category,
          });
        }
      }

      await this.payload.update({
        collection: "accounting-connections",
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
          expensesSynced: processed,
          categoriesProcessed: Object.keys(expensesByCategory).length,
          categoryBreakdown: expensesByCategory,
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
