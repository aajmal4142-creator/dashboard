import { redirect } from "next/navigation";

import { PageFrame } from "@/components/shell/PageFrame";
import { getCurrentContext } from "@/lib/auth";
import { createTranslator } from "@/lib/i18n/t";
import { resolveLocale } from "@/lib/i18n/locales";

import { EmailImportClient } from "./EmailImportClient";

export const metadata = {
  title: "Email data collection | ClearESG",
};

export default async function EmailImportPage() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) redirect("/onboarding");
  if (!ctx.activeOrg.onboardedAt) redirect("/onboarding");

  const t = createTranslator(resolveLocale(ctx.user?.language));
  const canEdit =
    ctx.role === "owner" || ctx.role === "admin" || ctx.role === "contributor";
  const canViewLogs = ctx.role === "owner" || ctx.role === "admin";

  return (
    <PageFrame
      eyebrow={t("emailImport.eyebrow")}
      title={t("emailImport.title")}
      help={t("emailImport.help")}
    >
      <EmailImportClient canEdit={canEdit} canViewLogs={canViewLogs} />
    </PageFrame>
  );
}
