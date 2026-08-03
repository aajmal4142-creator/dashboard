import { redirect } from "next/navigation";

import { getCurrentContext } from "@/lib/auth";

import { CaliforniaCoverageClient } from "./CaliforniaCoverageClient";

export const metadata = {
  title: "California SB 253 / SB 261 | ClearESG",
};

export default async function CaliforniaCompliancePage() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) redirect("/onboarding");
  if (!ctx.activeOrg.onboardedAt) redirect("/onboarding");

  return <CaliforniaCoverageClient />;
}
