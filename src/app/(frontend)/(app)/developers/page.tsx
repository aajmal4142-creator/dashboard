import { redirect } from "next/navigation";

import { getCurrentContext } from "@/lib/auth";
import { createTranslator } from "@/lib/i18n";

import { DevelopersClient } from "./DevelopersClient";

export default async function DevelopersPage() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) redirect("/onboarding");

  const t = createTranslator(ctx.user.language);

  return (
    <DevelopersClient
      eyebrow={t("developers.eyebrow")}
      title={t("developers.title")}
      help={t("developers.help")}
    />
  );
}
