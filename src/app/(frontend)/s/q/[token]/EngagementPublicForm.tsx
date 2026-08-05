"use client";

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";

import { brandingCssVarsToInlineStyle, brandingToCssVars } from "@/lib/branding";
import { DEFAULT_PORTAL_WELCOME, type SupplierPortalConfigView } from "@/lib/portal";
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
  branding?: {
    primaryColor: string | null;
    logoUrl: string | null;
  };
  portal?: SupplierPortalConfigView;
  portalPaused?: boolean;
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

function PortalChrome({ meta, children }: { meta: PublicMeta; children: ReactNode }) {
  const brandStyle = brandingCssVarsToInlineStyle(
    brandingToCssVars({
      primaryColor: meta.branding?.primaryColor ?? null,
      secondaryColor: null,
      fontFamily: null,
      defaultMode: null,
      radius: null,
      logoId: null,
      logoUrl: meta.branding?.logoUrl ?? null,
      domain: null,
    }),
  );

  return (
    <div className="min-h-full bg-canvas text-ink" style={brandStyle} data-portal-chrome>
      <header className="border-b border-rule bg-surface-1">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-5 py-4 sm:px-6">
          {meta.branding?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={meta.branding.logoUrl}
              alt=""
              className="h-9 w-auto max-w-[10rem] object-contain"
            />
          ) : (
            <div className="flex size-9 items-center justify-center rounded-[var(--radius-chip)] bg-accent text-xs font-medium text-on-accent">
              {(meta.orgName || "?").slice(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <p className="label-caps text-ink-muted">{meta.orgName}</p>
            <p className="text-sm text-ink">
              {meta.portal?.headline?.trim() || "ESG questionnaire"}
            </p>
          </div>
        </div>
      </header>
      {children}
      {meta.portal?.showPoweredBy !== false ? (
        <footer className="border-t border-rule py-4 text-center text-[11px] text-ink-muted">
          Powered by ClearESG
        </footer>
      ) : null}
    </div>
  );
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
      <PortalChrome meta={meta}>
        <div className="mx-auto max-w-lg px-5 py-16 sm:px-6">
          <h1 className="font-[family-name:var(--font-display)] text-2xl text-ink">
            Link not valid
          </h1>
          <p className="mt-2 text-sm text-ink-muted">{meta.error}</p>
        </div>
      </PortalChrome>
    );
  }

  if (meta.portalPaused) {
    return (
      <PortalChrome meta={meta}>
        <div className="mx-auto max-w-lg px-5 py-16 sm:px-6">
          <h1 className="font-[family-name:var(--font-display)] text-2xl text-ink">
            Portal paused
          </h1>
          <p className="mt-2 text-sm text-ink-muted">
            This organisation has paused supplier questionnaire intake. Contact them
            directly if you need to submit data.
          </p>
        </div>
      </PortalChrome>
    );
  }

  const welcome =
    meta.portal?.welcomeMessage?.trim() ||
    DEFAULT_PORTAL_WELCOME ||
    "Share company, emissions, supply-chain, certification, and goals data.";

  return (
    <PortalChrome meta={meta}>
      <main className="mx-auto max-w-2xl px-5 py-8 sm:px-6">
        <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight text-ink">
          {meta.supplierName}
        </h1>
        <p className="mt-2 text-sm text-ink-muted">{welcome}</p>

        {meta.expired ? (
          <p className="mt-6 text-sm text-rust" role="alert">
            This questionnaire link has expired.
          </p>
        ) : null}

        {meta.alreadySubmitted ? (
          <p className="mt-6 text-sm text-signal" role="status">
            Already submitted ({meta.completionPercent}% complete). Thank you.
          </p>
        ) : null}

        {status ? (
          <p
            className={`mt-4 text-sm ${
              statusTone === "error"
                ? "text-rust"
                : statusTone === "ok"
                  ? "text-signal"
                  : "text-ink-muted"
            }`}
            role="status"
          >
            {status}
          </p>
        ) : null}

        {!meta.expired && !meta.alreadySubmitted ? (
          <form onSubmit={onSubmit} className="mt-8 space-y-8">
            {sections.map(([sectionId, section]) => (
              <fieldset key={sectionId} className="space-y-4 border-t border-rule pt-6">
                <legend className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                  {section.label}
                </legend>
                {section.questions.map((q) => (
                  <label key={q.id} className="block text-[13px] text-ink">
                    <span className="font-semibold">
                      {q.question}
                      {q.required ? <span className="text-rust"> *</span> : null}
                    </span>
                    {q.type === "yes_no" || q.type === "checkbox" ? (
                      <select
                        className="mt-2 h-9 w-full rounded-[4px] border border-rule bg-surface-1 px-2 text-[13px]"
                        value={values[q.id] ?? ""}
                        onChange={(e) => setField(q.id, e.target.value)}
                        required={q.required}
                      >
                        <option value="">—</option>
                        <option value="yes">Yes</option>
                        <option value="no">No</option>
                      </select>
                    ) : q.type === "select" ? (
                      <select
                        className="mt-2 h-9 w-full rounded-[4px] border border-rule bg-surface-1 px-2 text-[13px]"
                        value={values[q.id] ?? ""}
                        onChange={(e) => setField(q.id, e.target.value)}
                        required={q.required}
                      >
                        <option value="">—</option>
                        {(q.options ?? []).map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    ) : q.type === "textarea" ? (
                      <textarea
                        className="mt-2 w-full rounded-[4px] border border-rule bg-surface-1 px-2 py-2 text-[13px]"
                        rows={3}
                        placeholder={q.placeholder}
                        value={values[q.id] ?? ""}
                        onChange={(e) => setField(q.id, e.target.value)}
                        required={q.required}
                      />
                    ) : (
                      <input
                        type={q.type === "number" ? "number" : "text"}
                        className="mt-2 h-9 w-full rounded-[4px] border border-rule bg-surface-1 px-2 font-mono text-[13px] tabular-nums"
                        placeholder={q.placeholder}
                        value={values[q.id] ?? ""}
                        onChange={(e) => setField(q.id, e.target.value)}
                        required={q.required}
                      />
                    )}
                  </label>
                ))}
              </fieldset>
            ))}

            <div className="flex flex-wrap gap-2 border-t border-rule pt-6">
              <button
                type="button"
                disabled={saving}
                onClick={() => void save(true)}
                className="inline-flex h-9 items-center rounded-[4px] border border-rule bg-surface-1 px-4 text-[13px] text-ink hover:border-rule-strong disabled:opacity-50"
              >
                Save draft
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex h-9 items-center rounded-[4px] bg-accent px-4 text-[13px] text-canvas hover:bg-accent-hover disabled:opacity-50"
              >
                {saving ? "Submitting…" : "Submit"}
              </button>
            </div>
          </form>
        ) : null}
      </main>
    </PortalChrome>
  );
}
