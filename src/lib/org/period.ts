import { getPayload } from "payload";

import {
  BillingDeniedError,
  limits,
  normalizePlan,
  resolveEffectivePlan,
} from "@/lib/billing";
import config from "@/payload.config";

export async function ensureOpenPeriod(
  organisationId: string,
  plan?: string | null,
  subscriptionStatus?: string | null,
): Promise<string> {
  const payload = await getPayload({ config });
  const periods = await payload.find({
    collection: "reporting-periods",
    where: {
      and: [{ organisation: { equals: organisationId } }, { status: { equals: "open" } }],
    },
    limit: 1,
    overrideAccess: true,
  });
  if (periods.docs[0]) return periods.docs[0].id;

  const effective = resolveEffectivePlan({ plan, subscriptionStatus });
  const all = await payload.find({
    collection: "reporting-periods",
    where: { organisation: { equals: organisationId } },
    limit: 1,
    overrideAccess: true,
  });
  const max = limits(effective).maxPeriods;
  if (all.totalDocs >= max) {
    throw new BillingDeniedError(normalizePlan(effective), "unlimited_periods");
  }

  const year = new Date().getFullYear();
  const period = await payload.create({
    collection: "reporting-periods",
    data: {
      organisation: organisationId,
      label: `FY${year}`,
      startDate: `${year - 1}-04-01`,
      endDate: `${year}-03-31`,
      status: "open",
    },
    overrideAccess: true,
  });
  return period.id;
}
