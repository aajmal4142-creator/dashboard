import { redirect } from "next/navigation";
import { getPayload } from "payload";

import { BillingClient } from "@/app/(frontend)/dashboard/billing/BillingClient";
import { getCurrentContext } from "@/lib/auth";
import { getUsageMeters, normalizePlan } from "@/lib/billing";
import config from "@/payload.config";

export default async function BillingPage() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) redirect("/dashboard/onboarding");
  if (!ctx.activeOrg.onboardedAt) redirect("/dashboard/onboarding");

  const payload = await getPayload({ config });
  const org = await payload.findByID({
    collection: "organisations",
    id: ctx.activeOrg.id,
    depth: 0,
    overrideAccess: true,
  });

  const usage = await getUsageMeters(org.id, org.plan);

  return (
    <BillingClient
      role={ctx.role}
      initial={{
        plan: normalizePlan(org.plan),
        subscriptionStatus: org.subscriptionStatus ?? "none",
        usage,
      }}
    />
  );
}
