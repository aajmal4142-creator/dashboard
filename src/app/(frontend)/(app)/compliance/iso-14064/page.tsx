import { redirect } from "next/navigation";

import { getCurrentContext } from "@/lib/auth";

import { Iso14064Client } from "./Iso14064Client";

export const metadata = {
  title: "ISO 14064 Checklist | ClearESG",
};

export default async function Iso14064Page() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) redirect("/onboarding");
  if (!ctx.activeOrg.onboardedAt) redirect("/onboarding");

  return (
    <div className="space-y-6">
      <div className="border-b border-[color:var(--rule)] pb-4">
        <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight text-[color:var(--ink)]">
          ISO 14064 Certification Checklist
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-[color:var(--ink-muted)]">
          Track GHG inventory and project quantification requirements under ISO 14064-1
          (organisation) and ISO 14064-2 (project). Mark items complete only with linked
          evidence; assign a verifier when ready for third-party review.
        </p>
      </div>

      <Iso14064Client orgName={ctx.activeOrg.name} />
    </div>
  );
}
