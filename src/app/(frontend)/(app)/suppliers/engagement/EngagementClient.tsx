"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useTransition } from "react";

import {
  EmptyState,
  PageCard,
  PageFrame,
  StatusLine,
} from "@/components/shell/PageFrame";
import { Button } from "@/components/ui/button";
import { Metric } from "@/components/ui/metric";
import {
  engagementStatusLabel,
  type EngagementStatus,
} from "@/lib/suppliers/engagementWorkflow";

type EngagementQuestionnaireDto = {
  id: string;
  organisationId: string;
  supplierId: string;
  supplierName: string;
  supplierEmail: string;
  status: EngagementStatus;
  publicToken: string | null;
  completionPercent: number;
  responses: Record<string, unknown>;
  notes: string | null;
  invitedAt: string | null;
  startedAt: string | null;
  submittedAt: string | null;
  sentAt: string | null;
  lastReminderAt: string | null;
  reminderCount: number;
  expiresAt: string | null;
  reviewedAt: string | null;
  approvedAt: string | null;
  lastReminderDaysAgo: number | null;
};

type Progress = {
  total: number;
  completed: number;
  invited: number;
  inProgress: number;
  submitted: number;
  reviewed: number;
  approved: number;
};

type SupplierOption = {
  id: string;
  name: string;
  contactEmail: string;
  emailConsent: boolean;
};

function reminderCopy(q: EngagementQuestionnaireDto): string {
  if (q.lastReminderDaysAgo === null) {
    return q.reminderCount > 0 ? "Reminder sent" : "No reminder yet";
  }
  if (q.lastReminderDaysAgo === 0) return "Last reminder sent today";
  if (q.lastReminderDaysAgo === 1) return "Last reminder sent 1 day ago";
  return `Last reminder sent ${q.lastReminderDaysAgo} days ago`;
}

export function EngagementClient({ canWrite = true }: { canWrite?: boolean }) {
  const [questionnaires, setQuestionnaires] = useState<EngagementQuestionnaireDto[]>([]);
  const [progress, setProgress] = useState<Progress>({
    total: 0,
    completed: 0,
    invited: 0,
    inProgress: 0,
    submitted: 0,
    reviewed: 0,
    approved: 0,
  });
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<"neutral" | "error" | "ok">("neutral");
  const [pending, startTransition] = useTransition();

  function note(message: string, tone: "neutral" | "error" | "ok" = "neutral") {
    setStatusTone(tone);
    setStatus(message);
  }

  const refresh = useCallback(async () => {
    const [qRes, sRes] = await Promise.all([
      fetch("/api/app/suppliers/questionnaires"),
      fetch("/api/app/suppliers"),
    ]);
    if (qRes.ok) {
      const data = (await qRes.json()) as {
        questionnaires: EngagementQuestionnaireDto[];
        progress: Progress;
      };
      setQuestionnaires(data.questionnaires);
      setProgress(data.progress);
    }
    if (sRes.ok) {
      const data = (await sRes.json()) as {
        suppliers: Array<{
          id: string;
          name: string;
          contactEmail: string;
          emailConsent?: boolean;
        }>;
      };
      setSuppliers(
        data.suppliers.map((s) => ({
          id: s.id,
          name: s.name,
          contactEmail: s.contactEmail,
          emailConsent: s.emailConsent === true,
        })),
      );
    }
  }, []);

  useEffect(() => {
    startTransition(() => {
      void refresh();
    });
  }, [refresh]);

  function selectSupplier(supplierId: string | null) {
    setSelectedId(supplierId);
    if (!supplierId) {
      setNotes("");
      return;
    }
    const q = questionnaires.find((row) => row.supplierId === supplierId);
    setNotes(q?.notes ?? "");
  }

  const selected = questionnaires.find((q) => q.supplierId === selectedId);
  const selectedSupplier = suppliers.find((s) => s.id === selectedId);

  async function setConsent(supplierId: string, emailConsent: boolean) {
    if (!canWrite) return;
    const res = await fetch(`/api/app/suppliers/${supplierId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emailConsent }),
    });
    if (!res.ok) {
      note("Could not update consent.", "error");
      return;
    }
    note(emailConsent ? "Email consent recorded." : "Consent cleared.", "ok");
    await refresh();
  }

  async function sendQuestionnaire(supplierId: string) {
    if (!canWrite) {
      note("Viewers cannot send questionnaires.", "error");
      return;
    }
    note("Sending ESG questionnaire…");
    const res = await fetch(`/api/app/suppliers/${supplierId}/questionnaire/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    const data = (await res.json().catch(() => ({}))) as {
      link?: string;
      delivery?: string;
      error?: string;
    };
    if (!res.ok) {
      note(data.error ?? "Could not send questionnaire.", "error");
      return;
    }
    if (data.link) {
      try {
        await navigator.clipboard.writeText(data.link);
      } catch {
        /* ignore */
      }
    }
    const via =
      data.delivery === "resend"
        ? "Email sent via Resend."
        : data.delivery === "failed"
          ? "Email failed — link copied if available."
          : "No RESEND_API_KEY — email logged to console. Link copied.";
    note(via, data.delivery === "failed" ? "error" : "ok");
    await refresh();
    selectSupplier(supplierId);
  }

  async function review(approve: boolean) {
    if (!canWrite || !selectedId) return;
    note(approve ? "Approving…" : "Saving review…");
    const res = await fetch(`/api/app/suppliers/${selectedId}/questionnaire/review`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes, approve }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      note(data.error ?? "Could not save review.", "error");
      return;
    }
    note(approve ? "Questionnaire approved." : "Review notes saved.", "ok");
    await refresh();
  }

  function statusBadge(status: EngagementStatus) {
    return engagementStatusLabel(status);
  }

  return (
    <PageFrame
      eyebrow="Supplier chains"
      title="Engagement workflows"
      help="Invite suppliers to an ESG questionnaire, track Invited → Submitted → Reviewed, and send day-7 / day-14 reminders when they have not started. Email requires recorded consent."
      actions={
        <Link
          href="/suppliers"
          className="text-sm text-[color:var(--accent)] underline-offset-2 hover:underline"
        >
          All suppliers
        </Link>
      }
      rail={
        <div className="space-y-5">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[color:var(--ink-muted)]">
              Completed
            </p>
            <div className="mt-2 flex items-baseline gap-1">
              <Metric value={progress.completed} size="xl" decimals={0} />
              <span className="font-[family-name:var(--font-data)] text-lg text-[color:var(--ink-muted)]">
                /{progress.total || suppliers.length}
              </span>
            </div>
            <p className="mt-1 text-[12px] text-[color:var(--ink-muted)]">
              Submitted, reviewed, or approved
            </p>
          </div>
          <div className="space-y-1 text-[12px] text-[color:var(--ink-muted)]">
            <p>
              Invited:{" "}
              <span className="font-[family-name:var(--font-data)] text-[color:var(--ink)]">
                {progress.invited}
              </span>
            </p>
            <p>
              In progress:{" "}
              <span className="font-[family-name:var(--font-data)] text-[color:var(--ink)]">
                {progress.inProgress}
              </span>
            </p>
            <p>
              Submitted:{" "}
              <span className="font-[family-name:var(--font-data)] text-[color:var(--ink)]">
                {progress.submitted}
              </span>
            </p>
          </div>
        </div>
      }
    >
      {status ? <StatusLine tone={statusTone}>{status}</StatusLine> : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_minmax(280px,360px)]">
        <div className="space-y-4">
          <PageCard title="Suppliers">
            {suppliers.length === 0 ? (
              <EmptyState
                title="No suppliers yet"
                body="Add suppliers first, record email consent, then send an ESG questionnaire."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-[12px]">
                  <thead>
                    <tr className="border-b-2 border-[color:var(--rule-strong)]">
                      <th className="py-2.5 pr-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-[color:var(--ink-muted)]">
                        Name
                      </th>
                      <th className="py-2.5 pr-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-[color:var(--ink-muted)]">
                        Status
                      </th>
                      <th className="py-2.5 pr-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-[color:var(--ink-muted)]">
                        Consent
                      </th>
                      <th className="py-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[color:var(--ink-muted)]">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {suppliers.map((s) => {
                      const q = questionnaires.find((row) => row.supplierId === s.id);
                      return (
                        <tr
                          key={s.id}
                          className={`border-b border-[color:var(--rule)] last:border-b-0 ${
                            selectedId === s.id
                              ? "bg-[color:var(--surface-2)]"
                              : "hover:bg-[color:var(--surface-2)]"
                          }`}
                        >
                          <td className="py-2.5 pr-2 align-top">
                            <button
                              type="button"
                              className="text-left font-medium text-[color:var(--ink)]"
                              onClick={() => selectSupplier(s.id)}
                            >
                              {s.name}
                            </button>
                            <div className="text-[11px] text-[color:var(--ink-muted)]">
                              {s.contactEmail}
                            </div>
                            {q ? (
                              <div className="mt-1 text-[11px] text-[color:var(--ink-muted)]">
                                {reminderCopy(q)}
                              </div>
                            ) : null}
                          </td>
                          <td className="py-2.5 pr-2 align-top text-[color:var(--ink-muted)]">
                            {q ? statusBadge(q.status) : "Not invited"}
                            {q ? (
                              <div className="font-[family-name:var(--font-data)] text-[11px]">
                                {q.completionPercent}%
                              </div>
                            ) : null}
                          </td>
                          <td className="py-2.5 pr-2 align-top">
                            {canWrite ? (
                              <label className="inline-flex items-center gap-1.5 text-[11px] text-[color:var(--ink-muted)]">
                                <input
                                  type="checkbox"
                                  checked={s.emailConsent}
                                  onChange={(e) =>
                                    void setConsent(s.id, e.target.checked)
                                  }
                                />
                                Email OK
                              </label>
                            ) : s.emailConsent ? (
                              "Yes"
                            ) : (
                              "No"
                            )}
                          </td>
                          <td className="py-2.5 align-top">
                            {canWrite ? (
                              <button
                                type="button"
                                className="text-[12px] font-medium text-[color:var(--accent)] underline-offset-2 hover:underline"
                                disabled={pending}
                                onClick={() => void sendQuestionnaire(s.id)}
                              >
                                {q ? "Resend questionnaire" : "Send ESG questionnaire"}
                              </button>
                            ) : (
                              <span className="text-[color:var(--ink-muted)]">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </PageCard>
        </div>

        <div className="space-y-4">
          <PageCard title="Questionnaire detail">
            {!selectedId || !selectedSupplier ? (
              <p className="text-sm text-[color:var(--ink-muted)]">
                Select a supplier to view responses and add review notes.
              </p>
            ) : !selected ? (
              <div className="space-y-3">
                <p className="text-sm text-[color:var(--ink)]">{selectedSupplier.name}</p>
                <p className="text-sm text-[color:var(--ink-muted)]">
                  No questionnaire yet. Record consent, then send.
                </p>
                {canWrite ? (
                  <Button
                    type="button"
                    size="sm"
                    disabled={!selectedSupplier.emailConsent}
                    onClick={() => void sendQuestionnaire(selectedSupplier.id)}
                  >
                    Send ESG questionnaire
                  </Button>
                ) : null}
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <p className="font-medium text-[color:var(--ink)]">
                    {selected.supplierName || selectedSupplier.name}
                  </p>
                  <p className="text-[12px] text-[color:var(--ink-muted)]">
                    {statusBadge(selected.status)} ·{" "}
                    <span className="font-[family-name:var(--font-data)]">
                      {selected.completionPercent}%
                    </span>
                  </p>
                  <p className="mt-1 text-[11px] text-[color:var(--ink-muted)]">
                    {reminderCopy(selected)}
                  </p>
                  {selected.publicToken ? (
                    <p className="mt-2 break-all text-[11px] text-[color:var(--ink-muted)]">
                      Public link: /s/q/{selected.publicToken}
                    </p>
                  ) : null}
                </div>

                <div className="max-h-64 overflow-y-auto border-t border-[color:var(--rule)] pt-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[color:var(--ink-muted)]">
                    Responses
                  </p>
                  {Object.keys(selected.responses).length === 0 ? (
                    <p className="mt-2 text-[12px] text-[color:var(--ink-muted)]">
                      No responses yet.
                    </p>
                  ) : (
                    <dl className="mt-2 space-y-2">
                      {Object.entries(selected.responses).map(([key, value]) => (
                        <div key={key}>
                          <dt className="text-[11px] text-[color:var(--ink-muted)]">
                            {key}
                          </dt>
                          <dd className="font-[family-name:var(--font-data)] text-[12px] text-[color:var(--ink)]">
                            {String(value)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </div>

                {canWrite &&
                (selected.status === "submitted" ||
                  selected.status === "reviewed" ||
                  selected.status === "approved") ? (
                  <div className="space-y-2 border-t border-[color:var(--rule)] pt-3">
                    <label className="block text-[12px] font-medium text-[color:var(--ink)]">
                      Review notes
                      <textarea
                        className="mt-1.5 w-full rounded-[4px] border border-[color:var(--rule)] bg-[color:var(--surface-1)] px-3 py-2 text-sm"
                        rows={3}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                      />
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => void review(false)}
                      >
                        Save review
                      </Button>
                      <Button type="button" size="sm" onClick={() => void review(true)}>
                        Approve
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </PageCard>
        </div>
      </div>
    </PageFrame>
  );
}
