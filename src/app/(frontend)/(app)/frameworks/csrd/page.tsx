import { redirect } from "next/navigation";

import { getCurrentContext } from "@/lib/auth";

import { CsrdCoverageClient } from "./CsrdCoverageClient";

export const metadata = {
  title: "CSRD / ESRS coverage | ClearESG",
};

export default async function CsrdCoveragePage() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) redirect("/onboarding");
  if (!ctx.activeOrg.onboardedAt) redirect("/onboarding");

  return <CsrdCoverageClient />;
}
