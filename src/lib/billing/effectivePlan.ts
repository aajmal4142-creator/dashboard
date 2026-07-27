import { normalizePlan, type PlanId } from "./plans";

export type SubscriptionStatus =
  "none" | "active" | "past_due" | "canceled" | "trialing" | string | null | undefined;

/**
 * Effective plan for entitlements / caps / watermark.
 * past_due (and unpaid/canceled) freezes to Free — never blocks publish.
 * Display `plan` on the org may still say "pro" for reactivation UX.
 */
export function resolveEffectivePlan(input: {
  plan: string | null | undefined;
  subscriptionStatus?: SubscriptionStatus;
}): PlanId {
  const plan = normalizePlan(input.plan);
  const status = (input.subscriptionStatus ?? "none").toLowerCase();
  if (
    status === "past_due" ||
    status === "unpaid" ||
    status === "canceled" ||
    status === "incomplete_expired"
  ) {
    return "free";
  }
  return plan;
}

/** True when billing freeze applies (Pro display, Free entitlements). */
export function isPlanFrozen(subscriptionStatus?: SubscriptionStatus): boolean {
  const status = (subscriptionStatus ?? "none").toLowerCase();
  return (
    status === "past_due" ||
    status === "unpaid" ||
    status === "canceled" ||
    status === "incomplete_expired"
  );
}
