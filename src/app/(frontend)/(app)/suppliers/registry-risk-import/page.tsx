import { redirect } from "next/navigation";

import { RegistryRiskImportClient } from "./RegistryRiskImportClient";
import { getCurrentContext } from "@/lib/auth";

export const metadata = {
  title: "Import registry risk flags | ClearESG",
};

export default async function RegistryRiskImportPage() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) redirect("/onboarding");
  if (ctx.role === "viewer" || ctx.role === null) redirect("/suppliers");

  return <RegistryRiskImportClient />;
}
