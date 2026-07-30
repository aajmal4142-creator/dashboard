import { getPayload } from "payload";

import { SupplierPublicForm, type SupplierFormMeta } from "./SupplierPublicForm";
import { resolvePortalChrome } from "@/lib/portal";
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
      branding: { primaryColor: null, logoUrl: null },
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

    const chrome = await resolvePortalChrome(
      payload,
      org
        ? {
            id: String(org.id),
            name: "name" in org ? String(org.name) : null,
            brand: "brand" in org ? org.brand : undefined,
            settings: "settings" in org ? org.settings : undefined,
          }
        : null,
    );

    initial = {
      orgName: chrome.orgName,
      supplierName: supplier.name,
      expired: isTokenExpired(
        supplier.requestExpiresAt ? String(supplier.requestExpiresAt) : null,
      ),
      used: false,
      alreadySubmitted: supplier.requestStatus === "submitted",
      expiresAt: supplier.requestExpiresAt ? String(supplier.requestExpiresAt) : null,
      portalPaused: !chrome.portal.enabled,
      branding: chrome.branding,
      portal: chrome.portal,
    };
  }

  return <SupplierPublicForm token={token} initial={initial} />;
}
