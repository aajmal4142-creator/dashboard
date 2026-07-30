"use client";

import { useCallback, useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { EmptyState, PageFrame, StatusLine } from "@/components/shell/PageFrame";
import { cn } from "@/lib/utils";
import type { TcfdAnswersMap, TcfdPillar, TcfdQuestion } from "@/lib/tcfd";

type DisclosureListItem = {
  id: string;
  reportingYear: number;
  status: string;
  finalisedAt: string | null;
  updatedAt: string;
};

type CompareRow = {
  questionId: string;
  label: string;
  pillar: string;
  textA: string;
  textB: string;
  changed: boolean;
};

const PILLARS: TcfdPillar[] = [
  "governance",
  "strategy",
  "risk_management",
  "metrics_targets",
];

export function TcfdWizardClient({
  canWrite,
  defaultYear,
  questions,
  pillarTitles,
}: {
  canWrite: boolean;
  defaultYear: number;
  questions: TcfdQuestion[];
  pillarTitles: Record<TcfdPillar, string>;
}) {
  const [list, setList] = useState<DisclosureListItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [year, setYear] = useState(defaultYear);
  const [status, setStatus] = useState<string>("draft");
  const [answers, setAnswers] = useState<TcfdAnswersMap>({});
  const [pillar, setPillar] = useState<TcfdPillar>("governance");
  const [message, setMessage] = useState<string | null>(null);
  const [tone, setTone] = useState<"neutral" | "error" | "ok">("neutral");
  const [compareYear, setCompareYear] = useState(defaultYear - 1);
  const [compareRows, setCompareRows] = useState<CompareRow[] | null>(null);
  const [pending, startTransition] = useTransition();

  const locked = status === "final" || !canWrite;

  const loadList = useCallback(() => {
    startTransition(async () => {
      try {
        const res = await fetch("/api/app/compliance/tcfd");
        const data = (await res.json()) as {
          disclosures?: DisclosureListItem[];
          error?: string;
        };
        if (!res.ok) {
          setTone("error");
          setMessage(data.error ?? "Failed to load TCFD disclosures");
          return;
        }
        setList(data.disclosures ?? []);
      } catch (err) {
        setTone("error");
        setMessage(err instanceof Error ? err.message : "Failed to load");
      }
    });
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => {
      loadList();
    }, 0);
    return () => window.clearTimeout(id);
  }, [loadList]);

  function openDisclosure(id: string) {
    startTransition(async () => {
      setTone("neutral");
      setMessage(null);
      setCompareRows(null);
      try {
        const res = await fetch(`/api/app/compliance/tcfd/${id}`);
        const data = (await res.json()) as {
          id?: string;
          reportingYear?: number;
          status?: string;
          answers?: TcfdAnswersMap;
          error?: string;
        };
        if (!res.ok) {
          setTone("error");
          setMessage(data.error ?? "Failed to open disclosure");
          return;
        }
        setActiveId(data.id ?? id);
        setYear(Number(data.reportingYear ?? defaultYear));
        setStatus(String(data.status ?? "draft"));
        setAnswers(data.answers ?? {});
        setPillar("governance");
      } catch (err) {
        setTone("error");
        setMessage(err instanceof Error ? err.message : "Failed to open");
      }
    });
  }

  function createDraft() {
    startTransition(async () => {
      setTone("neutral");
      setMessage("Creating draft…");
      try {
        const res = await fetch("/api/app/compliance/tcfd", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reportingYear: year, autofill: true }),
        });
        const data = (await res.json()) as {
          id?: string;
          error?: string;
          answers?: TcfdAnswersMap;
          status?: string;
          reportingYear?: number;
        };
        if (!res.ok) {
          setTone("error");
          setMessage(data.error ?? "Create failed");
          if (data.id) openDisclosure(String(data.id));
          return;
        }
        setTone("ok");
        setMessage(`Draft TCFD ${data.reportingYear} created with autofill`);
        setActiveId(data.id ?? null);
        setStatus(String(data.status ?? "draft"));
        setAnswers(data.answers ?? {});
        loadList();
      } catch (err) {
        setTone("error");
        setMessage(err instanceof Error ? err.message : "Create failed");
      }
    });
  }

  function saveAnswers() {
    if (!activeId || locked) return;
    startTransition(async () => {
      setMessage("Saving…");
      try {
        const res = await fetch(`/api/app/compliance/tcfd/${activeId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "save", answers }),
        });
        const data = (await res.json()) as {
          answers?: TcfdAnswersMap;
          error?: string;
        };
        if (!res.ok) {
          setTone("error");
          setMessage(data.error ?? "Save failed");
          return;
        }
        setAnswers(data.answers ?? answers);
        setTone("ok");
        setMessage("Saved");
        loadList();
      } catch (err) {
        setTone("error");
        setMessage(err instanceof Error ? err.message : "Save failed");
      }
    });
  }

  function runAutofill() {
    if (!activeId || locked) return;
    startTransition(async () => {
      setMessage("Autofilling from ClearESG…");
      try {
        const res = await fetch(`/api/app/compliance/tcfd/${activeId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "autofill" }),
        });
        const data = (await res.json()) as {
          answers?: TcfdAnswersMap;
          error?: string;
        };
        if (!res.ok) {
          setTone("error");
          setMessage(data.error ?? "Autofill failed");
          return;
        }
        setAnswers(data.answers ?? {});
        setTone("ok");
        setMessage("Emissions and scenarios auto-populated");
      } catch (err) {
        setTone("error");
        setMessage(err instanceof Error ? err.message : "Autofill failed");
      }
    });
  }

  function finalize() {
    if (!activeId || locked) return;
    startTransition(async () => {
      setMessage("Finalising…");
      try {
        const res = await fetch(`/api/app/compliance/tcfd/${activeId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "finalize" }),
        });
        const data = (await res.json()) as { status?: string; error?: string };
        if (!res.ok) {
          setTone("error");
          setMessage(data.error ?? "Finalise failed");
          return;
        }
        setStatus("final");
        setTone("ok");
        setMessage("Finalised — disclosure is locked");
        loadList();
      } catch (err) {
        setTone("error");
        setMessage(err instanceof Error ? err.message : "Finalise failed");
      }
    });
  }

  function runCompare() {
    if (!activeId) return;
    startTransition(async () => {
      try {
        const res = await fetch(
          `/api/app/compliance/tcfd/compare?yearA=${compareYear}&yearB=${year}`,
        );
        const data = (await res.json()) as {
          comparison?: {
            answers: CompareRow[];
            emissions: { totalChangePct: number | null };
          };
          error?: string;
        };
        if (!res.ok) {
          setTone("error");
          setMessage(data.error ?? "Compare failed");
          setCompareRows(null);
          return;
        }
        setCompareRows(data.comparison?.answers ?? []);
        const pct = data.comparison?.emissions.totalChangePct;
        setTone("ok");
        setMessage(
          pct == null
            ? `Compared ${compareYear} → ${year}`
            : `Compared ${compareYear} → ${year} · total emissions ${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`,
        );
      } catch (err) {
        setTone("error");
        setMessage(err instanceof Error ? err.message : "Compare failed");
      }
    });
  }

  const pillarQuestions = questions.filter((q) => q.pillar === pillar);

  return (
    <PageFrame
      eyebrow="Compliance"
      title="TCFD"
      help="Four-pillar climate disclosure wizard. Auto-populate GHG metrics from ClearESG and link Analytics scenarios into Strategy. Draft → final lock; PDF always light theme."
      context={{
        period: activeId ? `Year ${year}` : undefined,
        status: activeId ? status : undefined,
      }}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-[12px] text-ink-muted">
            Year
            <input
              type="number"
              className="w-20 border border-rule bg-surface-1 px-2 py-1 font-data text-ink"
              value={year}
              disabled={Boolean(activeId) || pending}
              onChange={(e) => setYear(Number(e.target.value))}
            />
          </label>
          {canWrite ? (
            <Button type="button" size="sm" disabled={pending} onClick={createDraft}>
              New draft
            </Button>
          ) : null}
          {activeId ? (
            <>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pending || locked}
                onClick={runAutofill}
              >
                Autofill
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pending || locked}
                onClick={saveAnswers}
              >
                Save
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={pending || locked}
                onClick={finalize}
              >
                Finalise
              </Button>
              <a
                className="inline-flex h-8 items-center border border-rule px-3 text-[12px] text-ink hover:border-rule-strong"
                href={`/api/app/compliance/tcfd/${activeId}/pdf`}
                target="_blank"
                rel="noreferrer"
              >
                PDF
              </a>
            </>
          ) : null}
        </div>
      }
      rail={
        <div className="space-y-5 text-[13px] text-ink-muted">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink">
              Disclosures
            </p>
            <ul className="mt-2 space-y-1">
              {list.map((d) => (
                <li key={d.id}>
                  <button
                    type="button"
                    className={cn(
                      "w-full text-left font-data text-[12px]",
                      activeId === d.id ? "text-accent" : "text-ink hover:text-accent",
                    )}
                    onClick={() => openDisclosure(d.id)}
                  >
                    {d.reportingYear} · {d.status}
                  </button>
                </li>
              ))}
              {list.length === 0 ? (
                <li className="text-[12px]">No disclosures yet.</li>
              ) : null}
            </ul>
          </div>
          {activeId ? (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink">
                Prior year
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input
                  type="number"
                  className="w-20 border border-rule bg-surface-1 px-2 py-1 font-data text-ink"
                  value={compareYear}
                  onChange={(e) => setCompareYear(Number(e.target.value))}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={runCompare}
                >
                  Compare
                </Button>
              </div>
            </div>
          ) : null}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink">
              Assurance
            </p>
            <p className="mt-2">ClearESG does not provide assurance or audit opinions.</p>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {message ? <StatusLine tone={tone}>{message}</StatusLine> : null}

        {!activeId ? (
          <EmptyState
            title="No disclosure open"
            body="Create a draft for the reporting year. Emissions and scenario hooks autofill where ClearESG data exists."
          />
        ) : (
          <>
            <div className="flex flex-wrap gap-2 border-b border-rule pb-3">
              {PILLARS.map((p) => (
                <button
                  key={p}
                  type="button"
                  className={cn(
                    "px-3 py-1.5 text-[12px]",
                    pillar === p
                      ? "border-b-2 border-accent font-semibold text-ink"
                      : "text-ink-muted hover:text-ink",
                  )}
                  onClick={() => setPillar(p)}
                >
                  {pillarTitles[p]}
                </button>
              ))}
            </div>

            <div className="space-y-6">
              {pillarQuestions.map((q) => {
                const row = answers[q.id];
                return (
                  <div key={q.id} className="border-b border-rule pb-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-accent">
                      {q.label}
                      {row?.autoFilled ? " · auto" : ""}
                      {q.required ? " · required" : ""}
                    </p>
                    <p className="mt-1 text-[13px] text-ink-muted">{q.prompt}</p>
                    <textarea
                      className="mt-3 w-full min-h-[96px] border border-rule bg-surface-1 px-3 py-2 text-[13px] text-ink outline-none focus:border-rule-strong disabled:opacity-60"
                      value={row?.text ?? ""}
                      disabled={locked || pending}
                      onChange={(e) => {
                        const text = e.target.value;
                        setAnswers((prev) => ({
                          ...prev,
                          [q.id]: {
                            text,
                            source: "manual",
                            autoFilled: false,
                            updatedAt: new Date().toISOString(),
                          },
                        }));
                      }}
                    />
                  </div>
                );
              })}
            </div>

            {compareRows ? (
              <div className="border-t border-rule pt-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink">
                  Year compare · changed answers
                </p>
                <ul className="mt-3 space-y-2 text-[12px]">
                  {compareRows
                    .filter((r) => r.changed)
                    .map((r) => (
                      <li key={r.questionId} className="border-b border-rule pb-2">
                        <span className="text-accent">{r.label}</span>
                        <span className="mt-1 block font-data text-ink-muted">
                          {compareYear}: {r.textA.slice(0, 120) || "—"}
                        </span>
                        <span className="mt-0.5 block font-data text-ink">
                          {year}: {r.textB.slice(0, 120) || "—"}
                        </span>
                      </li>
                    ))}
                  {compareRows.filter((r) => r.changed).length === 0 ? (
                    <li className="text-ink-muted">No answer text changes.</li>
                  ) : null}
                </ul>
              </div>
            ) : null}
          </>
        )}
      </div>
    </PageFrame>
  );
}
