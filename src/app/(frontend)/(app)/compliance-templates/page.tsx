import { redirect } from "next/navigation";

import { ComplianceTemplatesClient } from "@/app/(frontend)/(app)/compliance-templates/ComplianceTemplatesClient";
import { getCurrentContext } from "@/lib/auth";

export default async function ComplianceTemplatesPage() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) redirect("/onboarding");
  if (!ctx.activeOrg.onboardedAt) redirect("/onboarding");

  const canWrite =
    ctx.role === "owner" || ctx.role === "admin" || ctx.role === "contributor";

  return (
    <ComplianceTemplatesClient
      canWrite={canWrite}
      defaultYear={new Date().getFullYear()}
    />
  );
}
