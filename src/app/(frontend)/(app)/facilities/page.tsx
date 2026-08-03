import { redirect } from "next/navigation";

import { createTranslator } from "@/lib/i18n";
import { getCurrentContext } from "@/lib/auth";

import { FacilitiesClient } from "./FacilitiesClient";

export const metadata = {
  title: "Facilities | ClearESG",
};

export default async function FacilitiesPage() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) redirect("/onboarding");
  if (!ctx.activeOrg.onboardedAt) redirect("/onboarding");

  const t = createTranslator(ctx.user.language);
  const canWrite =
    ctx.role === "owner" || ctx.role === "admin" || ctx.role === "contributor";
  const canDelete = ctx.role === "owner" || ctx.role === "admin";

  return (
    <FacilitiesClient
      orgName={ctx.activeOrg.name}
      canWrite={canWrite}
      canDelete={canDelete}
      eyebrow={t("facilities.eyebrow")}
      title={t("facilities.title")}
      help={t("facilities.help")}
    />
  );
}
