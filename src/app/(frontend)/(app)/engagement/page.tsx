import { redirect } from "next/navigation";

import { createTranslator } from "@/lib/i18n";
import { getCurrentContext } from "@/lib/auth";

import { EngagementClient } from "./EngagementClient";

export const metadata = {
  title: "Employee engagement | ClearESG",
};

export default async function EngagementPage() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) redirect("/onboarding");
  if (!ctx.activeOrg.onboardedAt) redirect("/onboarding");

  const t = createTranslator(ctx.user.language);
  const canWrite =
    ctx.role === "owner" || ctx.role === "admin" || ctx.role === "contributor";
  const canDelete = ctx.role === "owner" || ctx.role === "admin";

  return (
    <EngagementClient
      orgName={ctx.activeOrg.name}
      canWrite={canWrite}
      canDelete={canDelete}
      eyebrow={t("engagement.eyebrow")}
      title={t("engagement.title")}
      help={t("engagement.help")}
    />
  );
}
