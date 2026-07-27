import { redirect } from "next/navigation";
import { getPayload } from "payload";

import { ConsultantCentre } from "@/app/(frontend)/dashboard/consultant/ConsultantCentre";
import { getCurrentContext } from "@/lib/auth";
import { riskOf, sortByDeadlineRisk, type ClientRiskRow } from "@/lib/consultant";
import { SECTOR_TEMPLATES } from "@/lib/consultant/templates";
import config from "@/payload.config";

function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

export default async function ConsultantPage() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) redirect("/dashboard/onboarding");
  if (!ctx.activeOrg.onboardedAt) redirect("/dashboard/onboarding");
  if (ctx.activeOrg.type !== "consultancy") {
    redirect("/dashboard");
  }

  const payload = await getPayload({ config });
  const children = await payload.find({
    collection: "organisations",
    where: { parentOrg: { equals: ctx.activeOrg.id } },
    limit: 200,
    overrideAccess: true,
  });

  const rows: ClientRiskRow[] = [];
  for (const child of children.docs) {
    const obligations = await payload.find({
      collection: "compliance-obligations",
      where: { organisation: { equals: child.id } },
      limit: 1,
      sort: "filingDeadline",
      overrideAccess: true,
    });
    const deadline = obligations.docs[0]?.filingDeadline
      ? String(obligations.docs[0].filingDeadline)
      : null;
    const days = deadline ? daysUntil(deadline) : null;

    const periods = await payload.find({
      collection: "reporting-periods",
      where: {
        and: [{ organisation: { equals: child.id } }, { status: { equals: "open" } }],
      },
      limit: 1,
      overrideAccess: true,
    });
    let collected = 0;
    if (periods.docs[0]) {
      const dps = await payload.find({
        collection: "datapoints",
        where: {
          and: [
            { organisation: { equals: child.id } },
            { period: { equals: periods.docs[0].id } },
            { quality: { not_equals: "missing" } },
          ],
        },
        limit: 100,
        overrideAccess: true,
      });
      collected = dps.docs.length;
    }

    const reports = await payload.find({
      collection: "reports",
      where: {
        and: [
          { organisation: { equals: child.id } },
          { status: { equals: "published" } },
        ],
      },
      sort: "-version",
      limit: 1,
      overrideAccess: true,
    });

    const required = 18;
    rows.push({
      id: child.id,
      name: child.name,
      slug: child.slug,
      sector: child.sector,
      country: child.country,
      plan: child.plan ?? "free",
      daysToFiling: days,
      datapointsCollected: collected,
      datapointsRequired: required,
      overallScore: reports.docs[0]?.scores?.overall ?? null,
      risk: riskOf(days, collected, required),
    });
  }

  return (
    <ConsultantCentre
      initialClients={sortByDeadlineRisk(rows)}
      consultancy={{
        name: ctx.activeOrg.name,
        plan: ctx.activeOrg.plan,
        clientCount: rows.length,
        clientCap: ctx.activeOrg.plan === "consultant" ? 10 : 3,
        brand: {
          primaryColor: ctx.activeOrg.brand.primaryColor,
          domain: ctx.activeOrg.brand.domain,
        },
      }}
      templates={SECTOR_TEMPLATES}
      canWrite={ctx.role !== "viewer" && ctx.role !== null}
    />
  );
}
