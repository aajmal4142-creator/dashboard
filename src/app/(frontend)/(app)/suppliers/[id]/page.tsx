import { notFound, redirect } from "next/navigation";
import { getPayload } from "payload";

import { SupplierDetailClient } from "./SupplierDetailClient";
import { getCurrentContext } from "@/lib/auth";
import { isSbtiStatus, parseEnforcementFlag } from "@/lib/suppliers";
import config from "@/payload.config";

export const metadata = {
  title: "Supplier | ClearESG",
};

export default async function SupplierDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) redirect("/onboarding");

  const payload = await getPayload({ config });
  const supplier = await payload
    .findByID({ collection: "suppliers", id, overrideAccess: true })
    .catch(() => null);

  const orgId =
    typeof supplier?.organisation === "object" && supplier.organisation !== null
      ? String(supplier.organisation.id)
      : String(supplier?.organisation ?? "");

  if (!supplier || orgId !== ctx.activeOrg.id) {
    notFound();
  }

  const registryRisk = supplier.registryRisk ?? {};

  return (
    <SupplierDetailClient
      canWrite={ctx.role !== "viewer" && ctx.role !== null}
      supplier={{
        id: String(supplier.id),
        name: supplier.name,
        contactEmail: supplier.contactEmail,
        category: supplier.category,
        annualSpend: supplier.annualSpend ?? null,
        country: supplier.country ?? null,
        openSupplyHubId: supplier.openSupplyHubId ?? null,
        registryRisk: {
          sbtiStatus: isSbtiStatus(registryRisk.sbtiStatus)
            ? registryRisk.sbtiStatus
            : "unknown",
          enforcementFlag: parseEnforcementFlag(registryRisk.enforcementFlag),
          sources: registryRisk.sources ?? "",
          notes: registryRisk.notes ?? null,
          lastReviewedAt: registryRisk.lastReviewedAt ?? null,
        },
      }}
    />
  );
}
