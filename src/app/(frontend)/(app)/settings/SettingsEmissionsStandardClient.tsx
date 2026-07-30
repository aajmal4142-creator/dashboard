"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { AppSelectNative } from "@/components/ui/AppField";
import {
  DEFAULT_EMISSIONS_STANDARD,
  EMISSIONS_STANDARD_LABELS,
  EMISSIONS_STANDARDS,
  type EmissionsStandard,
} from "@/lib/factors/standards";
import { cn } from "@/lib/utils";

type Props = {
  initial: EmissionsStandard;
  canEdit: boolean;
};

export function SettingsEmissionsStandardClient({ initial, canEdit }: Props) {
  const [standard, setStandard] = useState<EmissionsStandard>(initial);
  const [status, setStatus] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<"ok" | "error" | "neutral">("neutral");
  const [pending, startTransition] = useTransition();

  function save() {
    if (!canEdit) {
      setStatus("Only owners and admins can change the emissions standard.");
      setStatusTone("error");
      return;
    }
    setStatus("Saving…");
    setStatusTone("neutral");
    startTransition(async () => {
      try {
        const res = await fetch("/api/app/settings/emissions-standard", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ standard }),
        });
        const data = (await res.json()) as { error?: string; note?: string };
        if (!res.ok) {
          setStatus(data.error ?? "Could not save emissions standard.");
          setStatusTone("error");
          return;
        }
        setStatus(
          data.note ??
            `Saved ${EMISSIONS_STANDARD_LABELS[standard]}. Rebuild draft reports to recalculate.`,
        );
        setStatusTone("ok");
      } catch {
        setStatus("Network error while saving emissions standard.");
        setStatusTone("error");
      }
    });
  }

  return (
    <section className="mt-10 border-t border-rule pt-8">
      <div className="max-w-xl">
        <h2 className="font-display text-xl text-ink">Emissions factors</h2>
        <div className="title-rule mt-2" />
        <p className="mt-3 text-sm text-ink-muted">
          Methodology standard for calculations and reports. Default is{" "}
          {EMISSIONS_STANDARD_LABELS[DEFAULT_EMISSIONS_STANDARD]} for audit compliance.
          Changing this applies on the next calculation and draft report rebuild; locked
          finals keep their pinned snapshot.
        </p>

        <div className="mt-5 space-y-4">
          <AppSelectNative
            label="Emissions standard"
            value={standard}
            onChange={(e) => setStandard(e.target.value as EmissionsStandard)}
            disabled={!canEdit || pending}
          >
            {EMISSIONS_STANDARDS.map((value) => (
              <option key={value} value={value}>
                {EMISSIONS_STANDARD_LABELS[value]}
              </option>
            ))}
          </AppSelectNative>

          {canEdit ? (
            <Button type="button" size="sm" disabled={pending} onClick={save}>
              Save standard
            </Button>
          ) : (
            <p className="text-sm text-ink-muted">View only</p>
          )}

          {status ? (
            <p
              role="status"
              className={cn(
                "text-sm",
                statusTone === "error" && "text-rust",
                statusTone === "ok" && "text-signal",
                statusTone === "neutral" && "text-ink-muted",
              )}
            >
              {status}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
