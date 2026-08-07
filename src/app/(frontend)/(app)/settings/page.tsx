import { redirect } from "next/navigation";
import { getPayload } from "payload";

import { SettingsBiKeysClient } from "@/app/(frontend)/(app)/settings/SettingsBiKeysClient";
import { SettingsEmissionsStandardClient } from "@/app/(frontend)/(app)/settings/SettingsEmissionsStandardClient";
import { SettingsLanguageClient } from "@/app/(frontend)/(app)/settings/SettingsLanguageClient";
import { SettingsPortalClient } from "@/app/(frontend)/(app)/settings/SettingsPortalClient";
import { SettingsThemeClient } from "@/app/(frontend)/(app)/settings/SettingsThemeClient";
import { PageFrame } from "@/components/shell/PageFrame";
import { getCurrentContext } from "@/lib/auth";
import { resolveOrgBranding } from "@/lib/branding";
import { resolveOrgEmissionsStandard } from "@/lib/factors";
import { createTranslator } from "@/lib/i18n";
import { getPortalConfigForOrg } from "@/lib/portal";
import config from "@/payload.config";

export default async function SettingsPage() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) redirect("/onboarding");

  const t = createTranslator(ctx.user.language);
  const payload = await getPayload({ config });
  const org = await payload.findByID({
    collection: "organisations",
    id: ctx.activeOrg.id,
    depth: 1,
    overrideAccess: true,
  });

  const branding = resolveOrgBranding(org);
  const emissionsStandard = resolveOrgEmissionsStandard(org);
  const { config: portal } = await getPortalConfigForOrg(payload, ctx.activeOrg.id);
  const canEdit = ctx.role === "owner" || ctx.role === "admin";

  return (
    <PageFrame
      eyebrow={t("settings.eyebrow")}
      title={t("settings.title")}
      help={t("settings.help")}
      dataTour="settings-header"
    >
      <div data-tour="settings-language">
        <SettingsLanguageClient initialLanguage={ctx.user.language} />
      </div>
      <div data-tour="settings-theme">
        <SettingsThemeClient
          initial={branding}
          canEdit={canEdit}
          orgName={ctx.activeOrg.name}
          isConsultancy={ctx.activeOrg.type === "consultancy"}
        />
      </div>
      <SettingsPortalClient
        canEdit={canEdit}
        orgName={ctx.activeOrg.name}
        initialPortal={portal}
        initialBranding={{
          primaryColor: branding.primaryColor,
          logoUrl: branding.logoUrl,
        }}
      />
      <SettingsEmissionsStandardClient initial={emissionsStandard} canEdit={canEdit} />
      <SettingsBiKeysClient canEdit={canEdit} />
      <div data-tour="settings-related">
        <section className="mt-10 border-t border-rule pt-8">
          <div className="max-w-xl">
            <h2 className="font-display text-xl text-ink">
              {t("settings.orgHierarchy.title")}
            </h2>
            <div className="title-rule mt-2" />
            <p className="mt-3 text-sm text-ink-muted">
              {t("settings.orgHierarchy.help")}
            </p>
            <p className="mt-4">
              <a href="/settings/org-hierarchy" className="editorial-link text-accent">
                {t("settings.orgHierarchy.link")}
              </a>
            </p>
          </div>
        </section>
        <section className="mt-10 border-t border-rule pt-8">
          <div className="max-w-xl">
            <h2 className="font-display text-xl text-ink">
              {t("settings.facilities.title")}
            </h2>
            <div className="title-rule mt-2" />
            <p className="mt-3 text-sm text-ink-muted">{t("settings.facilities.help")}</p>
            <p className="mt-4">
              <a href="/facilities" className="editorial-link text-accent">
                {t("settings.facilities.link")}
              </a>
            </p>
          </div>
        </section>
        <section className="mt-10 border-t border-rule pt-8">
          <div className="max-w-xl">
            <h2 className="font-display text-xl text-ink">
              {t("settings.customMetrics.title")}
            </h2>
            <div className="title-rule mt-2" />
            <p className="mt-3 text-sm text-ink-muted">
              {t("settings.customMetrics.help")}
            </p>
            <p className="mt-4">
              <a href="/settings/custom-metrics" className="editorial-link text-accent">
                {t("settings.customMetrics.link")}
              </a>
            </p>
          </div>
        </section>
        <section className="mt-10 border-t border-rule pt-8">
          <div className="max-w-xl">
            <h2 className="font-display text-xl text-ink">
              {t("settings.factors.title")}
            </h2>
            <div className="title-rule mt-2" />
            <p className="mt-3 text-sm text-ink-muted">{t("settings.factors.help")}</p>
            <p className="mt-4">
              <a href="/settings/factors" className="editorial-link text-accent">
                {t("settings.factors.link")}
              </a>
            </p>
          </div>
        </section>
        <section className="mt-10 border-t border-rule pt-8">
          <div className="max-w-xl">
            <h2 className="font-display text-xl text-ink">
              {t("settings.validationRules.title")}
            </h2>
            <div className="title-rule mt-2" />
            <p className="mt-3 text-sm text-ink-muted">
              {t("settings.validationRules.help")}
            </p>
            <p className="mt-4">
              <a href="/settings/validation-rules" className="editorial-link text-accent">
                {t("settings.validationRules.link")}
              </a>
            </p>
          </div>
        </section>
        <section className="mt-10 border-t border-rule pt-8">
          <div className="max-w-xl">
            <h2 className="font-display text-xl text-ink">
              {t("settings.alertThresholds.title")}
            </h2>
            <div className="title-rule mt-2" />
            <p className="mt-3 text-sm text-ink-muted">
              {t("settings.alertThresholds.help")}
            </p>
            <p className="mt-4">
              <a href="/alerts" className="editorial-link text-accent">
                {t("settings.alertThresholds.link")}
              </a>
            </p>
          </div>
        </section>
        <section className="mt-10 border-t border-rule pt-8">
          <div className="max-w-xl">
            <h2 className="font-display text-xl text-ink">{t("settings.trust.title")}</h2>
            <div className="title-rule mt-2" />
            <p className="mt-3 text-sm text-ink-muted">{t("settings.trust.help")}</p>
            <p className="mt-4">
              <a href="/trust" className="editorial-link text-accent">
                {t("settings.trust.link")}
              </a>
            </p>
          </div>
        </section>
        <section className="mt-10 border-t border-rule pt-8">
          <div className="max-w-xl">
            <h2 className="font-display text-xl text-ink">Privacy & DPDP</h2>
            <div className="title-rule mt-2" />
            <p className="mt-3 text-sm text-ink-muted">
              Log data subject requests and set a retention policy. DPDP Act product
              beachhead — hosting region / Atlas is an open decision (§11); this does not
              constitute legal compliance.
            </p>
            <p className="mt-4">
              <a href="/settings/privacy" className="editorial-link text-accent">
                Manage privacy & DPDP →
              </a>
            </p>
          </div>
        </section>
      </div>
    </PageFrame>
  );
}
