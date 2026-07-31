import { redirect } from "next/navigation";

import { getCurrentContext } from "@/lib/auth";

import { GreenTaxonomyClient } from "./GreenTaxonomyClient";

export const metadata = {
  title: "EU Green Taxonomy | ClearESG",
};

export default async function GreenTaxonomyPage() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) redirect("/onboarding");
  if (!ctx.activeOrg.onboardedAt) redirect("/onboarding");

  return (
    <div className="space-y-6">
      <div className="border-b border-[color:var(--rule)] pb-4">
        <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight text-[color:var(--ink)]">
          EU Green Taxonomy
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-[color:var(--ink-muted)]">
          Assess whether your primary economic activity substantially contributes to the
          six environmental objectives under Regulation (EU) 2020/852, and whether Do No
          Significant Harm (DNSH) criteria are met. Non-applicable objectives are excluded
          from overall alignment.
        </p>
      </div>

      <GreenTaxonomyClient orgName={ctx.activeOrg.name} />
    </div>
  );
}
