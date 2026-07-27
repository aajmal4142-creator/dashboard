"use client";

import { AppSelectNative } from "@/components/ui/AppField";
import { cn } from "@/lib/utils";

type OrgOption = { id: string; name: string };

export function OrgSwitcher({
  orgs,
  activeOrgId,
  compact = false,
  iconOnly = false,
}: {
  orgs: OrgOption[];
  activeOrgId: string | null;
  compact?: boolean;
  iconOnly?: boolean;
}) {
  if (orgs.length === 0) return null;

  async function switchOrg(organisationId: string) {
    await fetch("/api/org/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organisationId }),
    });
    window.location.reload();
  }

  if (iconOnly) {
    if (orgs.length <= 1) return null;
    return (
      <AppSelectNative
        aria-label="Organisation"
        className="w-full px-1 py-1 text-[10px]"
        value={activeOrgId ?? ""}
        onChange={(e) => void switchOrg(e.target.value)}
      >
        {orgs.map((org) => (
          <option key={org.id} value={org.id}>
            {org.name}
          </option>
        ))}
      </AppSelectNative>
    );
  }

  return (
    <AppSelectNative
      label={compact ? undefined : "Organisation"}
      aria-label="Organisation"
      className={cn(!compact && "text-sm")}
      value={activeOrgId ?? ""}
      onChange={(e) => void switchOrg(e.target.value)}
    >
      {orgs.map((org) => (
        <option key={org.id} value={org.id}>
          {org.name}
        </option>
      ))}
    </AppSelectNative>
  );
}
