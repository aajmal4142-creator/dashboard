import { redirect } from "next/navigation";

import { CustomMetricsClient } from "@/app/(frontend)/(app)/settings/custom-metrics/CustomMetricsClient";
import { PageFrame } from "@/components/shell/PageFrame";
import { getCurrentContext } from "@/lib/auth";

export default async function CustomMetricsPage() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) redirect("/onboarding");

  const canEdit = ctx.role === "owner" || ctx.role === "admin";

  return (
    <PageFrame
      eyebrow="Settings"
      title="Custom metrics"
      help="Define derived metrics from existing keys with +, −, ×, ÷ and parentheses. Preview against sample values or a reporting period. Only owners and admins can save."
    >
      <CustomMetricsClient canEdit={canEdit} />
    </PageFrame>
  );
}
