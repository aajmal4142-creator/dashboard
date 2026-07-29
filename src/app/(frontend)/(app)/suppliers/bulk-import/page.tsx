import { redirect } from "next/navigation";

import { BulkImportClient } from "./BulkImportClient";
import { getCurrentContext } from "@/lib/auth";

export const metadata = {
  title: "Bulk Supplier Import | ClearESG",
};

export default async function BulkImportPage() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) redirect("/onboarding");
  if (!ctx.activeOrg.onboardedAt) redirect("/onboarding");

  return <BulkImportClient />;
}
