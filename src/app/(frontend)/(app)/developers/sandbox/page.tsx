import { redirect } from "next/navigation";

import { PageFrame } from "@/components/shell/PageFrame";
import { getCurrentContext } from "@/lib/auth";
import { createTranslator } from "@/lib/i18n/t";
import { resolveLocale } from "@/lib/i18n/locales";

import { SandboxClient } from "./SandboxClient";

export const metadata = {
  title: "API sandbox | ClearESG",
};

export default async function ApiSandboxPage() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) redirect("/onboarding");
  if (!ctx.activeOrg.onboardedAt) redirect("/onboarding");

  const t = createTranslator(resolveLocale(ctx.user?.language));

  return (
    <PageFrame
      eyebrow={t("apiSandbox.eyebrow")}
      title={t("apiSandbox.title")}
      help={t("apiSandbox.help")}
    >
      <SandboxClient />
    </PageFrame>
  );
}
