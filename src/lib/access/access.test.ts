import "dotenv/config";

import { getPayload, type Payload } from "payload";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import config from "@/payload.config";

describe("tenant access control", () => {
  let payload: Payload;
  let userAId: string;
  let userBId: string;
  let orgAId: string;
  let orgBId: string;
  let periodAId: string;
  let periodBId: string;
  let datapointAId: string;
  let datapointBId: string;

  beforeAll(async () => {
    payload = await getPayload({ config });

    const suffix = Date.now().toString(36);

    const userA = await payload.create({
      collection: "users",
      data: {
        email: `access-a-${suffix}@clearesg.test`,
        password: "test-password-a-123456",
        firstName: "Alice",
        lastName: "A",
      },
      overrideAccess: true,
    });
    userAId = userA.id;

    const userB = await payload.create({
      collection: "users",
      data: {
        email: `access-b-${suffix}@clearesg.test`,
        password: "test-password-b-123456",
        firstName: "Bob",
        lastName: "B",
      },
      overrideAccess: true,
    });
    userBId = userB.id;

    const orgA = await payload.create({
      collection: "organisations",
      data: {
        name: `Org A ${suffix}`,
        slug: `org-a-${suffix}`,
        type: "company",
        sector: "C25",
        country: "GB",
        plan: "pro",
      },
      overrideAccess: true,
    });
    orgAId = orgA.id;

    const orgB = await payload.create({
      collection: "organisations",
      data: {
        name: `Org B ${suffix}`,
        slug: `org-b-${suffix}`,
        type: "company",
        sector: "J62",
        country: "IE",
        plan: "pro",
      },
      overrideAccess: true,
    });
    orgBId = orgB.id;

    await payload.create({
      collection: "memberships",
      data: {
        user: userAId,
        organisation: orgAId,
        role: "owner",
        status: "active",
        acceptedAt: new Date().toISOString(),
      },
      overrideAccess: true,
    });

    await payload.create({
      collection: "memberships",
      data: {
        user: userBId,
        organisation: orgBId,
        role: "owner",
        status: "active",
        acceptedAt: new Date().toISOString(),
      },
      overrideAccess: true,
    });

    const periodA = await payload.create({
      collection: "reporting-periods",
      data: {
        organisation: orgAId,
        label: "FY2025",
        startDate: "2024-04-01",
        endDate: "2025-03-31",
        status: "open",
      },
      overrideAccess: true,
    });
    periodAId = periodA.id;

    const periodB = await payload.create({
      collection: "reporting-periods",
      data: {
        organisation: orgBId,
        label: "FY2025",
        startDate: "2024-04-01",
        endDate: "2025-03-31",
        status: "open",
      },
      overrideAccess: true,
    });
    periodBId = periodB.id;

    const dpA = await payload.create({
      collection: "datapoints",
      data: {
        organisation: orgAId,
        period: periodAId,
        metricKey: "electricity_kwh",
        value: 1000,
        unit: "kWh",
        quality: "measured",
        source: "manual",
        supplierKey: "",
      },
      overrideAccess: true,
    });
    datapointAId = dpA.id;

    const dpB = await payload.create({
      collection: "datapoints",
      data: {
        organisation: orgBId,
        period: periodBId,
        metricKey: "electricity_kwh",
        value: 9999,
        unit: "kWh",
        quality: "measured",
        source: "manual",
        supplierKey: "",
      },
      overrideAccess: true,
    });
    datapointBId = dpB.id;
  }, 120_000);

  afterAll(async () => {
    if (!payload) return;
    const cleanup = async (collection: string, id: string) => {
      try {
        await payload.delete({
          collection: collection as "datapoints",
          id,
          overrideAccess: true,
        });
      } catch {
        // ignore
      }
    };
    await cleanup("datapoints", datapointAId);
    await cleanup("datapoints", datapointBId);
    await cleanup("reporting-periods", periodAId);
    await cleanup("reporting-periods", periodBId);
    // memberships / orgs / users left for simplicity in shared Atlas — ok for test DB
  });

  it("user from org A cannot read org B datapoints", async () => {
    const userA = await payload.findByID({
      collection: "users",
      id: userAId,
      overrideAccess: true,
    });

    const result = await payload.find({
      collection: "datapoints",
      user: userA,
      overrideAccess: false,
      limit: 100,
    });

    const ids = result.docs.map((d) => d.id);
    expect(ids).toContain(datapointAId);
    expect(ids).not.toContain(datapointBId);
  });

  it("user from org A cannot read org B by id", async () => {
    const userA = await payload.findByID({
      collection: "users",
      id: userAId,
      overrideAccess: true,
    });

    await expect(
      payload.findByID({
        collection: "datapoints",
        id: datapointBId,
        user: userA,
        overrideAccess: false,
      }),
    ).rejects.toThrow();
  });

  it("user from org A cannot read organisation B", async () => {
    const userA = await payload.findByID({
      collection: "users",
      id: userAId,
      overrideAccess: true,
    });

    const orgs = await payload.find({
      collection: "organisations",
      user: userA,
      overrideAccess: false,
      limit: 100,
    });

    const ids = orgs.docs.map((d) => d.id);
    expect(ids).toContain(orgAId);
    expect(ids).not.toContain(orgBId);
  });
});
