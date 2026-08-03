import { redirect } from "next/navigation";

import { getCurrentContext } from "@/lib/auth";
import { createTranslator } from "@/lib/i18n";
import { canApplyMarketplace } from "@/lib/templates/marketplace";

import { MarketplaceClient } from "./MarketplaceClient";

export default async function TemplateMarketplacePage() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) redirect("/onboarding");
  if (!ctx.activeOrg.onboardedAt) redirect("/onboarding");

  const t = createTranslator(ctx.user.language);

  return (
    <MarketplaceClient
      canApply={canApplyMarketplace(ctx.role)}
      labels={{
        eyebrow: t("marketplace.eyebrow"),
        title: t("marketplace.title"),
        help: t("marketplace.help"),
        search: t("marketplace.search"),
        industry: t("marketplace.industry"),
        kind: t("marketplace.kind"),
        all: t("marketplace.all"),
        apply: t("marketplace.apply"),
        applying: t("marketplace.applying"),
        applied: t("marketplace.applied"),
        viewOnly: t("marketplace.viewOnly"),
        emptyTitle: t("marketplace.emptyTitle"),
        emptyHelp: t("marketplace.emptyHelp"),
        errorLoad: t("marketplace.errorLoad"),
        applyOk: t("marketplace.applyOk"),
        applyFailed: t("marketplace.applyFailed"),
        refresh: t("marketplace.refresh"),
        retry: t("marketplace.retry"),
        questions: t("marketplace.questions"),
        metrics: t("marketplace.metrics"),
        sections: t("marketplace.sections"),
        free: t("marketplace.free"),
        appliedHistory: t("marketplace.appliedHistory"),
        noHistory: t("marketplace.noHistory"),
        openLibrary: t("marketplace.openLibrary"),
      }}
    />
  );
}
