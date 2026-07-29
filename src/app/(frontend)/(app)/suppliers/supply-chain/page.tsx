import { redirect } from "next/navigation";

import { SupplyChainMapClient } from "./SupplyChainMapClient";
import { getCurrentContext } from "@/lib/auth";

export const metadata = {
  title: "Supply Chain Map | ClearESG",
};

export default async function SupplyChainPage() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) redirect("/onboarding");
  if (!ctx.activeOrg.onboardedAt) redirect("/onboarding");

  return <SupplyChainMapClient />;
}
