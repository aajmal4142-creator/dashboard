import "dotenv/config";

import { getPayload } from "payload";

import config from "../src/payload.config";

async function main() {
  const payload = await getPayload({ config });
  const id = "6a6110dabaea9eb9de9e3f7b";

  const before = await payload.findByID({
    collection: "organisations",
    id,
    depth: 0,
    overrideAccess: true,
  });
  console.log("before", {
    plan: before.plan,
    status: before.subscriptionStatus,
    annualRevenue: before.annualRevenue,
    employeeCount: before.employeeCount,
    annualOutputUnits: before.annualOutputUnits,
    floorAreaSqm: before.floorAreaSqm,
  });

  const org = await payload.update({
    collection: "organisations",
    id,
    data: {
      plan: "consultant",
      subscriptionStatus: "active",
      annualRevenue: 30_000_000,
      employeeCount: 80,
      annualOutputUnits: 12_000,
      outputUnitLabel: "units",
      floorAreaSqm: 4_500,
      expectedRevenueGrowth: 0.03,
    },
    overrideAccess: true,
  });

  console.log("after", {
    plan: org.plan,
    status: org.subscriptionStatus,
    annualRevenue: org.annualRevenue,
    employeeCount: org.employeeCount,
    annualOutputUnits: org.annualOutputUnits,
    floorAreaSqm: org.floorAreaSqm,
    expectedRevenueGrowth: org.expectedRevenueGrowth,
  });
}

main()
  .then(() => process.exit(0))
  .catch((e: unknown) => {
    console.error(e);
    process.exit(1);
  });
