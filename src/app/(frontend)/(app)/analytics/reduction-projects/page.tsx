import { redirect } from "next/navigation";

import { createTranslator } from "@/lib/i18n";
import { getCurrentContext } from "@/lib/auth";

import { ReductionProjectsClient } from "./ReductionProjectsClient";

export const metadata = {
  title: "Reduction projects | ClearESG",
};

export default async function ReductionProjectsPage() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) redirect("/onboarding");
  if (!ctx.activeOrg.onboardedAt) redirect("/onboarding");

  const t = createTranslator(ctx.user.language);
  const canWrite =
    ctx.role === "owner" || ctx.role === "admin" || ctx.role === "contributor";
  const canDelete = ctx.role === "owner" || ctx.role === "admin";

  return (
    <ReductionProjectsClient
      orgName={ctx.activeOrg.name}
      canWrite={canWrite}
      canDelete={canDelete}
      eyebrow={t("reductionProjects.eyebrow")}
      title={t("reductionProjects.title")}
      help={t("reductionProjects.help")}
    />
  );
}
