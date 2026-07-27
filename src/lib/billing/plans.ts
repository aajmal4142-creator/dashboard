export type PlanId = "free" | "pro" | "consultant";

export type Entitlement =
  | "unwatermarked_pdf"
  | "unlimited_periods"
  | "evidence_vault"
  | "white_label"
  | "bulk_actions"
  | "consultant_cc";

export type PlanLimits = {
  maxPeriods: number;
  maxSuppliers: number;
  maxClients: number;
  /** EUR monthly list price for display (EUR pricing — India/INR is an open decision). */
  priceEur: number;
  label: string;
};

export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  free: {
    maxPeriods: 1,
    maxSuppliers: 3,
    maxClients: 0,
    priceEur: 0,
    label: "Free",
  },
  pro: {
    maxPeriods: Number.POSITIVE_INFINITY,
    maxSuppliers: 10,
    maxClients: 0,
    priceEur: 49,
    label: "Pro",
  },
  consultant: {
    maxPeriods: Number.POSITIVE_INFINITY,
    maxSuppliers: 10,
    maxClients: 10,
    priceEur: 199,
    label: "Consultant",
  },
};

const ENTITLEMENTS: Record<PlanId, ReadonlySet<Entitlement>> = {
  free: new Set(),
  pro: new Set(["unwatermarked_pdf", "unlimited_periods", "evidence_vault"]),
  consultant: new Set([
    "unwatermarked_pdf",
    "unlimited_periods",
    "evidence_vault",
    "white_label",
    "bulk_actions",
    "consultant_cc",
  ]),
};

export function isPlanId(value: string): value is PlanId {
  return value === "free" || value === "pro" || value === "consultant";
}

export function normalizePlan(value: string | null | undefined): PlanId {
  if (value && isPlanId(value)) return value;
  return "free";
}

export function planEntitlements(plan: PlanId): ReadonlySet<Entitlement> {
  return ENTITLEMENTS[plan];
}

export function planFromStripePriceId(priceId: string | null | undefined): PlanId | null {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_PRICE_PRO) return "pro";
  if (priceId === process.env.STRIPE_PRICE_CONSULTANT) return "consultant";
  return null;
}

export function stripePriceIdForPlan(plan: Exclude<PlanId, "free">): string | null {
  if (plan === "pro") return process.env.STRIPE_PRICE_PRO ?? null;
  return process.env.STRIPE_PRICE_CONSULTANT ?? null;
}
