import { redirect } from "next/navigation";

import { ComplianceDashboardClient } from "./ComplianceDashboardClient";
import { getCurrentContext } from "@/lib/auth";

export const metadata = {
  title: "Compliance Dashboard | ClearESG",
};

export default async function CompliancePage() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) redirect("/onboarding");
  if (!ctx.activeOrg.onboardedAt) redirect("/onboarding");

  return <ComplianceDashboardClient />;
}
