import { redirect } from "next/navigation";

import { getCurrentContext } from "@/lib/auth";

import { SbtiTrackingClient } from "./SbtiTrackingClient";

export const metadata = {
  title: "SBTi Target Tracking | ClearESG",
};

export default async function SbtiTrackingPage() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) redirect("/onboarding");
  if (!ctx.activeOrg.onboardedAt) redirect("/onboarding");

  return (
    <div className="space-y-6">
      <div className="border-b border-[color:var(--rule)] pb-4">
        <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight text-[color:var(--ink)]">
          SBTi Target Tracking
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-[color:var(--ink-muted)]">
          Track progress toward your Science-Based Targets commitment. Every target shows
          baseline, current emissions, and on-track status together. Create as draft or
          submitted, then advance validation on the SBTi register.
        </p>
      </div>

      <SbtiTrackingClient orgName={ctx.activeOrg.name} />
    </div>
  );
}
