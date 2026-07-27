import { redirect } from "next/navigation";
import { getPayload } from "payload";

import { ReportsClient } from "@/app/(frontend)/dashboard/reports/ReportsClient";
import { getCurrentContext } from "@/lib/auth";
import { BillingDeniedError } from "@/lib/billing";
import { ensureOpenPeriod } from "@/lib/org/period";
import { ensureAssuranceToken } from "@/lib/reports/ensureAssuranceToken";
import config from "@/payload.config";

export default async function ReportsPage() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) redirect("/dashboard/onboarding");
  if (!ctx.activeOrg.onboardedAt) redirect("/dashboard/onboarding");

  const payload = await getPayload({ config });
  let periodId: string;
  try {
    periodId = await ensureOpenPeriod(
      ctx.activeOrg.id,
      ctx.activeOrg.plan,
      ctx.activeOrg.subscriptionStatus,
    );
  } catch (err) {
    if (err instanceof BillingDeniedError) redirect("/dashboard/billing");
    throw err;
  }
  const reports = await payload.find({
    collection: "reports",
    where: {
      and: [
        { organisation: { equals: ctx.activeOrg.id } },
        { period: { equals: periodId } },
      ],
    },
    sort: "-version",
    limit: 20,
    overrideAccess: true,
  });

  const canPublish = ctx.role === "owner" || ctx.role === "admin";

  const initial = await Promise.all(
    reports.docs.map(async (r) => ({
      id: r.id,
      version: r.version,
      status: r.status,
      framework: r.framework,
      shareToken: r.shareToken ?? null,
      assuranceToken: await ensureAssuranceToken(payload, r),
      publishedAt: r.publishedAt ? String(r.publishedAt) : null,
      scores: r.scores,
      viewCount: r.viewCount ?? 0,
    })),
  );

  return <ReportsClient canPublish={canPublish} initial={initial} />;
}
