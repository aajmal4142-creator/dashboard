import { redirect } from "next/navigation";

import { createTranslator, resolveLocale } from "@/lib/i18n";
import { getCurrentContext } from "@/lib/auth";

import { AssuranceEngagementsClient } from "./AssuranceEngagementsClient";

export const metadata = {
  title: "Assurance engagements | ClearESG",
};

export default async function AssuranceEngagementsPage() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) redirect("/onboarding");
  if (!ctx.activeOrg.onboardedAt) redirect("/onboarding");

  const t = createTranslator(resolveLocale(ctx.user?.language));
  const canWrite =
    ctx.role === "owner" || ctx.role === "admin" || ctx.role === "contributor";

  return (
    <AssuranceEngagementsClient
      canWrite={canWrite}
      eyebrow={t("assuranceEngagements.eyebrow")}
      title={t("assuranceEngagements.title")}
      help={t("assuranceEngagements.help")}
    />
  );
}
