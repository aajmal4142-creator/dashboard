import { redirect } from "next/navigation";

import { getCurrentContext } from "@/lib/auth";

import { BillingClientsClient } from "./BillingClientsClient";

export const metadata = {
  title: "Client billing | ClearESG",
};

export default async function BillingClientsPage() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) redirect("/onboarding");
  if (ctx.activeOrg.type !== "consultancy") redirect("/billing");
  if (ctx.role !== "owner" && ctx.role !== "admin") redirect("/billing");

  return <BillingClientsClient consultancyName={ctx.activeOrg.name} />;
}
