import { notFound, redirect } from "next/navigation";
import { getPayload } from "payload";

import { RiskBreakdownClient } from "./RiskBreakdownClient";
import { getCurrentContext } from "@/lib/auth";
import { calculateRiskScore } from "@/lib/suppliers";
import config from "@/payload.config";

export const metadata = {
  title: "Risk breakdown | ClearESG",
};

export default async function RiskBreakdownPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) redirect("/onboarding");

  const payload = await getPayload({ config });
  const supplier = await payload.findByID({
    collection: "suppliers",
    id,
    overrideAccess: true,
  });

  if (
    !supplier ||
    (typeof supplier.organisation === "object" && supplier.organisation !== null
      ? String(supplier.organisation.id)
      : String(supplier.organisation)) !== ctx.activeOrg.id
  ) {
    notFound();
  }

  const breakdown = await calculateRiskScore(id);

  return (
    <RiskBreakdownClient
      supplier={{
        id: String(supplier.id),
        name: supplier.name,
        category: supplier.category,
        annualSpend: supplier.annualSpend ?? null,
        contactEmail: supplier.contactEmail,
      }}
      breakdown={breakdown}
    />
  );
}
