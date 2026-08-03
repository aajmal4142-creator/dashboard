import { redirect } from "next/navigation";

import { FactorsClient } from "@/app/(frontend)/(app)/settings/factors/FactorsClient";
import { PageFrame } from "@/components/shell/PageFrame";
import { getCurrentContext } from "@/lib/auth";
import { createTranslator } from "@/lib/i18n";

export default async function FactorsSettingsPage() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) redirect("/onboarding");

  const t = createTranslator(ctx.user.language);
  const canEdit = ctx.role === "owner" || ctx.role === "admin";

  return (
    <PageFrame
      eyebrow={t("settings.eyebrow")}
      title={t("settings.factors.title")}
      help={t("settings.factors.help")}
    >
      <FactorsClient canEdit={canEdit} />
    </PageFrame>
  );
}
