import type { SpendLedgerCategory } from "@/lib/calc/spendBasedEmissions";

export type AccountingProvider = "xero" | "quickbooks" | "wave";

export type AccountingConnectionMode = "live" | "sandbox";

export type GhgScope = "1" | "2" | "3";

/** One chart-of-accounts line discovered from the provider. */
export type DiscoveredAccount = {
  code: string;
  name: string;
  providerAccountId?: string;
};

/**
 * Maps a provider account code/name → spend ledger category + GHG scope.
 * Unmatched codes resolve to category "other" (Scope 3) via resolveAccountMapping.
 */
export type CategoryMappingEntry = {
  category: SpendLedgerCategory | "other";
  scope: GhgScope;
  /** Optional human label for the wizard. */
  label?: string;
};

export type CategoryMapping = Record<string, CategoryMappingEntry>;

export type AccountingSpendLine = {
  accountCode: string;
  accountName: string;
  amount: number;
  currency: string;
  txnDate: string;
  externalId: string;
  description?: string;
};

export type ProviderFetchResult = {
  companyName: string | null;
  accounts: DiscoveredAccount[];
  spendLines: AccountingSpendLine[];
};

export type ProviderCredentials = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

export type EncryptedTokenBundle = {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
};
