import { redirect } from "next/navigation";

import { PrivacyClient } from "@/app/(frontend)/(app)/settings/privacy/PrivacyClient";
import { PageFrame } from "@/components/shell/PageFrame";
import { getCurrentContext } from "@/lib/auth";

export default async function PrivacySettingsPage() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) redirect("/onboarding");

  const canEdit = ctx.role === "owner" || ctx.role === "admin";

  return (
    <PageFrame
      eyebrow="Settings"
      title="Privacy & DPDP"
      help="DPDP Act product beachhead — hosting region / Atlas is an open decision (§11). Tracking requests and a retention policy here does not by itself constitute legal compliance; confirm with counsel before relying on this workflow."
    >
      <PrivacyClient canEdit={canEdit} />
    </PageFrame>
  );
}
