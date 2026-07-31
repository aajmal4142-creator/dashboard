import { redirect } from "next/navigation";

import { AlertsClient } from "@/app/(frontend)/(app)/alerts/AlertsClient";
import { PageFrame } from "@/components/shell/PageFrame";
import { getCurrentContext } from "@/lib/auth";
import { createTranslator } from "@/lib/i18n/t";
import { resolveLocale } from "@/lib/i18n/locales";

export default async function AlertsPage() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) redirect("/onboarding");

  const canEdit = ctx.role === "owner" || ctx.role === "admin";
  const canEvaluate =
    ctx.role === "owner" || ctx.role === "admin" || ctx.role === "contributor";
  const t = createTranslator(resolveLocale(ctx.user?.language));

  return (
    <PageFrame
      eyebrow={t("alerts.eyebrow")}
      title={t("alerts.title")}
      help={t("alerts.help")}
    >
      <AlertsClient canEdit={canEdit} canEvaluate={canEvaluate} />
    </PageFrame>
  );
}
