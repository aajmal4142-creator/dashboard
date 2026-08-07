/**
 * Consultant multi-client billing rollup — per-client seats/usage meters for
 * consultancy organisations (F/Y03 beachhead).
 *
 * `summariseClientsUsage` is pure aggregation over already-loaded rows.
 * `loadClientsUsageRollup` does the Payload I/O (children, subscriptions,
 * memberships, usage meters) and stays a thin loader around it.
 */
import type { Payload } from "payload";

import {
  getUsageMeters,
  normalizePlan,
  PLAN_LIMITS,
  type PlanId,
  type UsageMeters,
} from "@/lib/billing";

export type ClientUsageRow = {
  id: string;
  name: string;
  slug: string;
  plan: PlanId;
  subscriptionStatus: string;
  subscriptionId: string | null;
  billingCycle: "monthly" | "annual" | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  /** Paid seats on the client's own subscription — null when no subscription exists. */
  seatsPaid: number | null;
  /** Active Memberships in the client org right now. Never coerced from seatsPaid. */
  membersActive: number;
  usage: UsageMeters;
};

export type ClientsUsageTotals = {
  clientCount: number;
  clientsWithSubscription: number;
  totalSeatsPaid: number;
  totalMembersActive: number;
  totalPeriodsUsed: number;
  totalSuppliersUsed: number;
};

export type ClientsUsageRollup = {
  consultancyId: string;
  consultancyName: string;
  generatedAt: string;
  clients: ClientUsageRow[];
  totals: ClientsUsageTotals;
};

export function summariseClientsUsage(clients: ClientUsageRow[]): ClientsUsageTotals {
  return clients.reduce<ClientsUsageTotals>(
    (acc, c) => ({
      clientCount: acc.clientCount + 1,
      clientsWithSubscription:
        acc.clientsWithSubscription + (c.seatsPaid !== null ? 1 : 0),
      totalSeatsPaid: acc.totalSeatsPaid + (c.seatsPaid ?? 0),
      totalMembersActive: acc.totalMembersActive + c.membersActive,
      totalPeriodsUsed: acc.totalPeriodsUsed + c.usage.periods.used,
      totalSuppliersUsed: acc.totalSuppliersUsed + c.usage.suppliers.used,
    }),
    {
      clientCount: 0,
      clientsWithSubscription: 0,
      totalSeatsPaid: 0,
      totalMembersActive: 0,
      totalPeriodsUsed: 0,
      totalSuppliersUsed: 0,
    },
  );
}

function isoOrNull(value: unknown): string | null {
  if (!value) return null;
  return String(value);
}

/**
 * Loads the per-client seats/usage rollup for a consultancy organisation.
 * Children are resolved via `organisations.parentOrg` — the same one-level
 * consultancy relation used by Command Centre and `accessibleOrgIds`.
 */
export async function loadClientsUsageRollup(
  payload: Payload,
  consultancyOrgId: string,
  consultancyName: string,
): Promise<ClientsUsageRollup> {
  const children = await payload.find({
    collection: "organisations",
    where: { parentOrg: { equals: consultancyOrgId } },
    depth: 0,
    limit: 200,
    sort: "name",
    overrideAccess: true,
  });

  const clients: ClientUsageRow[] = [];
  for (const child of children.docs) {
    const [subs, memberships, usage] = await Promise.all([
      payload.find({
        collection: "subscriptions",
        where: { organisation: { equals: child.id } },
        depth: 0,
        limit: 1,
        overrideAccess: true,
      }),
      payload.find({
        collection: "memberships",
        where: {
          and: [{ organisation: { equals: child.id } }, { status: { equals: "active" } }],
        },
        depth: 0,
        limit: 500,
        overrideAccess: true,
      }),
      getUsageMeters(child.id, child.plan),
    ]);

    const sub = subs.docs[0] ?? null;

    clients.push({
      id: child.id,
      name: child.name,
      slug: child.slug,
      plan: normalizePlan(child.plan),
      subscriptionStatus: child.subscriptionStatus ?? "none",
      subscriptionId: sub ? String(sub.id) : null,
      billingCycle: sub?.billingCycle ?? null,
      currentPeriodStart: isoOrNull(sub?.currentPeriodStart),
      currentPeriodEnd: isoOrNull(sub?.currentPeriodEnd),
      seatsPaid: sub ? sub.seats : null,
      membersActive: memberships.totalDocs,
      usage,
    });
  }

  return {
    consultancyId: consultancyOrgId,
    consultancyName,
    generatedAt: new Date().toISOString(),
    clients,
    totals: summariseClientsUsage(clients),
  };
}

/** Flat CSV export of the rollup — used when the consultancy has no invoice to generate. */
export function clientsUsageRollupToCsv(rollup: ClientsUsageRollup): string {
  const header = [
    "clientId",
    "clientName",
    "plan",
    "subscriptionStatus",
    "billingCycle",
    "seatsPaid",
    "membersActive",
    "periodsUsed",
    "suppliersUsed",
    "planListPriceEur",
  ];
  const rows = rollup.clients.map((c) => [
    c.id,
    c.name,
    c.plan,
    c.subscriptionStatus,
    c.billingCycle ?? "",
    c.seatsPaid === null ? "" : String(c.seatsPaid),
    String(c.membersActive),
    String(c.usage.periods.used),
    String(c.usage.suppliers.used),
    String(PLAN_LIMITS[c.plan].priceEur),
  ]);
  return [header, ...rows]
    .map((cols) => cols.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\n");
}

export type ClientInvoiceLineItem = {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
};

/**
 * Builds draft invoice line items from a client's rollup row. Pure — the
 * caller persists these via the existing Invoices collection. Seats are
 * priced at the plan's list price; missing seats (no subscription) is
 * rejected by the caller, never silently priced as zero.
 */
export function buildClientInvoiceLineItems(
  client: ClientUsageRow,
): ClientInvoiceLineItem[] {
  const seats = client.seatsPaid ?? 1;
  const unitPrice = PLAN_LIMITS[client.plan].priceEur;
  const items: ClientInvoiceLineItem[] = [
    {
      description: `${PLAN_LIMITS[client.plan].label} plan — ${client.name}`,
      quantity: seats,
      unitPrice,
      amount: Math.round(unitPrice * seats * 100) / 100,
    },
  ];
  return items;
}
