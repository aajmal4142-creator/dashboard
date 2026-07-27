import {
  normalizePlan,
  planEntitlements,
  PLAN_LIMITS,
  type Entitlement,
  type PlanId,
  type PlanLimits,
} from "./plans";

/**
 * Server-side entitlement check. Never gate in the UI alone.
 */
export function can(plan: string | null | undefined, entitlement: Entitlement): boolean {
  const id = normalizePlan(plan);
  return planEntitlements(id).has(entitlement);
}

export function limits(plan: string | null | undefined): PlanLimits {
  return PLAN_LIMITS[normalizePlan(plan)];
}

export function assertCan(
  plan: string | null | undefined,
  entitlement: Entitlement,
): void {
  if (!can(plan, entitlement)) {
    throw new BillingDeniedError(normalizePlan(plan), entitlement);
  }
}

export class BillingDeniedError extends Error {
  readonly plan: PlanId;
  readonly entitlement: Entitlement;
  readonly code = "BILLING_DENIED" as const;

  constructor(plan: PlanId, entitlement: Entitlement) {
    super(
      `Plan "${plan}" does not include "${entitlement}". Upgrade at /dashboard/billing.`,
    );
    this.name = "BillingDeniedError";
    this.plan = plan;
    this.entitlement = entitlement;
  }
}

export function billingDeniedResponse(error: BillingDeniedError): {
  error: string;
  code: "BILLING_DENIED";
  plan: PlanId;
  entitlement: Entitlement;
  upgradePath: string;
} {
  return {
    error: error.message,
    code: error.code,
    plan: error.plan,
    entitlement: error.entitlement,
    upgradePath: "/dashboard/billing",
  };
}
