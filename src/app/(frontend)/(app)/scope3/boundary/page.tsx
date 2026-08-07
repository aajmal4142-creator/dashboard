import { redirect } from "next/navigation";

import { Scope3BoundaryClient } from "./Scope3BoundaryClient";
import { getCurrentContext } from "@/lib/auth";

export const metadata = {
  title: "Scope 3 boundary | ClearESG",
};

export default async function Scope3BoundaryPage() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) redirect("/onboarding");

  return <Scope3BoundaryClient canWrite={ctx.role !== "viewer" && ctx.role !== null} />;
}
