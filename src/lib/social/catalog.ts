/**
 * Social / workforce indicators catalog.
 *
 * Metric keys map only where ClearESG already collects S-category datapoints.
 * Empty metricKeys = honest unmapped gap (e.g. living wage), not a guess.
 * Deterministic only — no AI, no carbon formulas.
 */

import type { SocialIndicatorDef, SocialSection, SocialSectionId } from "./types";

export const SOCIAL_SECTIONS: SocialSection[] = [
  {
    id: "workforce",
    title: "Workforce composition",
    shortTitle: "Workforce",
    description:
      "Headcount and gender mix for the reporting period. FTE basis matches Metrics.",
  },
  {
    id: "health_safety",
    title: "Health and safety",
    shortTitle: "H&S",
    description:
      "Recordable injuries, hours worked (rate denominator), and fatal incidents where tracked.",
  },
  {
    id: "learning",
    title: "Learning and development",
    shortTitle: "Training",
    description: "Formal training hours delivered to employees during the period.",
  },
  {
    id: "fair_pay",
    title: "Fair pay and living wage",
    shortTitle: "Fair pay",
    description:
      "Living-wage coverage and pay-gap indicators. Unmapped rows stay gaps until metrics ship.",
  },
  {
    id: "labour_practices",
    title: "Labour practices",
    shortTitle: "Labour",
    description:
      "Turnover, parental leave, contractors, and worker voice (whistleblower channel).",
  },
];

/**
 * ClearESG metric keys already seeded for social / workforce disclosure.
 * Unmapped catalog rows deliberately omit these.
 */
export const SOCIAL_MAPPED_METRIC_KEYS = [
  "employees_total",
  "employees_women",
  "injuries_recordable",
  "hours_worked_total",
  "training_hours_total",
  "policy_whistleblower",
] as const;

export type SocialMappedMetricKey = (typeof SOCIAL_MAPPED_METRIC_KEYS)[number];

export const SOCIAL_INDICATORS: SocialIndicatorDef[] = [
  // ── Workforce ──────────────────────────────────────────────────────────
  {
    code: "S-WF-1",
    sectionId: "workforce",
    label: "Total employees (FTE)",
    sourceKind: "metric",
    metricKeys: ["employees_total"],
    requiresEvidence: false,
    note: "End-of-period headcount on an FTE basis.",
  },
  {
    code: "S-WF-2",
    sectionId: "workforce",
    label: "Women in workforce (gender mix numerator)",
    sourceKind: "metric",
    metricKeys: ["employees_women"],
    requiresEvidence: false,
    note: "Pair with total employees for diversity %. Same FTE basis.",
  },
  {
    code: "S-WF-3",
    sectionId: "workforce",
    label: "Gender mix (women + total employees)",
    sourceKind: "metric",
    metricKeys: ["employees_women", "employees_total"],
    metricMatch: "all",
    requiresEvidence: false,
    note: "Both keys required to compute women as a share of workforce.",
  },
  {
    code: "S-WF-4",
    sectionId: "workforce",
    label: "Contractor / non-employee headcount",
    sourceKind: "unmapped",
    note: "Not collected as a ClearESG metric yet.",
  },

  // ── Health & safety ────────────────────────────────────────────────────
  {
    code: "S-HS-1",
    sectionId: "health_safety",
    label: "Recordable work-related injuries",
    sourceKind: "metric",
    metricKeys: ["injuries_recordable"],
    requiresEvidence: true,
    note: "Zero is valid — enter 0 if none. Blank means not tracked.",
  },
  {
    code: "S-HS-2",
    sectionId: "health_safety",
    label: "Total hours worked (injury-rate denominator)",
    sourceKind: "metric",
    metricKeys: ["hours_worked_total"],
    requiresEvidence: false,
  },
  {
    code: "S-HS-3",
    sectionId: "health_safety",
    label: "Injury rate inputs (injuries + hours)",
    sourceKind: "metric",
    metricKeys: ["injuries_recordable", "hours_worked_total"],
    metricMatch: "all",
    requiresEvidence: true,
    note: "Both inputs required before an injury rate can be disclosed.",
  },
  {
    code: "S-HS-4",
    sectionId: "health_safety",
    label: "Work-related fatalities",
    sourceKind: "unmapped",
    note: "Fatal incident count — not collected as a ClearESG metric yet.",
  },
  {
    code: "S-HS-5",
    sectionId: "health_safety",
    label: "Lost-time injury frequency rate (LTIFR)",
    sourceKind: "unmapped",
    note: "Derived rate metric not seeded; use injuries + hours when available.",
  },

  // ── Learning ───────────────────────────────────────────────────────────
  {
    code: "S-LD-1",
    sectionId: "learning",
    label: "Training hours delivered to employees",
    sourceKind: "metric",
    metricKeys: ["training_hours_total"],
    requiresEvidence: false,
    note: "All formal training in the period.",
  },
  {
    code: "S-LD-2",
    sectionId: "learning",
    label: "Training hours per employee",
    sourceKind: "unmapped",
    note: "Per-FTE rate not stored; compute externally from training_hours_total ÷ employees_total when both exist.",
  },

  // ── Fair pay ───────────────────────────────────────────────────────────
  {
    code: "S-FP-1",
    sectionId: "fair_pay",
    label: "Living wage coverage (% of workforce)",
    sourceKind: "unmapped",
    note: "Living-wage coverage — not collected as a ClearESG metric yet.",
  },
  {
    code: "S-FP-2",
    sectionId: "fair_pay",
    label: "Unadjusted gender pay gap",
    sourceKind: "unmapped",
    note: "Pay-gap % not collected. Workforce gender counts are not a substitute.",
  },
  {
    code: "S-FP-3",
    sectionId: "fair_pay",
    label: "CEO-to-median worker pay ratio",
    sourceKind: "unmapped",
    note: "Compensation ratio — not collected as a ClearESG metric yet.",
  },

  // ── Labour practices ───────────────────────────────────────────────────
  {
    code: "S-LP-1",
    sectionId: "labour_practices",
    label: "Whistleblower channel in place",
    sourceKind: "metric",
    metricKeys: ["policy_whistleblower"],
    requiresEvidence: true,
    note: "Policy / channel presence is a labour-rights proxy until incident metrics ship.",
  },
  {
    code: "S-LP-2",
    sectionId: "labour_practices",
    label: "Employee turnover rate",
    sourceKind: "unmapped",
    note: "Voluntary / involuntary turnover — not collected as a ClearESG metric yet.",
  },
  {
    code: "S-LP-3",
    sectionId: "labour_practices",
    label: "Return to work after parental leave",
    sourceKind: "unmapped",
    note: "HR retention narrative — not collected as a ClearESG metric yet.",
  },
  {
    code: "S-LP-4",
    sectionId: "labour_practices",
    label: "Collective bargaining coverage",
    sourceKind: "unmapped",
    note: "Share of workforce covered by collective agreements — not tracked yet.",
  },
];

export function socialIndicatorByCode(code: string): SocialIndicatorDef | undefined {
  return SOCIAL_INDICATORS.find((row) => row.code === code);
}

export function socialSectionById(id: SocialSectionId): SocialSection | undefined {
  return SOCIAL_SECTIONS.find((row) => row.id === id);
}

/** Metric keys referenced by mapped social indicators (deduped). */
export function socialCatalogMetricKeys(): string[] {
  const keys = new Set<string>();
  for (const row of SOCIAL_INDICATORS) {
    if (row.sourceKind !== "metric") continue;
    for (const key of row.metricKeys ?? []) keys.add(key);
  }
  return [...keys].sort();
}
