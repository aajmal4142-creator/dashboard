import { redirect } from "next/navigation";

import { getCurrentContext } from "@/lib/auth";

import { EngagementClient } from "./EngagementClient";

export const metadata = {
  title: "Supplier Engagement | ClearESG",
};

export default async function SupplierEngagementPage() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) redirect("/onboarding");
  if (!ctx.activeOrg.onboardedAt) redirect("/onboarding");

  return <EngagementClient canWrite={ctx.role !== "viewer" && ctx.role !== null} />;
}
