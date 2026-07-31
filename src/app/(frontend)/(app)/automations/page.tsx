import { redirect } from "next/navigation";

import { AutomationsClient } from "@/app/(frontend)/(app)/automations/AutomationsClient";
import { PageFrame } from "@/components/shell/PageFrame";
import { getCurrentContext } from "@/lib/auth";
import { createTranslator } from "@/lib/i18n/t";
import { resolveLocale } from "@/lib/i18n/locales";

export default async function AutomationsPage() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) redirect("/onboarding");

  const canEdit = ctx.role === "owner" || ctx.role === "admin";
  const canRun =
    ctx.role === "owner" || ctx.role === "admin" || ctx.role === "contributor";
  const t = createTranslator(resolveLocale(ctx.user?.language));

  return (
    <PageFrame
      eyebrow={t("automations.eyebrow")}
      title={t("automations.title")}
      help={t("automations.help")}
    >
      <AutomationsClient canEdit={canEdit} canRun={canRun} />
    </PageFrame>
  );
}
