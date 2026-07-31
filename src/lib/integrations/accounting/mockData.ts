import type { AccountingProvider, AccountingSpendLine, DiscoveredAccount } from "./types";

/** Deterministic sandbox chart of accounts shared by all providers. */
export const SANDBOX_ACCOUNTS: DiscoveredAccount[] = [
  { code: "6110", name: "Fuel", providerAccountId: "acc-fuel" },
  { code: "6100", name: "Electricity", providerAccountId: "acc-electricity" },
  { code: "6200", name: "Travel", providerAccountId: "acc-travel" },
  {
    code: "6300",
    name: "Professional Services",
    providerAccountId: "acc-services",
  },
  { code: "6500", name: "Software Subscriptions", providerAccountId: "acc-it" },
  { code: "6600", name: "Waste Disposal", providerAccountId: "acc-waste" },
  { code: "9999", name: "Miscellaneous Expense", providerAccountId: "acc-misc" },
];

export function sandboxCompanyName(provider: AccountingProvider): string {
  const labels: Record<AccountingProvider, string> = {
    xero: "ClearESG Xero Sandbox",
    quickbooks: "ClearESG QuickBooks Sandbox",
    wave: "ClearESG Wave Sandbox",
  };
  return labels[provider];
}

export function sandboxSpendLines(
  provider: AccountingProvider,
  periodStart: Date,
  periodEnd: Date,
): AccountingSpendLine[] {
  const mid = new Date((periodStart.getTime() + periodEnd.getTime()) / 2)
    .toISOString()
    .slice(0, 10);

  const base: AccountingSpendLine[] = [
    {
      accountCode: "6110",
      accountName: "Fuel",
      amount: 1250.5,
      currency: "USD",
      txnDate: mid,
      externalId: `${provider}-fuel-1`,
      description: "Fleet diesel",
    },
    {
      accountCode: "6100",
      accountName: "Electricity",
      amount: 3400,
      currency: "USD",
      txnDate: mid,
      externalId: `${provider}-elec-1`,
      description: "Office electricity",
    },
    {
      accountCode: "6200",
      accountName: "Travel",
      amount: 890.25,
      currency: "USD",
      txnDate: mid,
      externalId: `${provider}-travel-1`,
      description: "Client travel",
    },
    {
      accountCode: "6300",
      accountName: "Professional Services",
      amount: 4500,
      currency: "USD",
      txnDate: mid,
      externalId: `${provider}-svc-1`,
      description: "Consulting fees",
    },
    {
      accountCode: "6500",
      accountName: "Software Subscriptions",
      amount: 612,
      currency: "USD",
      txnDate: mid,
      externalId: `${provider}-it-1`,
      description: "SaaS stack",
    },
    {
      accountCode: "9999",
      accountName: "Miscellaneous Expense",
      amount: 175,
      currency: "USD",
      txnDate: mid,
      externalId: `${provider}-misc-1`,
      description: "Uncategorised spend",
    },
  ];

  return base;
}

export const SANDBOX_ACCESS_TOKEN = "sandbox-access-token";
export const SANDBOX_REFRESH_TOKEN = "sandbox-refresh-token";

export function isSandboxToken(token: string): boolean {
  return token === SANDBOX_ACCESS_TOKEN || token.startsWith("sandbox-");
}
