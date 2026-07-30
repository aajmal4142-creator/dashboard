import type { Access, CollectionConfig, Where } from "payload";

import { denyAll } from "@/lib/access";

const benchmarkRead: Access = async ({ req }) => {
  if (!req.user) return false;
  const where: Where = { cohortSize: { greater_than_equal: 8 } };
  return where;
};

/**
 * Computed nightly. NEVER expose if cohortSize < 8 — enforced in access read.
 * Cohort gate documented in lib/benchmarks (MIN_COHORT_SIZE / COHORT_GATE_NOTE).
 * Rows are anonymised aggregates only — never store peer org ids or names.
 */
export const BenchmarkStats: CollectionConfig = {
  slug: "benchmark-stats",
  admin: {
    defaultColumns: [
      "sector",
      "sizeBand",
      "geography",
      "metricKey",
      "period",
      "cohortSize",
    ],
  },
  access: {
    read: benchmarkRead,
    create: denyAll,
    update: denyAll,
    delete: denyAll,
  },
  fields: [
    { name: "sector", type: "text", required: true, index: true },
    { name: "sizeBand", type: "text", required: true, index: true },
    {
      name: "geography",
      type: "text",
      required: true,
      defaultValue: "all",
      index: true,
      admin: {
        description: "ISO country or 'all' for geography-agnostic cohort.",
      },
    },
    { name: "metricKey", type: "text", required: true, index: true },
    { name: "period", type: "text", required: true, index: true },
    {
      name: "p10",
      type: "number",
      admin: { description: "10th percentile (also used as privacy-safe best proxy)." },
    },
    { name: "p25", type: "number", required: true },
    { name: "p50", type: "number", required: true },
    { name: "p75", type: "number", required: true },
    { name: "p90", type: "number" },
    {
      name: "mean",
      type: "number",
      admin: { description: "Arithmetic mean of contributing values." },
    },
    {
      name: "best",
      type: "number",
      admin: {
        description:
          "Best-in-class proxy (= p10). Never the raw cohort minimum (re-identification risk).",
      },
    },
    { name: "cohortSize", type: "number", required: true, min: 0 },
    {
      name: "computedAt",
      type: "date",
      admin: { description: "As-of timestamp for this cohort row." },
    },
  ],
};
