import { redirect } from "next/navigation";
import { getPayload } from "payload";

import { SettingsThemeClient } from "@/app/(frontend)/dashboard/settings/SettingsThemeClient";
import { PageFrame } from "@/components/shell/PageFrame";
import { getCurrentContext } from "@/lib/auth";
import { resolveOrgBranding } from "@/lib/branding";
import config from "@/payload.config";

export default async function SettingsPage() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) redirect("/dashboard/onboarding");

  const payload = await getPayload({ config });
  const org = await payload.findByID({
    collection: "organisations",
    id: ctx.activeOrg.id,
    depth: 1,
    overrideAccess: true,
  });

  const branding = resolveOrgBranding(org);
  const canEdit = ctx.role === "owner" || ctx.role === "admin";

  return (
    <PageFrame
      eyebrow="Account"
      title="Settings"
      help="Organisation dashboard branding — colours, type, logo. Marketing site is unchanged."
    >
      <SettingsThemeClient
        initial={branding}
        canEdit={canEdit}
        orgName={ctx.activeOrg.name}
        isConsultancy={ctx.activeOrg.type === "consultancy"}
      />
    </PageFrame>
  );
}
