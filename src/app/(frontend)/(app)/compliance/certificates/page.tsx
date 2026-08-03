import { redirect } from "next/navigation";

import { getCurrentContext } from "@/lib/auth";

import { CertificatesClient } from "./CertificatesClient";

export const metadata = {
  title: "Energy certificates | ClearESG",
};

export default async function CertificatesPage() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) redirect("/onboarding");
  if (!ctx.activeOrg.onboardedAt) redirect("/onboarding");

  return (
    <div className="space-y-6">
      <div className="border-b border-[color:var(--rule)] pb-4">
        <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight text-[color:var(--ink)]">
          Energy certificates
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-[color:var(--ink-muted)]">
          Track RECs, GOs, EACs, PPAs, and green tariffs for market-based Scope 2.
          Inventory is user-entered or CSV — no paid registry APIs. Active volume is
          compared to electricity_kwh when that datapoint exists.
        </p>
      </div>

      <CertificatesClient orgName={ctx.activeOrg.name} />
    </div>
  );
}
