export type PlanId = "free" | "pro" | "professional" | "consultant" | "enterprise";

export type Entitlement =
  | "unwatermarked_pdf"
  | "unlimited_periods"
  | "evidence_vault"
  | "scope3_full"
  | "multi_entity"
  | "api_access"
  | "white_label"
  | "bulk_actions"
  | "consultant_cc";

export type PlanLimits = {
  maxPeriods: number;
  maxSuppliers: number;
  maxClients: number;
  maxUsers: number;
  /** USD monthly list price for display. */
  priceUsd: number;
  /** USD annual list price (~17% off / ~2 months free). Null = N/A. */
  priceAnnualUsd: number | null;
  label: string;
  /** Short blurb for billing cards. */
  blurb: string;
};

/** ~17% annual discount: monthly × 10. */
export const ANNUAL_DISCOUNT_LABEL = "Save 17%";

export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  free: {
    maxPeriods: 1,
    maxSuppliers: 3,
    maxClients: 0,
    maxUsers: 1,
    priceUsd: 0,
    priceAnnualUsd: null,
    label: "Forever Free",
    blurb:
      "Watermarked PDF, 1 reporting period, Scope 1 & 2 only, 1 user, community support.",
  },
  pro: {
    maxPeriods: Number.POSITIVE_INFINITY,
    maxSuppliers: 10,
    maxClients: 0,
    maxUsers: 5,
    priceUsd: 199,
    priceAnnualUsd: 1990,
    label: "Pro",
    blurb:
      "Unlimited periods, clean PDF, Scope 1–3, evidence packs, frameworks, ≤5 users, ≤10 suppliers, email support.",
  },
  professional: {
    maxPeriods: Number.POSITIVE_INFINITY,
    maxSuppliers: Number.POSITIVE_INFINITY,
    maxClients: 0,
    maxUsers: 20,
    priceUsd: 399,
    priceAnnualUsd: 3990,
    label: "Professional",
    blurb:
      "Everything in Pro + multi-entity, full Scope 3 × 15, CSRD/ESRS packs, API, ≤20 users, unlimited suppliers, priority support.",
  },
  consultant: {
    maxPeriods: Number.POSITIVE_INFINITY,
    maxSuppliers: Number.POSITIVE_INFINITY,
    maxClients: 100,
    maxUsers: Number.POSITIVE_INFINITY,
    priceUsd: 799,
    priceAnnualUsd: 7990,
    label: "Consultant",
    blurb:
      "Everything in Professional + multi-client dashboard, white-label, client org management, unlimited users, dedicated support.",
  },
  enterprise: {
    maxPeriods: Number.POSITIVE_INFINITY,
    maxSuppliers: Number.POSITIVE_INFINITY,
    maxClients: Number.POSITIVE_INFINITY,
    maxUsers: Number.POSITIVE_INFINITY,
    priceUsd: 0,
    priceAnnualUsd: null,
    label: "Enterprise",
    blurb:
      "Everything in Consultant + SSO/SAML, custom SLA, consolidation at scale, dedicated CSM, custom integrations — contact sales.",
  },
};

/** Paid plans that can start Stripe Checkout (not free / not enterprise custom). */
export const CHECKOUT_PLAN_IDS = ["pro", "professional", "consultant"] as const;
export type CheckoutPlanId = (typeof CHECKOUT_PLAN_IDS)[number];

const ENTITLEMENTS: Record<PlanId, ReadonlySet<Entitlement>> = {
  free: new Set(),
  pro: new Set(["unwatermarked_pdf", "unlimited_periods", "evidence_vault"]),
  professional: new Set([
    "unwatermarked_pdf",
    "unlimited_periods",
    "evidence_vault",
    "scope3_full",
    "multi_entity",
    "api_access",
  ]),
  consultant: new Set([
    "unwatermarked_pdf",
    "unlimited_periods",
    "evidence_vault",
    "scope3_full",
    "multi_entity",
    "api_access",
    "white_label",
    "bulk_actions",
    "consultant_cc",
  ]),
  enterprise: new Set([
    "unwatermarked_pdf",
    "unlimited_periods",
    "evidence_vault",
    "scope3_full",
    "multi_entity",
    "api_access",
    "white_label",
    "bulk_actions",
    "consultant_cc",
  ]),
};

export function isPlanId(value: string): value is PlanId {
  return (
    value === "free" ||
    value === "pro" ||
    value === "professional" ||
    value === "consultant" ||
    value === "enterprise"
  );
}

export function isCheckoutPlanId(value: string): value is CheckoutPlanId {
  return value === "pro" || value === "professional" || value === "consultant";
}

export function normalizePlan(value: string | null | undefined): PlanId {
  if (value && isPlanId(value)) return value;
  return "free";
}

export function planEntitlements(plan: PlanId): ReadonlySet<Entitlement> {
  return ENTITLEMENTS[plan];
}

export function formatUsdMonthly(plan: PlanId): string {
  const p = PLAN_LIMITS[plan];
  if (plan === "enterprise") return "Custom";
  if (p.priceUsd <= 0) return "$0/mo";
  return `$${p.priceUsd}/mo`;
}

export function formatUsdAnnual(plan: PlanId): string | null {
  const annual = PLAN_LIMITS[plan].priceAnnualUsd;
  if (annual == null || annual <= 0) return null;
  return `$${annual.toLocaleString("en-US")}/yr`;
}

export function planFromStripePriceId(priceId: string | null | undefined): PlanId | null {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_PRICE_PRO) return "pro";
  if (priceId === process.env.STRIPE_PRICE_PROFESSIONAL) return "professional";
  if (priceId === process.env.STRIPE_PRICE_CONSULTANT) return "consultant";
  return null;
}

export function stripePriceIdForPlan(
  plan: Exclude<PlanId, "free" | "enterprise">,
): string | null {
  if (plan === "pro") return process.env.STRIPE_PRICE_PRO ?? null;
  if (plan === "professional") {
    return process.env.STRIPE_PRICE_PROFESSIONAL ?? null;
  }
  return process.env.STRIPE_PRICE_CONSULTANT ?? null;
}

export function stripePriceEnvName(plan: Exclude<PlanId, "free" | "enterprise">): string {
  if (plan === "pro") return "STRIPE_PRICE_PRO";
  if (plan === "professional") return "STRIPE_PRICE_PROFESSIONAL";
  return "STRIPE_PRICE_CONSULTANT";
}

/** @deprecated Use priceUsd — kept as alias during migration of call sites. */
export function planPriceUsd(plan: PlanId): number {
  return PLAN_LIMITS[plan].priceUsd;
}
