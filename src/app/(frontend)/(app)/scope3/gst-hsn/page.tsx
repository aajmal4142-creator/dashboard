import { redirect } from "next/navigation";

import { GstHsnImportClient } from "./GstHsnImportClient";
import { getCurrentContext } from "@/lib/auth";

export const metadata = {
  title: "GST/HSN → Scope 3 | ClearESG",
};

export default async function GstHsnImportPage() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) redirect("/onboarding");

  return <GstHsnImportClient canWrite={ctx.role !== "viewer" && ctx.role !== null} />;
}
