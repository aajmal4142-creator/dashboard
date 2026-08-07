import { redirect } from "next/navigation";

import { getCurrentContext } from "@/lib/auth";

import { PcafClient } from "./PcafClient";

export const metadata = {
  title: "Financed emissions (PCAF) | ClearESG",
};

export default async function PcafPage() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) redirect("/onboarding");
  if (!ctx.activeOrg.onboardedAt) redirect("/onboarding");

  const canWrite =
    ctx.role === "owner" || ctx.role === "admin" || ctx.role === "contributor";
  const canDelete = ctx.role === "owner" || ctx.role === "admin";

  return (
    <PcafClient orgName={ctx.activeOrg.name} canWrite={canWrite} canDelete={canDelete} />
  );
}
