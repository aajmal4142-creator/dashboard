import { redirect } from "next/navigation";

import { getCurrentContext } from "@/lib/auth";

import { ExportChecklistButton } from "../ExportChecklistButton";
import { CalendarClient } from "./CalendarClient";

export const metadata = {
  title: "Regulatory Calendar | ClearESG",
};

export default async function CalendarPage() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) redirect("/onboarding");
  if (!ctx.activeOrg.onboardedAt) redirect("/onboarding");

  const period = new Date().toISOString().slice(0, 7);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-[color:var(--rule)] pb-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight text-[color:var(--ink)]">
            Regulatory Calendar
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-[color:var(--ink-muted)]">
            Deadlines applicable to your organisation — CSRD, ISSB, SBTi, taxonomies, and
            related filings. Days remaining are calculated on the server; items under 30
            days are flagged urgent.
          </p>
        </div>
        <ExportChecklistButton period={period} />
      </div>

      <CalendarClient />
    </div>
  );
}
