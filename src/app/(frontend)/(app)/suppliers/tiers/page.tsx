import { redirect } from "next/navigation";
import { getPayload } from "payload";

import { TieringDashboardClient } from "./TieringDashboardClient";
import { getCurrentContext } from "@/lib/auth";
import {
  categorizeBulk,
  calculateTierDistribution,
} from "@/lib/suppliers/categorizationEngine";
import config from "@/payload.config";

export const metadata = {
  title: "Supplier Tiers | ClearESG",
};

export default async function TieringPage() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) redirect("/onboarding");
  if (!ctx.activeOrg.onboardedAt) redirect("/onboarding");

  const payload = await getPayload({ config });
  const suppliers = await payload.find({
    collection: "suppliers",
    where: { organisation: { equals: ctx.activeOrg.id } },
    limit: 500,
    sort: "-annualSpend",
    overrideAccess: true,
  });

  const categorizationData = suppliers.docs.map((s) => ({
    id: String(s.id),
    name: s.name,
    annualSpend: s.annualSpend ?? undefined,
    requestToken: s.requestToken ?? undefined,
    respondedAt: s.respondedAt ? new Date(s.respondedAt) : undefined,
  }));

  const { results, summary } = categorizeBulk(categorizationData);

  const suppliersByTier = results.map((r) => ({
    id: r.id,
    name: r.name,
    tier: r.categorization.tier,
    spend: categorizationData.find((s) => s.id === r.id)?.annualSpend ?? 0,
    importance: r.categorization.importance,
    template: r.categorization.suggestedTemplate,
    slaTargetDays: r.categorization.slaTargetDays,
  }));

  const distribution = calculateTierDistribution(suppliersByTier);

  return (
    <TieringDashboardClient
      suppliers={suppliersByTier}
      distribution={distribution}
      summary={summary}
    />
  );
}
