import type { Access, CollectionConfig, Where } from "payload";

import { denyAll } from "@/lib/access";

const benchmarkRead: Access = async ({ req }) => {
  if (!req.user) return false;
  const where: Where = { cohortSize: { greater_than_equal: 8 } };
  return where;
};

/**
 * Computed nightly. NEVER expose if cohortSize < 8 — enforced in access read.
 */
export const BenchmarkStats: CollectionConfig = {
  slug: "benchmark-stats",
  admin: {
    defaultColumns: ["sector", "metricKey", "period", "cohortSize"],
  },
  access: {
    read: benchmarkRead,
    create: denyAll,
    update: denyAll,
    delete: denyAll,
  },
  fields: [
    { name: "sector", type: "text", required: true, index: true },
    { name: "sizeBand", type: "text", required: true },
    { name: "metricKey", type: "text", required: true, index: true },
    { name: "period", type: "text", required: true },
    { name: "p25", type: "number", required: true },
    { name: "p50", type: "number", required: true },
    { name: "p75", type: "number", required: true },
    { name: "cohortSize", type: "number", required: true, min: 0 },
    {
      name: "computedAt",
      type: "date",
      admin: { description: "As-of timestamp for this cohort row." },
    },
  ],
};
