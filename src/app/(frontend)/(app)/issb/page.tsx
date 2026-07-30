import { redirect } from "next/navigation";

import { IssbWizardClient } from "@/app/(frontend)/(app)/issb/IssbWizardClient";
import { getCurrentContext } from "@/lib/auth";
import { ISSB_QUESTIONS } from "@/lib/issb";

export default async function IssbPage() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) redirect("/onboarding");
  if (!ctx.activeOrg.onboardedAt) redirect("/onboarding");

  const canWrite =
    ctx.role === "owner" || ctx.role === "admin" || ctx.role === "contributor";

  return (
    <IssbWizardClient
      canWrite={canWrite}
      defaultYear={new Date().getFullYear()}
      questions={ISSB_QUESTIONS}
    />
  );
}
