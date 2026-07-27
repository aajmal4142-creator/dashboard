import { redirect } from "next/navigation";
import { getPayload } from "payload";

import { MaterialityWorkshop } from "@/app/(frontend)/dashboard/materiality/MaterialityWorkshop";
import { getCurrentContext } from "@/lib/auth";
import { BillingDeniedError } from "@/lib/billing";
import { ESRS_TOPICS } from "@/lib/materiality";
import { ensureOpenPeriod } from "@/lib/org/period";
import config from "@/payload.config";

export default async function MaterialityPage() {
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
  const found = await payload.find({
    collection: "materiality-assessments",
    where: {
      and: [
        { organisation: { equals: ctx.activeOrg.id } },
        { period: { equals: periodId } },
      ],
    },
    limit: 1,
    overrideAccess: true,
  });

  const canWrite = ctx.role === "owner" || ctx.role === "admin";

  return (
    <MaterialityWorkshop
      canWrite={canWrite}
      sector={ctx.activeOrg.sector ?? ""}
      initialAssessment={
        found.docs[0]
          ? {
              topics: found.docs[0].topics,
              status: found.docs[0].status,
              narrative: found.docs[0].narrative,
            }
          : null
      }
      topicsCatalog={ESRS_TOPICS}
    />
  );
}
