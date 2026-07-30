import { redirect } from "next/navigation";

import { TcfdWizardClient } from "@/app/(frontend)/(app)/tcfd/TcfdWizardClient";
import { getCurrentContext } from "@/lib/auth";
import { TCFD_QUESTIONS, TCFD_PILLAR_TITLES } from "@/lib/tcfd";

export default async function TcfdPage() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) redirect("/onboarding");
  if (!ctx.activeOrg.onboardedAt) redirect("/onboarding");

  const canWrite =
    ctx.role === "owner" || ctx.role === "admin" || ctx.role === "contributor";

  return (
    <TcfdWizardClient
      canWrite={canWrite}
      defaultYear={new Date().getFullYear()}
      questions={TCFD_QUESTIONS}
      pillarTitles={TCFD_PILLAR_TITLES}
    />
  );
}
