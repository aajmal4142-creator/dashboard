import { redirect } from "next/navigation";

import { getCurrentContext } from "@/lib/auth";

import { SocialCoverageClient } from "./SocialCoverageClient";

export const metadata = {
  title: "Social metrics | ClearESG",
};

export default async function SocialCoveragePage() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) redirect("/onboarding");
  if (!ctx.activeOrg.onboardedAt) redirect("/onboarding");

  return <SocialCoverageClient />;
}
