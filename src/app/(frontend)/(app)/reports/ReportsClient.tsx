"use client";

import { useState } from "react";

import {
  EmptyState,
  PageCard,
  PageFrame,
  StatusLine,
} from "@/components/shell/PageFrame";
import { Button } from "@/components/ui/button";
import { BUYER_FAQ } from "@/lib/reports/buyerFaq";
import { frameworkLabel } from "@/lib/ui/displayLabels";

type ReportRow = {
  id: string;
  version: number;
  status: string;
  framework: string;
  shareToken: string | null;
  assuranceToken: string | null;
  publishedAt: string | null;
  scores?: { overall?: number | null } | null;
  viewCount: number;
  approvedAt?: string | null;
  lockedAt?: string | null;
  dataGapCount?: number;
  emissionsStandard?: string | null;
};

type Framework = "CSRD_SIMPLIFIED" | "BRSR";

export function ReportsClient({
  initial,
  canPublish = true,
}: {
  initial: ReportRow[];
  canPublish?: boolean;
}) {
  const [rows, setRows] = useState(initial);
  const [status, setStatus] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<"neutral" | "error" | "ok">("neutral");
  const [diff, setDiff] = useState<Array<{ path: string; from: string; to: string }>>([]);
  const [pending, setPending] = useState<Framework | null>(null);
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState("");

  async function refresh() {
    const res = await fetch("/api/app/reports");
    if (!res.ok) return;
    const data = (await res.json()) as { reports: ReportRow[] };
    setRows(data.reports);
  }

  function requestPublish(framework: Framework) {
    if (!canPublish) {
      setStatusTone("error");
      setStatus("Publishing requires an admin or owner. Ask a teammate with that role.");
      return;
    }
    setPending(framework);
    setStatusTone("neutral");
    setStatus(
      framework === "BRSR"
        ? "Confirm BRSR-readiness publish. This locks an immutable snapshot — not a complete BRSR principle mapping."
        : "Confirm CSRD (simplified) publish. This locks an immutable ESRS-structured snapshot of scores, emissions, materiality, evidence, and factor versions.",
    );
  }

  async function generateDraft(framework: Framework) {
    if (!canPublish || busy) return;
    setBusy(true);
    setStatusTone("neutral");
    setStatus("Generating regenerable draft…");
    try {
      const res = await fetch("/api/app/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          framework,
          mode: "draft",
          preparerNotes: notes.trim() || undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        version?: number;
        changes?: Array<{ path: string; from: string; to: string }>;
        dataGapCount?: number;
      };
      if (!res.ok) {
        setStatusTone("error");
        setStatus(data.error ?? "Draft generation failed");
        return;
      }
      setDiff(data.changes ?? []);
      setStatusTone("ok");
      setStatus(
        `Draft v${data.version} ready${
          typeof data.dataGapCount === "number"
            ? ` · ${data.dataGapCount} data gap(s) flagged`
            : ""
        }. Regenerate anytime; publish to lock.`,
      );
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function confirmPublish() {
    if (!pending || busy) return;
    const framework = pending;
    setBusy(true);
    setStatusTone("neutral");
    setStatus("Publishing final report…");
    try {
      const res = await fetch("/api/app/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          framework,
          shareDays: 90,
          mode: "final",
          preparerNotes: notes.trim() || undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        shareUrl?: string;
        assuranceUrl?: string;
        version?: number;
        diff?: Array<{ path: string; from: string; to: string }>;
        dataGapCount?: number;
      };
      if (!res.ok) {
        const raw = data.error ?? "Publish failed";
        setStatusTone("error");
        setStatus(
          raw === "Forbidden"
            ? "You do not have permission to publish. Ask an admin or owner."
            : raw,
        );
        return;
      }
      setDiff(data.diff ?? []);
      setPending(null);
      setStatusTone("ok");
      if (data.shareUrl) {
        try {
          await navigator.clipboard.writeText(data.shareUrl);
        } catch {
          /* ignore */
        }
        setStatus(
          data.assuranceUrl
            ? `Published v${data.version} (locked). Living report link copied. Assurance Room: ${data.assuranceUrl}`
            : `Published v${data.version} (locked). Living report link copied.`,
        );
        try {
          window.localStorage.setItem("clearesg-first-share", "1");
        } catch {
          /* ignore */
        }
      } else {
        setStatus(`Published v${data.version} (locked)`);
      }
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function regenerateDraft(id: string) {
    if (!canPublish || busy) return;
    setBusy(true);
    setStatusTone("neutral");
    setStatus("Regenerating draft…");
    try {
      const res = await fetch(`/api/app/reports/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "regenerate",
          preparerNotes: notes.trim() || undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        version?: number;
        changes?: Array<{ path: string; from: string; to: string }>;
        dataGapCount?: number;
      };
      if (!res.ok) {
        setStatusTone("error");
        setStatus(data.error ?? "Regenerate failed");
        return;
      }
      setDiff(data.changes ?? []);
      setStatusTone("ok");
      setStatus(
        `Draft v${data.version} regenerated${
          typeof data.dataGapCount === "number"
            ? ` · ${data.dataGapCount} data gap(s)`
            : ""
        }.`,
      );
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function approveDraft(id: string) {
    if (!canPublish || busy) return;
    setBusy(true);
    setStatusTone("neutral");
    setStatus("Recording approval…");
    try {
      const res = await fetch(`/api/app/reports/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "approve",
          preparerNotes: notes.trim() || undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setStatusTone("error");
        setStatus(data.error ?? "Approval failed");
        return;
      }
      setStatusTone("ok");
      setStatus("Draft approved. Publish to create the immutable final version.");
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  const drafts = rows.filter((r) => r.status === "draft");
  const published = rows.filter((r) => r.status === "published");

  return (
    <PageFrame
      eyebrow="Reports"
      title="Publish"
      help="Generate regenerable CSRD/ESRS drafts, approve, then publish a locked final. Published versions are immutable. ClearESG is not an assurance provider."
      actions={
        canPublish ? (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => void generateDraft("CSRD_SIMPLIFIED")}
            >
              Generate CSRD draft
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={busy}
              onClick={() => requestPublish("CSRD_SIMPLIFIED")}
            >
              Publish CSRD (simplified)
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => requestPublish("BRSR")}
            >
              Publish BRSR-readiness
            </Button>
          </div>
        ) : (
          <p className="text-[13px] text-ink-muted">
            View only — ask an admin to publish
          </p>
        )
      }
      rail={
        <div className="space-y-5 text-[13px] text-ink-muted">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink">
              Draft → final
            </p>
            <p className="mt-2">
              Drafts regenerate from live data. Publish locks an ESRS-structured PDF with
              executive summary, scope breakdown, disclosures, data integrity, and
              compliance declaration.
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink">
              Preparer notes
            </p>
            <textarea
              className="mt-2 w-full min-h-[72px] border border-rule bg-surface-1 px-2 py-1.5 text-[12px] text-ink outline-none focus:border-rule-strong"
              placeholder="Audit notes included in the Data Integrity PDF section"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={!canPublish || busy}
            />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink">
              For banks &amp; buyers
            </p>
            <ul className="mt-2 space-y-2">
              {BUYER_FAQ.slice(0, 2).map((f) => (
                <li key={f.q}>
                  <span className="text-ink">{f.q}</span>
                  <span className="mt-0.5 block text-[12px]">{f.a}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink">
              Assurance
            </p>
            <p className="mt-2">ClearESG does not provide assurance or audit opinions.</p>
            <p className="mt-2">
              <a href="/assurance-partners" className="editorial-link text-accent">
                Browse assurance partners
              </a>
            </p>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {status ? <StatusLine tone={statusTone}>{status}</StatusLine> : null}

        {pending ? (
          <PageCard title="Confirm publish">
            <p className="text-[13px] text-ink">
              {pending === "BRSR"
                ? "Publish BRSR-readiness snapshot as a locked final?"
                : "Publish CSRD (simplified) ESRS report as a locked final?"}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                disabled={busy}
                onClick={() => void confirmPublish()}
              >
                Confirm publish
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => {
                  setPending(null);
                  setStatus(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </PageCard>
        ) : null}

        {diff.length > 0 ? (
          <PageCard title="Diff vs previous version">
            <ul className="space-y-1 font-data text-[12px] text-ink-muted">
              {diff.map((d) => (
                <li key={d.path}>
                  {d.path}: {d.from} → {d.to}
                </li>
              ))}
            </ul>
          </PageCard>
        ) : null}

        {drafts.length > 0 ? (
          <PageCard title="Drafts (regenerable)">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-[12px]">
                <thead>
                  <tr className="border-b-2 border-rule-strong">
                    <th className="py-2.5 pr-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                      Version
                    </th>
                    <th className="py-2.5 pr-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                      Framework
                    </th>
                    <th className="py-2.5 pr-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                      Factor standard
                    </th>
                    <th className="py-2.5 pr-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                      Gaps
                    </th>
                    <th className="py-2.5 pr-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                      Approval
                    </th>
                    <th className="py-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {drafts.map((r) => (
                    <tr
                      key={r.id}
                      className="border-b border-rule transition-colors last:border-b-0 hover:bg-surface-2"
                    >
                      <td className="py-2.5 pr-2 font-data text-ink">v{r.version}</td>
                      <td className="py-2.5 pr-2 text-ink-muted">
                        {frameworkLabel(r.framework)}
                      </td>
                      <td className="py-2.5 pr-2 font-data text-ink-muted">
                        {r.emissionsStandard ?? "—"}
                      </td>
                      <td className="py-2.5 pr-2 font-data text-ink">
                        {r.dataGapCount ?? "—"}
                      </td>
                      <td className="py-2.5 pr-2 text-ink-muted">
                        {r.approvedAt ? "Approved" : "Pending"}
                      </td>
                      <td className="py-2.5">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <a
                            className="text-ink underline-offset-2 hover:underline"
                            href={`/api/app/reports/${r.id}/pdf`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            PDF
                          </a>
                          {canPublish ? (
                            <>
                              <button
                                type="button"
                                className="text-accent underline-offset-2 hover:underline"
                                disabled={busy}
                                onClick={() => void regenerateDraft(r.id)}
                              >
                                Regenerate
                              </button>
                              {!r.approvedAt ? (
                                <button
                                  type="button"
                                  className="text-ink underline-offset-2 hover:underline"
                                  disabled={busy}
                                  onClick={() => void approveDraft(r.id)}
                                >
                                  Approve
                                </button>
                              ) : null}
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </PageCard>
        ) : null}

        {published.length === 0 && drafts.length === 0 ? (
          <EmptyState
            title="No reports yet"
            body="Generate a CSRD draft to review the ESRS PDF, then publish a locked final when ready."
          />
        ) : published.length === 0 ? null : (
          <PageCard title="Published versions (immutable)">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-[12px]">
                <thead>
                  <tr className="border-b-2 border-rule-strong">
                    <th className="py-2.5 pr-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                      Version
                    </th>
                    <th className="py-2.5 pr-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                      Framework
                    </th>
                    <th className="py-2.5 pr-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                      Factor standard
                    </th>
                    <th className="py-2.5 pr-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                      Score
                    </th>
                    <th className="py-2.5 pr-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                      Gaps
                    </th>
                    <th className="py-2.5 pr-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                      Views
                    </th>
                    <th className="py-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {published.map((r) => (
                    <tr
                      key={r.id}
                      className="border-b border-rule transition-colors last:border-b-0 hover:bg-surface-2"
                    >
                      <td className="py-2.5 pr-2 font-data text-ink">v{r.version}</td>
                      <td className="py-2.5 pr-2 text-ink-muted">
                        {frameworkLabel(r.framework)}
                      </td>
                      <td className="py-2.5 pr-2 font-data text-ink-muted">
                        {r.emissionsStandard ?? "—"}
                      </td>
                      <td className="py-2.5 pr-2 font-data text-ink">
                        {r.scores?.overall ?? "—"}
                      </td>
                      <td className="py-2.5 pr-2 font-data text-ink-muted">
                        {r.dataGapCount ?? "—"}
                      </td>
                      <td className="py-2.5 pr-2 font-data text-ink-muted">
                        {r.viewCount}
                      </td>
                      <td className="py-2.5">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          {r.shareToken ? (
                            <a
                              className="font-medium text-accent underline-offset-2 hover:underline"
                              href={`/r/${r.shareToken}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Open live report
                            </a>
                          ) : null}
                          {r.assuranceToken ? (
                            <a
                              className="text-ink underline-offset-2 hover:underline"
                              href={`/a/${r.assuranceToken}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Assurance Room
                            </a>
                          ) : null}
                          <a
                            className="text-ink underline-offset-2 hover:underline"
                            href={`/api/app/reports/${r.id}/pdf`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            PDF
                          </a>
                          <span className="text-[11px] text-ink-muted">
                            <a
                              className="underline-offset-2 hover:underline"
                              href={`/api/app/reports/${r.id}/export?format=json`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              JSON
                            </a>
                            <span aria-hidden="true"> · </span>
                            <a
                              className="underline-offset-2 hover:underline"
                              href={`/api/app/reports/${r.id}/export?format=csv`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              CSV
                            </a>
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </PageCard>
        )}
      </div>
    </PageFrame>
  );
}
