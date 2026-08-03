import { redirect } from "next/navigation";

import { ApprovalsClient } from "@/app/(frontend)/(app)/approvals/ApprovalsClient";
import { PageFrame } from "@/components/shell/PageFrame";
import { getCurrentContext } from "@/lib/auth";
import { createTranslator } from "@/lib/i18n/t";
import { resolveLocale } from "@/lib/i18n/locales";

export default async function ApprovalsPage() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) redirect("/onboarding");

  const canAct =
    ctx.role === "owner" || ctx.role === "admin" || ctx.role === "contributor";
  const t = createTranslator(resolveLocale(ctx.user?.language));

  return (
    <PageFrame
      eyebrow={t("approvals.eyebrow")}
      title={t("approvals.title")}
      help={t("approvals.help")}
    >
      <ApprovalsClient canAct={canAct} />
    </PageFrame>
  );
}
