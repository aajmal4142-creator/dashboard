import { notFound, redirect } from "next/navigation";
import { getPayload } from "payload";

import { SupplierScorecardClient } from "./SupplierScorecardClient";
import { getCurrentContext } from "@/lib/auth";
import config from "@/payload.config";

export const metadata = {
  title: "Supplier scorecard | ClearESG",
};

export default async function SupplierScorecardPage({
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
    typeof supplier?.organisation === "object" && supplier.organisation !== null
      ? String(supplier.organisation.id)
      : String(supplier?.organisation ?? "");

  if (!supplier || orgId !== ctx.activeOrg.id) {
    notFound();
  }

  return (
    <SupplierScorecardClient
      supplier={{
        id: String(supplier.id),
        name: String(supplier.name),
      }}
    />
  );
}
