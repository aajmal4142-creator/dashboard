import { getPayload } from "payload";

import { SupplierPublicForm, type SupplierFormMeta } from "./SupplierPublicForm";
import { isTokenExpired } from "@/lib/suppliers";
import config from "@/payload.config";

export default async function SupplierTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const payload = await getPayload({ config });
  const found = await payload.find({
    collection: "suppliers",
    where: { requestToken: { equals: token } },
    limit: 1,
    depth: 1,
    overrideAccess: true,
  });
  const supplier = found.docs[0];

  let initial: SupplierFormMeta;
  if (!supplier) {
    initial = {
      orgName: "",
      supplierName: "",
      expired: false,
      used: false,
      expiresAt: null,
      error: "This link is not valid.",
    };
  } else {
    if (supplier.requestStatus === "sent") {
      await payload.update({
        collection: "suppliers",
        id: supplier.id,
        data: { requestStatus: "opened" },
        overrideAccess: true,
      });
    }
    const org =
      typeof supplier.organisation === "object" && supplier.organisation !== null
        ? supplier.organisation
        : null;
    initial = {
      orgName: org && "name" in org ? String(org.name) : "ClearESG customer",
      supplierName: supplier.name,
      expired: isTokenExpired(
        supplier.requestExpiresAt ? String(supplier.requestExpiresAt) : null,
      ),
      used: false,
      alreadySubmitted: supplier.requestStatus === "submitted",
      expiresAt: supplier.requestExpiresAt ? String(supplier.requestExpiresAt) : null,
    };
  }

  return (
    <div className="min-h-full bg-canvas">
      <SupplierPublicForm token={token} initial={initial} />
    </div>
  );
}
