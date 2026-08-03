import { redirect } from "next/navigation";

import { createTranslator } from "@/lib/i18n";
import { getCurrentContext } from "@/lib/auth";

import { ProductFootprintsClient } from "./ProductFootprintsClient";

export const metadata = {
  title: "Product footprints | ClearESG",
};

export default async function ProductFootprintsPage() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) redirect("/onboarding");
  if (!ctx.activeOrg.onboardedAt) redirect("/onboarding");

  const t = createTranslator(ctx.user.language);
  const canWrite =
    ctx.role === "owner" || ctx.role === "admin" || ctx.role === "contributor";
  const canDelete = ctx.role === "owner" || ctx.role === "admin";

  return (
    <ProductFootprintsClient
      orgName={ctx.activeOrg.name}
      canWrite={canWrite}
      canDelete={canDelete}
      eyebrow={t("productFootprints.eyebrow")}
      title={t("productFootprints.title")}
      help={t("productFootprints.help")}
    />
  );
}
