import { redirect } from "next/navigation";

import { PageFrame } from "@/components/shell/PageFrame";
import { getCurrentContext } from "@/lib/auth";
import { createTranslator } from "@/lib/i18n/t";
import { resolveLocale } from "@/lib/i18n/locales";

import { WorkTrackersClient } from "./WorkTrackersClient";

export const metadata = {
  title: "Jira / Linear | ClearESG",
};

export default async function WorkTrackersPage() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) redirect("/onboarding");
  if (!ctx.activeOrg.onboardedAt) redirect("/onboarding");

  const t = createTranslator(resolveLocale(ctx.user?.language));
  const canManage = ctx.role === "owner" || ctx.role === "admin";

  return (
    <PageFrame
      eyebrow={t("workTrackers.eyebrow")}
      title={t("workTrackers.title")}
      help={t("workTrackers.help")}
    >
      <WorkTrackersClient canManage={canManage} />
    </PageFrame>
  );
}
