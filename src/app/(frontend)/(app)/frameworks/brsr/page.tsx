import { redirect } from "next/navigation";

import { getCurrentContext } from "@/lib/auth";

import { BrsrCoverageClient } from "./BrsrCoverageClient";

export const metadata = {
  title: "BRSR coverage | ClearESG",
};

export default async function BrsrCoveragePage() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) redirect("/onboarding");
  if (!ctx.activeOrg.onboardedAt) redirect("/onboarding");

  return <BrsrCoverageClient />;
}
