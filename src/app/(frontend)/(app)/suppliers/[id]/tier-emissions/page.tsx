import { notFound, redirect } from "next/navigation";
import { getPayload } from "payload";

import { TierEmissionsClient } from "./TierEmissionsClient";
import { getCurrentContext } from "@/lib/auth";
import config from "@/payload.config";

export const metadata = {
  title: "Tier 2 emissions | ClearESG",
};

export default async function TierEmissionsPage({
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

  const orgId =
    typeof supplier.organisation === "object" && supplier.organisation !== null
      ? String(supplier.organisation.id)
      : String(supplier.organisation);

  if (!supplier || orgId !== ctx.activeOrg.id) {
    notFound();
  }

  const doc = supplier as {
    id: string;
    name: string;
    contactEmail: string;
    tier?: number | null;
    directSpend?: number | null;
    annualSpend?: number | null;
    naceCode?: string | null;
    industryIntensityOverride?: number | null;
    estimatedEmissions?: number | null;
    estimationMethod?: string | null;
    estimationConfidence?: string | null;
    emailConsent?: boolean | null;
  };

  return (
    <TierEmissionsClient
      canWrite={ctx.role !== "viewer"}
      supplier={{
        id: String(doc.id),
        name: doc.name,
        contactEmail: doc.contactEmail,
        tier: doc.tier ?? null,
        directSpend: doc.directSpend ?? null,
        annualSpend: doc.annualSpend ?? null,
        naceCode: doc.naceCode ?? null,
        industryIntensityOverride: doc.industryIntensityOverride ?? null,
        estimatedEmissions: doc.estimatedEmissions ?? null,
        estimationMethod: doc.estimationMethod ?? null,
        estimationConfidence: doc.estimationConfidence ?? null,
        emailConsent: doc.emailConsent === true,
      }}
    />
  );
}
