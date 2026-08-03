import { redirect } from "next/navigation";

import { getCurrentContext } from "@/lib/auth";

import { SfdrCoverageClient } from "./SfdrCoverageClient";

export const metadata = {
  title: "SFDR PAI | ClearESG",
};

export default async function SfdrCompliancePage() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) redirect("/onboarding");
  if (!ctx.activeOrg.onboardedAt) redirect("/onboarding");

  return <SfdrCoverageClient />;
}
