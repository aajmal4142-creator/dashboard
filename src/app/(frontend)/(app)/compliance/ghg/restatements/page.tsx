import { redirect } from "next/navigation";

import { getCurrentContext } from "@/lib/auth";

import { RestatementsClient } from "./RestatementsClient";

export const metadata = {
  title: "Base-year restatements | ClearESG",
};

export default async function GhgRestatementsPage() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) redirect("/onboarding");
  if (!ctx.activeOrg.onboardedAt) redirect("/onboarding");

  return (
    <div className="space-y-6">
      <div className="border-b border-[color:var(--rule)] pb-4">
        <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight text-[color:var(--ink)]">
          Base-year restatements
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-[color:var(--ink-muted)]">
          Record GHG Protocol structural changes, compare prior and restated base-year
          inventories, and finalise a disclosure-package note. Missing scopes stay missing
          — never silent zeros.
        </p>
      </div>

      <RestatementsClient orgName={ctx.activeOrg.name} />
    </div>
  );
}
