import { redirect } from "next/navigation";

import { getCurrentContext } from "@/lib/auth";

import { AssurancePartnersClient } from "./AssurancePartnersClient";

export default async function AssurancePartnersPage() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) redirect("/onboarding");
  if (!ctx.activeOrg.onboardedAt) redirect("/onboarding");

  return <AssurancePartnersClient />;
}
