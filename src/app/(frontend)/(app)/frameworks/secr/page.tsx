import { redirect } from "next/navigation";

import { getCurrentContext } from "@/lib/auth";

import { SecrCoverageClient } from "./SecrCoverageClient";

export const metadata = {
  title: "SECR coverage | ClearESG",
};

export default async function SecrCoveragePage() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) redirect("/onboarding");
  if (!ctx.activeOrg.onboardedAt) redirect("/onboarding");

  return <SecrCoverageClient />;
}
