import { redirect } from "next/navigation";

import { PageFrame } from "@/components/shell/PageFrame";
import { getCurrentContext } from "@/lib/auth";
import { createTranslator } from "@/lib/i18n/t";
import { resolveLocale } from "@/lib/i18n/locales";

import { TargetCascadeClient } from "./TargetCascadeClient";

export const metadata = {
  title: "Target cascade | ClearESG",
};

export default async function TargetCascadePage() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) redirect("/onboarding");
  if (!ctx.activeOrg.onboardedAt) redirect("/onboarding");

  const canWrite =
    ctx.role === "owner" || ctx.role === "admin" || ctx.role === "contributor";
  const canDelete = ctx.role === "owner" || ctx.role === "admin";
  const t = createTranslator(resolveLocale(ctx.user?.language));

  return (
    <PageFrame
      eyebrow={t("targetCascade.eyebrow")}
      title={t("targetCascade.title")}
      help={t("targetCascade.help")}
    >
      <TargetCascadeClient canWrite={canWrite} canDelete={canDelete} />
    </PageFrame>
  );
}
