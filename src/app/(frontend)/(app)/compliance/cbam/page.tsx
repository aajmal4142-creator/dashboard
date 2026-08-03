import { redirect } from "next/navigation";

import { getCurrentContext } from "@/lib/auth";

import { CbamClient } from "./CbamClient";

export const metadata = {
  title: "EU CBAM Importer | ClearESG",
};

export default async function CbamPage() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) redirect("/onboarding");
  if (!ctx.activeOrg.onboardedAt) redirect("/onboarding");

  const now = new Date();
  const defaultYear = now.getUTCFullYear();
  const defaultQuarter = (Math.floor(now.getUTCMonth() / 3) + 1).toString() as
    "1" | "2" | "3" | "4";

  return (
    <div className="space-y-6">
      <div className="border-b border-[color:var(--rule)] pb-4">
        <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight text-[color:var(--ink)]">
          EU CBAM Importer
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-[color:var(--ink-muted)]">
          Record CBAM-covered goods with operator-entered CN codes, quantities, and
          embedded emissions. Liability estimates use your certificate price only — no
          paid customs APIs and no silent zeroing of missing data.
        </p>
      </div>

      <CbamClient
        orgName={ctx.activeOrg.name}
        defaultYear={defaultYear}
        defaultQuarter={defaultQuarter}
      />
    </div>
  );
}
