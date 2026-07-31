"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";

import type {
  EngagementStatus,
  QuestionnaireQuestion,
  QuestionnaireTemplate,
} from "@/lib/suppliers/engagementWorkflow";

type PublicMeta = {
  token: string;
  orgName: string;
  supplierName: string;
  status: EngagementStatus;
  expired: boolean;
  alreadySubmitted: boolean;
  expiresAt: string | null;
  template: QuestionnaireTemplate;
  responses: Record<string, unknown>;
  completionPercent: number;
  error?: string;
};

function draftKey(token: string) {
  return `clearesg-esg-q:${token}`;
}

function groupBySection(questions: QuestionnaireQuestion[]) {
  const map = new Map<string, { label: string; questions: QuestionnaireQuestion[] }>();
  for (const q of questions) {
    const existing = map.get(q.section);
    if (existing) {
      existing.questions.push(q);
    } else {
      map.set(q.section, { label: q.sectionLabel, questions: [q] });
    }
  }
  return [...map.entries()];
}

export function EngagementPublicForm({
  token,
  initial,
}: {
  token: string;
  initial: PublicMeta;
}) {
  const [meta, setMeta] = useState(initial);
  const [values, setValues] = useState<Record<string, string>>(() => {
    const seed: Record<string, string> = {};
    for (const [k, v] of Object.entries(initial.responses ?? {})) {
      if (v === null || v === undefined) continue;
      if (typeof v === "boolean") {
        seed[k] = v ? "yes" : "no";
      } else {
        seed[k] = String(v);
      }
    }
    if (typeof window === "undefined" || initial.alreadySubmitted) return seed;
    try {
      const raw = localStorage.getItem(draftKey(token));
      if (!raw) return seed;
      const parsed = JSON.parse(raw) as Record<string, string>;
      return { ...seed, ...parsed };
    } catch {
      return seed;
    }
  });
  const [status, setStatus] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<"neutral" | "error" | "ok">("neutral");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (meta.alreadySubmitted || meta.expired) return;
    try {
      localStorage.setItem(draftKey(token), JSON.stringify(values));
    } catch {
      /* ignore */
    }
  }, [values, token, meta.alreadySubmitted, meta.expired]);

  const sections = useMemo(
    () => groupBySection(meta.template.questions),
    [meta.template.questions],
  );

  function note(message: string, tone: "neutral" | "error" | "ok" = "neutral") {
    setStatusTone(tone);
    setStatus(message);
  }

  function setField(id: string, value: string) {
    setValues((prev) => ({ ...prev, [id]: value }));
  }

  async function save(draft: boolean) {
    if (meta.expired || meta.alreadySubmitted) return;
    setSaving(true);
    note(draft ? "Saving draft…" : "Submitting…");

    const responses: Record<string, unknown> = {};
    for (const q of meta.template.questions) {
      const raw = values[q.id];
      if (raw === undefined || raw === "") continue;
      if (q.type === "number") {
        const n = Number(raw);
        responses[q.id] = Number.isFinite(n) ? n : raw;
      } else if (q.type === "yes_no" || q.type === "checkbox") {
        responses[q.id] = raw === "yes" || raw === "true";
      } else {
        responses[q.id] = raw;
      }
    }

    const res = await fetch(
      `/api/app/suppliers/questionnaire/${encodeURIComponent(token)}/submit`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responses, draft }),
      },
    );
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      missing?: string[];
      completionPercent?: number;
      status?: EngagementStatus;
    };
    setSaving(false);

    if (!res.ok) {
      note(
        data.missing?.length
          ? `Required fields missing (${data.missing.length}). Complete highlighted sections.`
          : (data.error ?? "Could not save. Try again."),
        "error",
      );
      return;
    }

    if (draft) {
      note(`Draft saved (${data.completionPercent ?? 0}% complete).`, "ok");
      return;
    }

    try {
      localStorage.removeItem(draftKey(token));
    } catch {
      /* ignore */
    }
    setMeta((m) => ({
      ...m,
      alreadySubmitted: true,
      status: data.status ?? "submitted",
      completionPercent: data.completionPercent ?? 100,
      responses,
    }));
    note("Questionnaire submitted. Thank you.", "ok");
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void save(false);
  }

  if (meta.error) {
    return (
      <div className="mx-auto max-w-lg px-5 py-16 sm:px-6">
        <h1 className="font-[family-name:var(--font-display)] text-2xl text-[color:var(--ink)]">
          Link not valid
        </h1>
        <p className="mt-2 text-sm text-[color:var(--ink-muted)]">{meta.error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-[color:var(--canvas)] text-[color:var(--ink)]">
      <header className="border-b border-[color:var(--rule)] bg-[color:var(--surface-1)]">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-5 py-4 sm:px-6">
          <div className="flex size-9 items-center justify-center rounded-[2px] bg-[color:var(--accent)] text-xs font-medium text-[color:var(--on-accent)]">
            {(meta.orgName || "?").slice(0, 2).toUpperCase()}
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[color:var(--ink-muted)]">
              {meta.orgName}
            </p>
            <p className="text-sm text-[color:var(--ink)]">ESG questionnaire</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-5 py-8 sm:px-6">
        <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight text-[color:var(--ink)]">
          {meta.supplierName}
        </h1>
        <p className="mt-2 text-sm text-[color:var(--ink-muted)]">
          Share company, emissions, supply-chain, certification, and goals data. No
          account required.
          {meta.expiresAt ? ` Link expires ${meta.expiresAt.slice(0, 10)}.` : null}
        </p>

        {status ? (
          <p
            className={`mt-4 border-t border-[color:var(--rule)] pt-3 text-sm ${
              statusTone === "error"
                ? "text-[color:var(--rust)]"
                : statusTone === "ok"
                  ? "text-[color:var(--signal)]"
                  : "text-[color:var(--ink-muted)]"
            }`}
            role="status"
          >
            {status}
          </p>
        ) : null}

        {meta.expired ? (
          <p className="mt-6 text-sm text-[color:var(--rust)]">
            This questionnaire link has expired. Ask {meta.orgName} to resend.
          </p>
        ) : null}

        {meta.alreadySubmitted ? (
          <p className="mt-6 text-sm text-[color:var(--ink-muted)]">
            Submitted ({meta.completionPercent}% of fields completed). Contact{" "}
            {meta.orgName} if you need to correct answers.
          </p>
        ) : null}

        {!meta.expired && !meta.alreadySubmitted ? (
          <form onSubmit={onSubmit} className="mt-8 space-y-8">
            {sections.map(([sectionKey, section]) => (
              <section
                key={sectionKey}
                className="border-t border-[color:var(--rule)] pt-5"
              >
                <h2 className="font-[family-name:var(--font-display)] text-xl text-[color:var(--ink)]">
                  {section.label}
                </h2>
                <div className="mt-4 space-y-4">
                  {section.questions.map((q) => (
                    <label key={q.id} className="block">
                      <span className="text-[12px] font-medium text-[color:var(--ink)]">
                        {q.question}
                        {q.required ? (
                          <span className="text-[color:var(--accent)]"> *</span>
                        ) : null}
                      </span>
                      {q.type === "textarea" ? (
                        <textarea
                          className="mt-1.5 w-full rounded-[4px] border border-[color:var(--rule)] bg-[color:var(--surface-1)] px-3 py-2 text-sm text-[color:var(--ink)]"
                          rows={3}
                          placeholder={q.placeholder}
                          value={values[q.id] ?? ""}
                          onChange={(e) => setField(q.id, e.target.value)}
                        />
                      ) : q.type === "select" ? (
                        <select
                          className="mt-1.5 w-full rounded-[4px] border border-[color:var(--rule)] bg-[color:var(--surface-1)] px-3 py-2 text-sm text-[color:var(--ink)]"
                          value={values[q.id] ?? ""}
                          onChange={(e) => setField(q.id, e.target.value)}
                        >
                          <option value="">Select…</option>
                          {(q.options ?? []).map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      ) : q.type === "yes_no" ? (
                        <select
                          className="mt-1.5 w-full rounded-[4px] border border-[color:var(--rule)] bg-[color:var(--surface-1)] px-3 py-2 text-sm text-[color:var(--ink)]"
                          value={values[q.id] ?? ""}
                          onChange={(e) => setField(q.id, e.target.value)}
                        >
                          <option value="">Select…</option>
                          <option value="yes">Yes</option>
                          <option value="no">No</option>
                        </select>
                      ) : (
                        <input
                          type={q.type === "number" ? "number" : "text"}
                          className={`mt-1.5 w-full rounded-[4px] border border-[color:var(--rule)] bg-[color:var(--surface-1)] px-3 py-2 text-sm text-[color:var(--ink)] ${
                            q.type === "number"
                              ? "font-[family-name:var(--font-data)]"
                              : ""
                          }`}
                          placeholder={q.placeholder}
                          value={values[q.id] ?? ""}
                          onChange={(e) => setField(q.id, e.target.value)}
                        />
                      )}
                    </label>
                  ))}
                </div>
              </section>
            ))}

            <div className="flex flex-wrap gap-3 border-t border-[color:var(--rule-strong)] pt-5">
              <button
                type="button"
                disabled={saving}
                onClick={() => void save(true)}
                className="rounded-[4px] border border-[color:var(--rule)] px-4 py-2 text-sm text-[color:var(--ink)] hover:bg-[color:var(--surface-2)]"
              >
                Save draft
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-[4px] bg-[color:var(--accent)] px-4 py-2 text-sm font-medium text-[color:var(--on-accent)] hover:bg-[color:var(--accent-hover)]"
              >
                Submit questionnaire
              </button>
            </div>
          </form>
        ) : null}
      </main>
    </div>
  );
}
