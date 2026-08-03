import { redirect } from "next/navigation";

import { createTranslator } from "@/lib/i18n";
import { getCurrentContext } from "@/lib/auth";

import { PoliciesClient } from "./PoliciesClient";

export const metadata = {
  title: "Policy library | ClearESG",
};

export default async function PoliciesPage() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) redirect("/onboarding");
  if (!ctx.activeOrg.onboardedAt) redirect("/onboarding");

  const t = createTranslator(ctx.user.language);
  const canWrite =
    ctx.role === "owner" || ctx.role === "admin" || ctx.role === "contributor";
  const canDelete = ctx.role === "owner" || ctx.role === "admin";

  return (
    <PoliciesClient
      orgName={ctx.activeOrg.name}
      canWrite={canWrite}
      canDelete={canDelete}
      eyebrow={t("policies.eyebrow")}
      title={t("policies.title")}
      help={t("policies.help")}
      emptyTitle={t("policies.emptyTitle")}
      emptyHelp={t("policies.emptyHelp")}
      errorLoad={t("policies.errorLoad")}
      viewOnly={t("policies.viewOnly")}
    />
  );
}
