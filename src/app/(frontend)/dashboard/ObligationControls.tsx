"use client";

import { useRouter } from "nextjs-toploader/app";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Props = {
  obligationId: string;
  filingDeadline: string | null;
  canManage: boolean;
  needsConfirmation: boolean;
  baselineDrift: boolean;
  source: "engine" | "manual" | null;
};

export function ObligationControls({
  obligationId,
  filingDeadline,
  canManage,
  needsConfirmation,
  baselineDrift,
  source,
}: Props) {
  const router = useRouter();
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [date, setDate] = useState(filingDeadline?.slice(0, 10) ?? "");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function post(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/app/obligations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Could not update obligation");
      return;
    }
    setOverrideOpen(false);
    router.refresh();
  }

  if (!canManage && !needsConfirmation && !baselineDrift) {
    return null;
  }

  return (
    <div className="mt-6 max-w-lg space-y-4">
      {needsConfirmation ? (
        <div className="panel border border-amber/40 bg-amber/5 px-4 py-3">
          <p className="label-caps text-amber">Confirm deadline</p>
          <p className="mt-1 text-sm text-ink-muted">
            This date is a strong default from your baseline — confirm it, or adjust if
            counsel has a different filing calendar.
          </p>
          {canManage ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                disabled={busy}
                onClick={() =>
                  void post({
                    action: "confirm",
                    obligationId,
                    notes: "Confirmed on Runway",
                  })
                }
              >
                Confirm date
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={busy}
                onClick={() => setOverrideOpen(true)}
              >
                Adjust
              </Button>
            </div>
          ) : (
            <p className="mt-2 text-xs text-ink-muted">
              Ask an owner or admin to confirm.
            </p>
          )}
        </div>
      ) : null}

      {baselineDrift && source === "manual" ? (
        <div className="panel border border-rule px-4 py-3">
          <p className="label-caps">Baseline changed</p>
          <p className="mt-1 text-sm text-ink-muted">
            Figures changed — re-derive? Your manual deadline stays until you choose to.
          </p>
          {canManage ? (
            <Button
              type="button"
              size="sm"
              className="mt-3"
              variant="secondary"
              disabled={busy}
              onClick={() => void post({ action: "rederive" })}
            >
              Re-derive from baseline
            </Button>
          ) : null}
        </div>
      ) : null}

      {canManage && !needsConfirmation ? (
        <button
          type="button"
          className="editorial-link text-sm"
          onClick={() => setOverrideOpen((v) => !v)}
        >
          {overrideOpen ? "Hide override" : "Override deadline"}
        </button>
      ) : null}

      {overrideOpen && canManage ? (
        <div className="input-well space-y-3 p-4">
          <label className="block">
            <span className="label-caps">Filing deadline</span>
            <Input
              type="date"
              className="mt-1"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="label-caps">Note</span>
            <Input
              className="mt-1"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Why this date"
            />
          </label>
          <Button
            type="button"
            size="sm"
            disabled={busy || !date}
            onClick={() =>
              void post({
                action: "override",
                obligationId,
                filingDeadline: date || null,
                notes,
              })
            }
          >
            Save override
          </Button>
        </div>
      ) : null}

      {error ? <p className="text-sm text-rust">{error}</p> : null}
    </div>
  );
}
