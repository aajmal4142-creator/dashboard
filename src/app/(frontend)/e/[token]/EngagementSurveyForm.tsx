"use client";

import { useState } from "react";

export function EngagementSurveyForm({
  token,
  orgName,
  campaignTitle,
  campaignDescription,
}: {
  token: string;
  orgName: string;
  campaignTitle: string;
  campaignDescription: string | null;
}) {
  const [daysPerWeek, setDaysPerWeek] = useState("");
  const [kmPerDay, setKmPerDay] = useState("");
  const [mode, setMode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!daysPerWeek.trim() && !kmPerDay.trim()) {
      setError("Enter your commute days or distance to submit.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/public/engagement/${encodeURIComponent(token)}/survey`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            daysPerWeek: daysPerWeek.trim() ? Number(daysPerWeek) : null,
            kmPerDay: kmPerDay.trim() ? Number(kmPerDay) : null,
            mode: mode.trim() || null,
          }),
        },
      );
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Could not submit your response. Try again.");
        setSubmitting(false);
        return;
      }
      setDone(true);
    } catch {
      setError("Network error submitting your response. Try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-full bg-canvas text-ink">
      <header className="border-b border-rule bg-surface-1">
        <div className="mx-auto max-w-md px-5 py-4 sm:px-6">
          <p className="label-caps text-ink-muted">{orgName}</p>
        </div>
      </header>
      <main className="mx-auto max-w-md px-5 py-10 sm:px-6">
        <p className="label-caps text-ink-muted">Commute survey</p>
        <h1 className="font-display mt-2 text-2xl text-ink">{campaignTitle}</h1>
        {campaignDescription ? (
          <p className="mt-3 text-sm text-ink-muted">{campaignDescription}</p>
        ) : null}

        {done ? (
          <div className="mt-8 border border-rule bg-surface-1 p-5">
            <p className="text-sm text-ink">
              Thanks — your response has been recorded for {orgName}&apos;s campaign.
            </p>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-8 space-y-4">
            <div>
              <label
                htmlFor="daysPerWeek"
                className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-muted"
              >
                Days per week you commute
              </label>
              <input
                id="daysPerWeek"
                type="number"
                min={0}
                max={7}
                step="1"
                value={daysPerWeek}
                onChange={(e) => setDaysPerWeek(e.target.value)}
                className="mt-1.5 w-full rounded-[4px] border border-rule bg-surface-1 px-3 py-2 text-sm text-ink"
                placeholder="e.g. 4"
              />
            </div>
            <div>
              <label
                htmlFor="kmPerDay"
                className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-muted"
              >
                Distance per day (km, one-way)
              </label>
              <input
                id="kmPerDay"
                type="number"
                min={0}
                step="any"
                value={kmPerDay}
                onChange={(e) => setKmPerDay(e.target.value)}
                className="mt-1.5 w-full rounded-[4px] border border-rule bg-surface-1 px-3 py-2 text-sm text-ink"
                placeholder="e.g. 12"
              />
            </div>
            <div>
              <label
                htmlFor="mode"
                className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-muted"
              >
                Mode (optional)
              </label>
              <input
                id="mode"
                type="text"
                value={mode}
                onChange={(e) => setMode(e.target.value)}
                className="mt-1.5 w-full rounded-[4px] border border-rule bg-surface-1 px-3 py-2 text-sm text-ink"
                placeholder="e.g. bike, bus, carpool"
              />
            </div>

            {error ? <p className="text-sm text-rust">{error}</p> : null}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-[4px] bg-accent px-4 py-2 text-sm font-medium text-on-accent transition-colors hover:bg-accent-hover disabled:opacity-60"
            >
              {submitting ? "Submitting…" : "Submit response"}
            </button>
            <p className="text-[11px] text-ink-muted">
              This response is counted toward the campaign only. No individual data is
              shared outside the count.
            </p>
          </form>
        )}
      </main>
    </div>
  );
}
