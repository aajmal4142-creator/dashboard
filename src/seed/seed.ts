import "dotenv/config";

import { getPayload } from "payload";

import config from "../payload.config";
import { DERIVED_METRICS } from "../lib/derive/registry";
import { emissionFactors } from "./emission-factors.seed";
import { metricDefinitions } from "./metric-definitions.seed";

type DatapointSeed = {
  metricKey: string;
  value: number | null;
  unit: string | null;
  quality: "measured" | "calculated" | "estimated" | "missing";
  source: "manual" | "estimate";
};

function manufacturerDatapoints(): DatapointSeed[] {
  return [
    {
      metricKey: "electricity_kwh",
      value: 1_240_000,
      unit: "kWh",
      quality: "measured",
      source: "manual",
    },
    {
      metricKey: "electricity_renewable_pct",
      value: 18,
      unit: "%",
      quality: "estimated",
      source: "estimate",
    },
    {
      metricKey: "diesel_litres",
      value: 42_500,
      unit: "L",
      quality: "measured",
      source: "manual",
    },
    {
      metricKey: "natural_gas_m3",
      value: 85_000,
      unit: "m³",
      quality: "measured",
      source: "manual",
    },
    {
      metricKey: "petrol_litres",
      value: 6_200,
      unit: "L",
      quality: "measured",
      source: "manual",
    },
    {
      metricKey: "district_heat_kwh",
      value: null,
      unit: "kWh",
      quality: "missing",
      source: "manual",
    },
    {
      metricKey: "employees_total",
      value: 186,
      unit: "FTE",
      quality: "measured",
      source: "manual",
    },
    {
      metricKey: "employees_women",
      value: 54,
      unit: "FTE",
      quality: "measured",
      source: "manual",
    },
    {
      metricKey: "injuries_recordable",
      value: 3,
      unit: "count",
      quality: "measured",
      source: "manual",
    },
    {
      metricKey: "hours_worked_total",
      value: 334_800,
      unit: "hours",
      quality: "estimated",
      source: "estimate",
    },
    {
      metricKey: "training_hours_total",
      value: 2_240,
      unit: "hours",
      quality: "measured",
      source: "manual",
    },
    {
      metricKey: "board_size",
      value: 7,
      unit: "count",
      quality: "measured",
      source: "manual",
    },
    {
      metricKey: "board_independent",
      value: 3,
      unit: "count",
      quality: "measured",
      source: "manual",
    },
    {
      metricKey: "policy_anti_corruption",
      value: 1,
      unit: null,
      quality: "measured",
      source: "manual",
    },
    {
      metricKey: "policy_whistleblower",
      value: 1,
      unit: null,
      quality: "measured",
      source: "manual",
    },
    {
      metricKey: "policy_data_privacy",
      value: 1,
      unit: null,
      quality: "measured",
      source: "manual",
    },
    {
      metricKey: "supplier_spend_total",
      value: 4_800_000,
      unit: "currency",
      quality: "estimated",
      source: "estimate",
    },
    {
      metricKey: "business_travel_km",
      value: 210_000,
      unit: "km",
      quality: "estimated",
      source: "estimate",
    },
  ];
}

function servicesDatapoints(): DatapointSeed[] {
  return [
    {
      metricKey: "electricity_kwh",
      value: 186_000,
      unit: "kWh",
      quality: "measured",
      source: "manual",
    },
    {
      metricKey: "electricity_renewable_pct",
      value: 62,
      unit: "%",
      quality: "measured",
      source: "manual",
    },
    {
      metricKey: "diesel_litres",
      value: 1_100,
      unit: "L",
      quality: "measured",
      source: "manual",
    },
    {
      metricKey: "natural_gas_m3",
      value: 12_400,
      unit: "m³",
      quality: "measured",
      source: "manual",
    },
    {
      metricKey: "petrol_litres",
      value: 3_800,
      unit: "L",
      quality: "estimated",
      source: "estimate",
    },
    {
      metricKey: "district_heat_kwh",
      value: 45_000,
      unit: "kWh",
      quality: "measured",
      source: "manual",
    },
    {
      metricKey: "employees_total",
      value: 74,
      unit: "FTE",
      quality: "measured",
      source: "manual",
    },
    {
      metricKey: "employees_women",
      value: 39,
      unit: "FTE",
      quality: "measured",
      source: "manual",
    },
    {
      metricKey: "injuries_recordable",
      value: 0,
      unit: "count",
      quality: "measured",
      source: "manual",
    },
    {
      metricKey: "hours_worked_total",
      value: 133_200,
      unit: "hours",
      quality: "measured",
      source: "manual",
    },
    {
      metricKey: "training_hours_total",
      value: 1_480,
      unit: "hours",
      quality: "measured",
      source: "manual",
    },
    {
      metricKey: "board_size",
      value: 5,
      unit: "count",
      quality: "measured",
      source: "manual",
    },
    {
      metricKey: "board_independent",
      value: 2,
      unit: "count",
      quality: "measured",
      source: "manual",
    },
    {
      metricKey: "policy_anti_corruption",
      value: 1,
      unit: null,
      quality: "measured",
      source: "manual",
    },
    {
      metricKey: "policy_whistleblower",
      value: 0,
      unit: null,
      quality: "missing",
      source: "manual",
    },
    {
      metricKey: "policy_data_privacy",
      value: 1,
      unit: null,
      quality: "measured",
      source: "manual",
    },
    {
      metricKey: "supplier_spend_total",
      value: 920_000,
      unit: "currency",
      quality: "measured",
      source: "manual",
    },
    {
      metricKey: "business_travel_km",
      value: 480_000,
      unit: "km",
      quality: "measured",
      source: "manual",
    },
  ];
}

function clientDatapoints(scale: number): DatapointSeed[] {
  return manufacturerDatapoints().map((row) => ({
    ...row,
    value:
      row.value === null
        ? null
        : row.metricKey.startsWith("policy_") ||
            row.metricKey === "board_size" ||
            row.metricKey === "board_independent" ||
            row.metricKey === "injuries_recordable"
          ? row.value
          : Math.round(row.value * scale),
  }));
}

async function upsertMetricDefinitions(payload: Awaited<ReturnType<typeof getPayload>>) {
  for (const metric of metricDefinitions) {
    const existing = await payload.find({
      collection: "metric-definitions",
      where: { key: { equals: metric.key } },
      limit: 1,
      overrideAccess: true,
    });

    const data = {
      ...metric,
      unit: metric.unit ?? undefined,
      frameworkMappings: [],
    };

    if (existing.docs[0]) {
      await payload.update({
        collection: "metric-definitions",
        id: existing.docs[0].id,
        data,
        overrideAccess: true,
      });
    } else {
      await payload.create({
        collection: "metric-definitions",
        data,
        overrideAccess: true,
      });
    }
  }
}

async function upsertEmissionFactors(payload: Awaited<ReturnType<typeof getPayload>>) {
  for (const factor of emissionFactors) {
    const existing = await payload.find({
      collection: "emission-factors",
      where: {
        and: [
          { key: { equals: factor.key } },
          { region: { equals: factor.region } },
          { publicationYear: { equals: factor.publicationYear } },
        ],
      },
      limit: 1,
      overrideAccess: true,
    });

    if (existing.docs[0]) {
      await payload.update({
        collection: "emission-factors",
        id: existing.docs[0].id,
        data: factor,
        overrideAccess: true,
      });
    } else {
      await payload.create({
        collection: "emission-factors",
        data: factor,
        overrideAccess: true,
      });
    }
  }
}

async function seedOrgBundle(
  payload: Awaited<ReturnType<typeof getPayload>>,
  opts: {
    name: string;
    slug: string;
    type: "company" | "consultancy";
    sector: string;
    country: string;
    employeeCount: number;
    revenueBand: "lt_2m" | "2_10m" | "10_50m" | "50_250m" | "gt_250m";
    plan: "free" | "pro" | "consultant";
    parentOrg?: string;
    ownerId: string;
    datapoints: DatapointSeed[];
    obligation: {
      wave: "1" | "2" | "3" | "brsr_listed" | "brsr_supply";
      jurisdiction: string;
      standardVersion: "CSRD_SET1" | "CSRD_SIMPLIFIED" | "BRSR";
      firstReportingFY: string;
      filingDeadline: string;
    };
  },
) {
  const existingOrg = await payload.find({
    collection: "organisations",
    where: { slug: { equals: opts.slug } },
    limit: 1,
    overrideAccess: true,
  });

  const orgData = {
    name: opts.name,
    slug: opts.slug,
    type: opts.type,
    sector: opts.sector,
    country: opts.country,
    employeeCount: opts.employeeCount,
    revenueBand: opts.revenueBand,
    fiscalYearEnd: "03-31",
    parentOrg: opts.parentOrg,
    plan: opts.plan,
    subscriptionStatus: "active" as const,
    onboardedAt: new Date().toISOString(),
  };

  const org = existingOrg.docs[0]
    ? await payload.update({
        collection: "organisations",
        id: existingOrg.docs[0].id,
        data: orgData,
        overrideAccess: true,
      })
    : await payload.create({
        collection: "organisations",
        data: orgData,
        overrideAccess: true,
      });

  const memberships = await payload.find({
    collection: "memberships",
    where: {
      and: [{ user: { equals: opts.ownerId } }, { organisation: { equals: org.id } }],
    },
    limit: 1,
    overrideAccess: true,
  });

  if (!memberships.docs[0]) {
    await payload.create({
      collection: "memberships",
      data: {
        user: opts.ownerId,
        organisation: org.id,
        role: "owner",
        status: "active",
        acceptedAt: new Date().toISOString(),
      },
      overrideAccess: true,
    });
  }

  const periods = await payload.find({
    collection: "reporting-periods",
    where: {
      and: [{ organisation: { equals: org.id } }, { label: { equals: "FY2025" } }],
    },
    limit: 1,
    overrideAccess: true,
  });

  const period = periods.docs[0]
    ? periods.docs[0]
    : await payload.create({
        collection: "reporting-periods",
        data: {
          organisation: org.id,
          label: "FY2025",
          startDate: "2024-04-01",
          endDate: "2025-03-31",
          status: "open",
        },
        overrideAccess: true,
      });

  for (const row of opts.datapoints) {
    const existing = await payload.find({
      collection: "datapoints",
      where: {
        and: [
          { organisation: { equals: org.id } },
          { period: { equals: period.id } },
          { metricKey: { equals: row.metricKey } },
        ],
      },
      limit: 1,
      overrideAccess: true,
    });

    const data = {
      organisation: org.id,
      period: period.id,
      metricKey: row.metricKey,
      value: row.value ?? undefined,
      unit: row.unit ?? undefined,
      quality: row.quality,
      source: row.source,
      enteredBy: opts.ownerId,
      enteredAt: new Date().toISOString(),
    };

    if (existing.docs[0]) {
      await payload.update({
        collection: "datapoints",
        id: existing.docs[0].id,
        data,
        overrideAccess: true,
      });
    } else {
      await payload.create({
        collection: "datapoints",
        data,
        overrideAccess: true,
      });
    }
  }

  const obligations = await payload.find({
    collection: "compliance-obligations",
    where: {
      and: [
        { organisation: { equals: org.id } },
        { standardVersion: { equals: opts.obligation.standardVersion } },
      ],
    },
    limit: 1,
    overrideAccess: true,
  });

  const obligationData = {
    organisation: org.id,
    ...opts.obligation,
  };

  if (obligations.docs[0]) {
    await payload.update({
      collection: "compliance-obligations",
      id: obligations.docs[0].id,
      data: obligationData,
      overrideAccess: true,
    });
  } else {
    await payload.create({
      collection: "compliance-obligations",
      data: obligationData,
      overrideAccess: true,
    });
  }

  return org;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required");
  }
  if (!process.env.PAYLOAD_SECRET) {
    throw new Error("PAYLOAD_SECRET is required");
  }

  const payload = await getPayload({ config });

  console.log("Seeding metric definitions…");
  await upsertMetricDefinitions(payload);

  console.log("Seeding derived metric definitions (ESRS mappings)…");
  for (const derived of DERIVED_METRICS) {
    const existing = await payload.find({
      collection: "derived-metric-definitions",
      where: { key: { equals: derived.key } },
      limit: 1,
      overrideAccess: true,
    });
    const data = {
      key: derived.key,
      label: derived.label,
      description: derived.description,
      unit: derived.unit,
      frameworkMappings: derived.frameworkMappings.map((m) => ({
        ...m,
        validFrom: m.validFrom ?? undefined,
        validUntil: m.validUntil ?? undefined,
      })),
    };
    if (existing.docs[0]) {
      await payload.update({
        collection: "derived-metric-definitions",
        id: existing.docs[0].id,
        data,
        overrideAccess: true,
      });
    } else {
      await payload.create({
        collection: "derived-metric-definitions",
        data,
        overrideAccess: true,
      });
    }
  }

  console.log("Seeding emission factors (IEA skipped)…");
  await upsertEmissionFactors(payload);

  const demoEmail = "demo@clearesg.local";
  const existingUsers = await payload.find({
    collection: "users",
    where: { email: { equals: demoEmail } },
    limit: 1,
    overrideAccess: true,
  });

  const owner =
    existingUsers.docs[0] ??
    (await payload.create({
      collection: "users",
      data: {
        email: demoEmail,
        password: "ClearESG-demo-change-me",
        firstName: "Demo",
        lastName: "Owner",
      },
      overrideAccess: true,
    }));

  console.log("Seeding demo organisations…");

  const consultancy = await seedOrgBundle(payload, {
    name: "Meridian ESG Advisors",
    slug: "meridian-esg",
    type: "consultancy",
    sector: "M70.2",
    country: "GB",
    employeeCount: 22,
    revenueBand: "2_10m",
    plan: "consultant",
    ownerId: owner.id,
    datapoints: servicesDatapoints(),
    obligation: {
      wave: "2",
      jurisdiction: "GB",
      standardVersion: "CSRD_SIMPLIFIED",
      firstReportingFY: "FY2027",
      filingDeadline: "2028-12-31",
    },
  });

  await seedOrgBundle(payload, {
    name: "Ashoka Precision Components",
    slug: "ashoka-precision",
    type: "company",
    sector: "C25.1",
    country: "IN",
    employeeCount: 186,
    revenueBand: "10_50m",
    plan: "pro",
    ownerId: owner.id,
    datapoints: manufacturerDatapoints(),
    obligation: {
      wave: "brsr_listed",
      jurisdiction: "IN",
      standardVersion: "BRSR",
      firstReportingFY: "FY2025",
      filingDeadline: "2026-07-31",
    },
  });

  await seedOrgBundle(payload, {
    name: "Northbridge Services Ltd",
    slug: "northbridge-services",
    type: "company",
    sector: "J62.0",
    country: "IE",
    employeeCount: 74,
    revenueBand: "10_50m",
    plan: "pro",
    ownerId: owner.id,
    datapoints: servicesDatapoints(),
    obligation: {
      wave: "2",
      jurisdiction: "EU",
      standardVersion: "CSRD_SET1",
      firstReportingFY: "FY2027",
      filingDeadline: "2028-06-30",
    },
  });

  const clients = [
    {
      name: "Helix Packaging",
      slug: "helix-packaging",
      scale: 0.55,
      country: "DE",
      sector: "C22.2",
    },
    {
      name: "Coastal Foods Coop",
      slug: "coastal-foods",
      scale: 0.4,
      country: "NL",
      sector: "C10.8",
    },
    {
      name: "VoltCare Devices",
      slug: "voltcare-devices",
      scale: 0.7,
      country: "PL",
      sector: "C26.6",
    },
    {
      name: "Saffron Textiles",
      slug: "saffron-textiles",
      scale: 0.85,
      country: "IN",
      sector: "C13.2",
    },
  ] as const;

  for (const client of clients) {
    await seedOrgBundle(payload, {
      name: client.name,
      slug: client.slug,
      type: "company",
      sector: client.sector,
      country: client.country,
      employeeCount: Math.round(120 * client.scale),
      revenueBand: "2_10m",
      plan: "free",
      parentOrg: consultancy.id,
      ownerId: owner.id,
      datapoints: clientDatapoints(client.scale),
      obligation: {
        wave: "3",
        jurisdiction: client.country === "IN" ? "IN" : "EU",
        standardVersion: client.country === "IN" ? "BRSR" : "CSRD_SIMPLIFIED",
        firstReportingFY: "FY2028",
        filingDeadline: "2029-06-30",
      },
    });
  }

  console.log("Seed complete.");
  console.log(`Demo user: ${demoEmail} / ClearESG-demo-change-me`);
  process.exit(0);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
