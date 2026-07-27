import { redirect } from "next/navigation";
import { getPayload } from "payload";

import {
  SuppliersClient,
  type SupplierRow,
} from "@/app/(frontend)/dashboard/suppliers/SuppliersClient";
import { getCurrentContext } from "@/lib/auth";
import { responseRatePct, spendCoveragePct } from "@/lib/suppliers";
import config from "@/payload.config";

export default async function SuppliersPage() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) redirect("/dashboard/onboarding");
  if (!ctx.activeOrg.onboardedAt) redirect("/dashboard/onboarding");

  const payload = await getPayload({ config });
  const result = await payload.find({
    collection: "suppliers",
    where: { organisation: { equals: ctx.activeOrg.id } },
    limit: 200,
    sort: "-updatedAt",
    overrideAccess: true,
  });

  const initialSuppliers: SupplierRow[] = result.docs.map((s) => ({
    id: s.id,
    name: s.name,
    contactEmail: s.contactEmail,
    category: s.category,
    annualSpend: s.annualSpend ?? null,
    requestStatus: s.requestStatus ?? "not_sent",
    requestToken: s.requestToken ?? null,
    reminderCount: s.reminderCount ?? 0,
  }));

  return (
    <SuppliersClient
      initialSuppliers={initialSuppliers}
      initialCoveragePct={spendCoveragePct(initialSuppliers)}
      initialResponseRatePct={responseRatePct(initialSuppliers)}
      canWrite={ctx.role !== "viewer" && ctx.role !== null}
    />
  );
}
