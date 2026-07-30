import { getPayload } from "payload";
import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import config from "@/payload.config";
import {
  calculateTaxonomyAlignment,
  generateSFDRArticle10,
  listAlignedMetrics,
} from "@/lib/frameworks/euTaxonomy";
import type { Datapoint } from "@/payload-types";

function groupActivitiesByMetric(
  docs: Datapoint[],
): Array<{ metricKey: string; value: number }> {
  const groupedByMetric: Record<string, { sum: number; count: number }> = {};

  docs.forEach((dp) => {
    const metricKey = dp.metricKey;
    const value = dp.value ?? 0;
    if (!groupedByMetric[metricKey]) {
      groupedByMetric[metricKey] = { sum: 0, count: 0 };
    }
    groupedByMetric[metricKey].sum += value;
    groupedByMetric[metricKey].count += 1;
  });

  return Object.entries(groupedByMetric).map(([key, data]) => ({
    metricKey: key,
    value: data.sum,
  }));
}

export async function GET(req: Request) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.activeOrg) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const url = new URL(req.url);
    const periodId = url.searchParams.get("periodId");
    const includeFinancial = url.searchParams.get("includeFinancial") === "true";

    const payload = await getPayload({ config });

    if (!periodId) {
      // Return aligned metrics reference
      return NextResponse.json({
        alignedMetrics: listAlignedMetrics(),
        sectors: [
          "Agriculture, forestry and fishing",
          "Manufacturing",
          "Energy",
          "Water supply, sewerage and waste",
          "Construction",
          "Transport",
          "Information and communication",
          "Professional, scientific and technical activities",
          "Other economic activities",
        ],
      });
    }

    // Get datapoints for the period
    const datapoints = await payload.find({
      collection: "datapoints",
      where: {
        and: [
          { organisation: { equals: ctx.activeOrg.id } },
          { period: { equals: periodId } },
        ],
      },
      limit: 10000,
      overrideAccess: true,
    });

    const activities = groupActivitiesByMetric(datapoints.docs);
    const financialValues: Record<string, number> = {};

    if (includeFinancial) {
      activities.forEach((activity) => {
        // Estimate financial value based on common rates
        financialValues[activity.metricKey] = activity.value * 0.1; // Placeholder multiplier
      });
    }

    // Calculate alignment
    const alignment = calculateTaxonomyAlignment(
      activities,
      includeFinancial ? financialValues : undefined,
    );

    // Generate SFDR Article 10 disclosure
    const sfdrText = generateSFDRArticle10(alignment);

    return NextResponse.json({
      alignment,
      sfdrDisclosure: {
        article10Text: sfdrText,
        disclosureDate: new Date().toISOString(),
        regulatoryFramework: "EU Taxonomy Regulation (EU) 2020/852",
        sfdrRegulation: "Regulation (EU) 2019/2088",
      },
    });
  } catch (error) {
    console.error("Taxonomy alignment error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.activeOrg) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await req.json()) as {
      periodId?: string;
      metrics?: Array<{ key: string; value: number }>;
      financialValues?: Record<string, number>;
    };

    const { periodId, metrics: metricsInput, financialValues } = body;

    // Either use provided metrics or fetch from datapoints
    let activities: Array<{ metricKey: string; value: number }> = [];

    if (metricsInput) {
      activities = metricsInput.map((m) => ({
        metricKey: m.key,
        value: m.value,
      }));
    } else if (periodId) {
      const payload = await getPayload({ config });
      const datapoints = await payload.find({
        collection: "datapoints",
        where: {
          and: [
            { organisation: { equals: ctx.activeOrg.id } },
            { period: { equals: periodId } },
          ],
        },
        limit: 10000,
        overrideAccess: true,
      });

      activities = groupActivitiesByMetric(datapoints.docs);
    }

    const alignment = calculateTaxonomyAlignment(activities, financialValues);

    const sfdrText = generateSFDRArticle10(alignment);

    return NextResponse.json({
      alignment,
      sfdrDisclosure: {
        article10Text: sfdrText,
        disclosureDate: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Taxonomy calculation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
