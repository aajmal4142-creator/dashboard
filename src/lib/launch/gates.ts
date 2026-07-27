/**
 * Launch gates from customer satisfaction plan §17.
 * Money and publish are blocked until WS0 is signed off in writing (env mirrors the checklist).
 */

export function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
}

/** Dev bypass is never allowed in production runtimes. */
export function devBypassAllowed(): boolean {
  if (isProductionRuntime()) return false;
  return process.env.CLEARESG_DEV_BYPASS === "1";
}

/** WS0 money-gate: paid LIVE checkout requires written sign-off. */
export function ws0SignedOff(): boolean {
  return process.env.CLEARESG_WS0_SIGNED_OFF === "1";
}

/** Lawyer-reviewed disclaimer gate — blocks publish until set. */
export function disclaimerReviewed(): boolean {
  return process.env.CLEARESG_DISCLAIMER_REVIEWED === "1";
}

/**
 * Live Stripe Checkout / Portal (real money) requires WS0 sign-off in every environment.
 * Non-prod without sign-off must use stub / CLEARESG_DEV_BYPASS only — never charge.
 */
export function mayEnablePaidBilling(): boolean {
  return ws0SignedOff();
}

/** Real cohort publication — LAUNCH_DECISIONS #5 until CLEARESG_BENCHMARKS_LIVE=1. */
export function mayPublishBenchmarkCohorts(): boolean {
  return process.env.CLEARESG_BENCHMARKS_LIVE === "1";
}

/** Demo fabricated cohort — opt-in only, off by default. */
export function maySeedBenchmarkDemo(): boolean {
  return process.env.CLEARESG_BENCHMARK_DEMO === "1";
}

export function mayPublishReports(): boolean {
  if (!isProductionRuntime()) return true;
  return disclaimerReviewed();
}

export function atlasRegionConfigured(): string | null {
  return process.env.CLEARESG_ATLAS_REGION?.trim() || null;
}

export type GateDenial = {
  error: string;
  code: "WS0_REQUIRED" | "DISCLAIMER_REQUIRED" | "DEV_BYPASS_FORBIDDEN";
  docs: string;
};

export function paidBillingDenial(): GateDenial {
  return {
    code: "WS0_REQUIRED",
    error:
      "Paid billing is locked until Workstream 0 decisions are signed off in writing (docs/LAUNCH_DECISIONS.md).",
    docs: "/docs/LAUNCH_DECISIONS.md",
  };
}

export function publishDenial(): GateDenial {
  return {
    code: "DISCLAIMER_REQUIRED",
    error:
      "Publishing is locked until the assurance disclaimer is lawyer-reviewed (set CLEARESG_DISCLAIMER_REVIEWED=1).",
    docs: "/docs/LAUNCH_DECISIONS.md",
  };
}
