import { redirect } from "next/navigation";
import { getPayload } from "payload";

import { SettingsBiKeysClient } from "@/app/(frontend)/(app)/settings/SettingsBiKeysClient";
import { SettingsEmissionsStandardClient } from "@/app/(frontend)/(app)/settings/SettingsEmissionsStandardClient";
import { SettingsPortalClient } from "@/app/(frontend)/(app)/settings/SettingsPortalClient";
import { SettingsThemeClient } from "@/app/(frontend)/(app)/settings/SettingsThemeClient";
import { PageFrame } from "@/components/shell/PageFrame";
import { getCurrentContext } from "@/lib/auth";
import { resolveOrgBranding } from "@/lib/branding";
import { resolveOrgEmissionsStandard } from "@/lib/factors";
import { getPortalConfigForOrg } from "@/lib/portal";
import config from "@/payload.config";

export default async function SettingsPage() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) redirect("/onboarding");

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
      eyebrow="Account"
      title="Settings"
      help="Organisation branding, supplier portal, emissions methodology, and BI API keys. Marketing site is unchanged."
    >
      <SettingsThemeClient
        initial={branding}
        canEdit={canEdit}
        orgName={ctx.activeOrg.name}
        isConsultancy={ctx.activeOrg.type === "consultancy"}
      />
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
      <section className="mt-10 border-t border-rule pt-8">
        <div className="max-w-xl">
          <h2 className="font-display text-xl text-ink">Org hierarchy</h2>
          <div className="title-rule mt-2" />
          <p className="mt-3 text-sm text-ink-muted">
            Link subsidiaries for consolidated emissions reporting. Set parent,
            consolidation method, and ownership %. Circular hierarchies are rejected.
          </p>
          <p className="mt-4">
            <a href="/settings/org-hierarchy" className="editorial-link text-accent">
              Manage org hierarchy
            </a>
          </p>
        </div>
      </section>
    </PageFrame>
  );
}
