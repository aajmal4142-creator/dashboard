import { redirect } from "next/navigation";

import { ValidationRulesClient } from "@/app/(frontend)/(app)/settings/validation-rules/ValidationRulesClient";
import { PageFrame } from "@/components/shell/PageFrame";
import { getCurrentContext } from "@/lib/auth";

export default async function ValidationRulesPage() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) redirect("/onboarding");

  const canEdit = ctx.role === "owner" || ctx.role === "admin";

  return (
    <PageFrame
      eyebrow="Settings"
      title="Validation rules"
      help="Custom rules check datapoints before approval. Error severity blocks approval; warnings are advisory. Apply a rule to scan existing data."
    >
      <ValidationRulesClient canEdit={canEdit} />
    </PageFrame>
  );
}
