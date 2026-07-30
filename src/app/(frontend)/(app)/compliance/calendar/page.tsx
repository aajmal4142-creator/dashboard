import { redirect } from "next/navigation";
import { getCurrentContext } from "@/lib/auth";
import { CalendarClient } from "./CalendarClient";

export const metadata = {
  title: "Regulatory Calendar | ClearESG",
};

export default async function CalendarPage() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) redirect("/onboarding");
  if (!ctx.activeOrg.onboardedAt) redirect("/onboarding");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Regulatory Calendar</h1>
        <p className="text-muted-foreground mt-2">
          Track and manage compliance deadlines across all frameworks and jurisdictions.
        </p>
      </div>

      <CalendarClient />
    </div>
  );
}
