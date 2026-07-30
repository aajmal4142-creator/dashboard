"use client";

import { useCallback, useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { EmptyState, PageFrame, StatusLine } from "@/components/shell/PageFrame";
import { cn } from "@/lib/utils";
import {
  INDUSTRY_LABELS,
  type ComplianceAnswersMap,
  type ComplianceAnswerValue,
  type ComplianceCalcResultsMap,
  type ComplianceIndustry,
  type ComplianceTemplateSnapshot,
} from "@/lib/complianceTemplates";

type TemplateListItem = {
  id: string;
  templateName: string;
  description: string | null;
  industry: ComplianceIndustry | null;
  isPublic: boolean;
  organisationId: string | null;
  questionCount: number;
  calculationCount: number;
};

type AssessmentListItem = {
  id: string;
  title: string;
  reportingYear: number;
  status: string;
  templateId: string | null;
  templateName: string | null;
  finalisedAt: string | null;
  updatedAt: string;
};

type View = "library" | "create" | "assessment";

export function ComplianceTemplatesClient({
  canWrite,
  defaultYear,
}: {
  canWrite: boolean;
  defaultYear: number;
}) {
  const [view, setView] = useState<View>("library");
  const [templates, setTemplates] = useState<TemplateListItem[]>([]);
  const [assessments, setAssessments] = useState<AssessmentListItem[]>([]);
  const [industryFilter, setIndustryFilter] = useState<ComplianceIndustry | "all">("all");
  const [year, setYear] = useState(defaultYear);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [status, setStatus] = useState("draft");
  const [title, setTitle] = useState("");
  const [answers, setAnswers] = useState<ComplianceAnswersMap>({});
  const [calcResults, setCalcResults] = useState<ComplianceCalcResultsMap>({});
  const [templateSnap, setTemplateSnap] = useState<ComplianceTemplateSnapshot | null>(
    null,
  );
  const [sectionKey, setSectionKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [tone, setTone] = useState<"neutral" | "error" | "ok">("neutral");
  const [pending, startTransition] = useTransition();

  // Custom template draft form
  const [newName, setNewName] = useState("");
  const [newIndustry, setNewIndustry] = useState<ComplianceIndustry>("general");
  const [newQLabel, setNewQLabel] = useState("");
  const [newQPrompt, setNewQPrompt] = useState("");
  const [newQType, setNewQType] = useState<"text" | "number">("text");

  const locked = status === "final" || !canWrite;

  const loadLibrary = useCallback(() => {
    startTransition(async () => {
      try {
        const q =
          industryFilter === "all"
            ? ""
            : `?industry=${encodeURIComponent(industryFilter)}`;
        const [tRes, aRes] = await Promise.all([
          fetch(`/api/app/compliance/templates${q}`),
          fetch("/api/app/compliance/assessments"),
        ]);
        const tData = (await tRes.json()) as {
          templates?: TemplateListItem[];
          error?: string;
        };
        const aData = (await aRes.json()) as {
          assessments?: AssessmentListItem[];
          error?: string;
        };
        if (!tRes.ok) {
          setTone("error");
          setMessage(tData.error ?? "Failed to load templates");
          return;
        }
        if (!aRes.ok) {
          setTone("error");
          setMessage(aData.error ?? "Failed to load assessments");
          return;
        }
        setTemplates(tData.templates ?? []);
        setAssessments(aData.assessments ?? []);
      } catch (err) {
        setTone("error");
        setMessage(err instanceof Error ? err.message : "Failed to load");
      }
    });
  }, [industryFilter]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      loadLibrary();
    }, 0);
    return () => window.clearTimeout(id);
  }, [loadLibrary]);

  function startAssessment(templateId: string) {
    if (!canWrite) return;
    startTransition(async () => {
      setMessage("Creating assessment…");
      try {
        const res = await fetch("/api/app/compliance/assessments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ templateId, reportingYear: year }),
        });
        const data = (await res.json()) as {
          id?: string;
          title?: string;
          status?: string;
          answers?: ComplianceAnswersMap;
          calculationResults?: ComplianceCalcResultsMap;
          templateSnapshot?: ComplianceTemplateSnapshot;
          error?: string;
        };
        if (!res.ok) {
          setTone("error");
          setMessage(data.error ?? "Create failed");
          return;
        }
        setActiveId(data.id ?? null);
        setTitle(data.title ?? "");
        setStatus(String(data.status ?? "draft"));
        setAnswers(data.answers ?? {});
        setCalcResults(data.calculationResults ?? {});
        setTemplateSnap(data.templateSnapshot ?? null);
        setSectionKey(data.templateSnapshot?.sections[0]?.sectionKey ?? null);
        setView("assessment");
        setTone("ok");
        setMessage("Assessment draft created");
        loadLibrary();
      } catch (err) {
        setTone("error");
        setMessage(err instanceof Error ? err.message : "Create failed");
      }
    });
  }

  function openAssessment(id: string) {
    startTransition(async () => {
      setTone("neutral");
      setMessage(null);
      try {
        const res = await fetch(`/api/app/compliance/assessments/${id}`);
        const data = (await res.json()) as {
          id?: string;
          title?: string;
          status?: string;
          answers?: ComplianceAnswersMap;
          calculationResults?: ComplianceCalcResultsMap;
          templateSnapshot?: ComplianceTemplateSnapshot;
          error?: string;
        };
        if (!res.ok) {
          setTone("error");
          setMessage(data.error ?? "Failed to open");
          return;
        }
        setActiveId(data.id ?? id);
        setTitle(data.title ?? "");
        setStatus(String(data.status ?? "draft"));
        setAnswers(data.answers ?? {});
        setCalcResults(data.calculationResults ?? {});
        setTemplateSnap(data.templateSnapshot ?? null);
        setSectionKey(data.templateSnapshot?.sections[0]?.sectionKey ?? null);
        setView("assessment");
      } catch (err) {
        setTone("error");
        setMessage(err instanceof Error ? err.message : "Failed to open");
      }
    });
  }

  function setAnswer(questionId: string, value: ComplianceAnswerValue) {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { value, updatedAt: new Date().toISOString() },
    }));
  }

  function saveAnswers() {
    if (!activeId || locked) return;
    startTransition(async () => {
      setMessage("Saving…");
      try {
        const res = await fetch(`/api/app/compliance/assessments/${activeId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "save", answers, title }),
        });
        const data = (await res.json()) as {
          answers?: ComplianceAnswersMap;
          calculationResults?: ComplianceCalcResultsMap;
          error?: string;
        };
        if (!res.ok) {
          setTone("error");
          setMessage(data.error ?? "Save failed");
          return;
        }
        setAnswers(data.answers ?? answers);
        setCalcResults(data.calculationResults ?? {});
        setTone("ok");
        setMessage("Saved");
        loadLibrary();
      } catch (err) {
        setTone("error");
        setMessage(err instanceof Error ? err.message : "Save failed");
      }
    });
  }

  function finalize() {
    if (!activeId || locked) return;
    startTransition(async () => {
      setMessage("Finalising…");
      try {
        const res = await fetch(`/api/app/compliance/assessments/${activeId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "finalize", answers, title }),
        });
        const data = (await res.json()) as {
          status?: string;
          calculationResults?: ComplianceCalcResultsMap;
          error?: string;
        };
        if (!res.ok) {
          setTone("error");
          setMessage(data.error ?? "Finalise failed");
          return;
        }
        setStatus("final");
        setCalcResults(data.calculationResults ?? calcResults);
        setTone("ok");
        setMessage("Finalised — assessment is locked");
        loadLibrary();
      } catch (err) {
        setTone("error");
        setMessage(err instanceof Error ? err.message : "Finalise failed");
      }
    });
  }

  function createCustomTemplate() {
    if (!canWrite) return;
    const label = newQLabel.trim();
    const prompt = newQPrompt.trim();
    if (!newName.trim() || !label || !prompt) {
      setTone("error");
      setMessage("Name, question label, and prompt are required");
      return;
    }
    startTransition(async () => {
      setMessage("Creating template…");
      try {
        const qId = `q-${label
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .slice(0, 24)}`;
        const res = await fetch("/api/app/compliance/templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            templateName: newName.trim(),
            industry: newIndustry,
            sections: [
              {
                sectionTitle: "Questions",
                sectionKey: "questions",
                sectionType: "questions",
                order: 1,
              },
            ],
            questions: [
              {
                questionId: qId,
                sectionKey: "questions",
                label,
                prompt,
                answerType: newQType,
                required: true,
                order: 1,
              },
            ],
            calculations: [],
          }),
        });
        const data = (await res.json()) as { id?: string; error?: string };
        if (!res.ok) {
          setTone("error");
          setMessage(data.error ?? "Create failed");
          return;
        }
        setTone("ok");
        setMessage("Custom template created");
        setNewName("");
        setNewQLabel("");
        setNewQPrompt("");
        setView("library");
        loadLibrary();
      } catch (err) {
        setTone("error");
        setMessage(err instanceof Error ? err.message : "Create failed");
      }
    });
  }

  const sections = templateSnap?.sections ?? [];
  const activeSection = sectionKey ?? sections[0]?.sectionKey ?? null;
  const sectionQuestions =
    templateSnap?.questions.filter((q) => q.sectionKey === activeSection) ?? [];
  const sectionCalcs =
    templateSnap?.calculations.filter(
      (c) => (c.sectionKey ?? activeSection) === activeSection,
    ) ?? [];

  return (
    <PageFrame
      eyebrow="Compliance"
      title="Templates"
      help="Industry starters and custom compliance questionnaires. Fill an assessment, run derived calculations, export a light-theme PDF."
      context={{
        period: view === "assessment" && activeId ? title : undefined,
        status: view === "assessment" && activeId ? status : undefined,
      }}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {view !== "library" ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => {
                setView("library");
                setActiveId(null);
                setTemplateSnap(null);
              }}
            >
              Library
            </Button>
          ) : null}
          {view === "library" && canWrite ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => setView("create")}
            >
              New template
            </Button>
          ) : null}
          {view === "assessment" && activeId ? (
            <>
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
                href={`/api/app/compliance/assessments/${activeId}/pdf`}
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
              Assessments
            </p>
            <ul className="mt-2 space-y-1">
              {assessments.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    className={cn(
                      "w-full text-left font-data text-[12px]",
                      activeId === a.id ? "text-accent" : "text-ink hover:text-accent",
                    )}
                    onClick={() => openAssessment(a.id)}
                  >
                    {a.reportingYear} · {a.status}
                    <span className="mt-0.5 block truncate text-ink-muted">
                      {a.title}
                    </span>
                  </button>
                </li>
              ))}
              {assessments.length === 0 ? (
                <li className="text-[12px]">No assessments yet.</li>
              ) : null}
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
        {message ? <StatusLine tone={tone}>{message}</StatusLine> : null}

        {view === "library" ? (
          <>
            <div className="flex flex-wrap items-center gap-3 border-b border-rule pb-3">
              <label className="flex items-center gap-2 text-[12px] text-ink-muted">
                Industry
                <select
                  className="border border-rule bg-surface-1 px-2 py-1 text-ink"
                  value={industryFilter}
                  onChange={(e) =>
                    setIndustryFilter(e.target.value as ComplianceIndustry | "all")
                  }
                >
                  <option value="all">All</option>
                  {(Object.keys(INDUSTRY_LABELS) as ComplianceIndustry[]).map((k) => (
                    <option key={k} value={k}>
                      {INDUSTRY_LABELS[k]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 text-[12px] text-ink-muted">
                Year
                <input
                  type="number"
                  className="w-20 border border-rule bg-surface-1 px-2 py-1 font-data text-ink"
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                />
              </label>
            </div>

            {templates.length === 0 ? (
              <EmptyState
                title="No templates"
                body="Industry starters seed on first load. Create a custom template if you need a bespoke questionnaire."
              />
            ) : (
              <ul className="divide-y divide-rule border-t border-rule">
                {templates.map((t) => (
                  <li
                    key={t.id}
                    className="flex flex-wrap items-start justify-between gap-3 py-4"
                  >
                    <div className="min-w-0 max-w-[60ch]">
                      <p className="text-[14px] font-semibold text-ink">
                        {t.templateName}
                      </p>
                      <p className="mt-1 text-[12px] text-ink-muted">
                        {t.industry ? INDUSTRY_LABELS[t.industry] : "General"}
                        {" · "}
                        {t.isPublic ? "Starter" : "Custom"}
                        {" · "}
                        <span className="font-data">
                          {t.questionCount} questions · {t.calculationCount} calcs
                        </span>
                      </p>
                      {t.description ? (
                        <p className="mt-2 text-[13px] text-ink-muted">{t.description}</p>
                      ) : null}
                    </div>
                    {canWrite ? (
                      <Button
                        type="button"
                        size="sm"
                        disabled={pending}
                        onClick={() => startAssessment(t.id)}
                      >
                        Start assessment
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : null}

        {view === "create" ? (
          <div className="max-w-xl space-y-4">
            <p className="text-[13px] text-ink-muted">
              Create an org-owned compliance template. Add at least one question; you can
              extend it later via the API.
            </p>
            <label className="block text-[12px] text-ink-muted">
              Template name
              <input
                className="mt-1 w-full border border-rule bg-surface-1 px-3 py-2 text-[13px] text-ink"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                disabled={pending}
              />
            </label>
            <label className="block text-[12px] text-ink-muted">
              Industry
              <select
                className="mt-1 w-full border border-rule bg-surface-1 px-3 py-2 text-ink"
                value={newIndustry}
                onChange={(e) => setNewIndustry(e.target.value as ComplianceIndustry)}
                disabled={pending}
              >
                {(Object.keys(INDUSTRY_LABELS) as ComplianceIndustry[]).map((k) => (
                  <option key={k} value={k}>
                    {INDUSTRY_LABELS[k]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-[12px] text-ink-muted">
              First question label
              <input
                className="mt-1 w-full border border-rule bg-surface-1 px-3 py-2 text-[13px] text-ink"
                value={newQLabel}
                onChange={(e) => setNewQLabel(e.target.value)}
                disabled={pending}
              />
            </label>
            <label className="block text-[12px] text-ink-muted">
              Prompt
              <textarea
                className="mt-1 w-full min-h-[80px] border border-rule bg-surface-1 px-3 py-2 text-[13px] text-ink"
                value={newQPrompt}
                onChange={(e) => setNewQPrompt(e.target.value)}
                disabled={pending}
              />
            </label>
            <label className="block text-[12px] text-ink-muted">
              Answer type
              <select
                className="mt-1 w-full border border-rule bg-surface-1 px-3 py-2 text-ink"
                value={newQType}
                onChange={(e) => setNewQType(e.target.value as "text" | "number")}
                disabled={pending}
              >
                <option value="text">Text</option>
                <option value="number">Number</option>
              </select>
            </label>
            <Button
              type="button"
              disabled={pending || !canWrite}
              onClick={createCustomTemplate}
            >
              Create template
            </Button>
          </div>
        ) : null}

        {view === "assessment" && templateSnap ? (
          <>
            <label className="block max-w-xl text-[12px] text-ink-muted">
              Title
              <input
                className="mt-1 w-full border border-rule bg-surface-1 px-3 py-2 text-[13px] text-ink disabled:opacity-60"
                value={title}
                disabled={locked || pending}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>

            <div className="flex flex-wrap gap-2 border-b border-rule pb-3">
              {sections.map((s) => (
                <button
                  key={s.sectionKey}
                  type="button"
                  className={cn(
                    "px-3 py-1.5 text-[12px]",
                    activeSection === s.sectionKey
                      ? "border-b-2 border-accent font-semibold text-ink"
                      : "text-ink-muted hover:text-ink",
                  )}
                  onClick={() => setSectionKey(s.sectionKey)}
                >
                  {s.sectionTitle}
                </button>
              ))}
            </div>

            <div className="space-y-6">
              {sectionQuestions.map((q) => {
                const row = answers[q.questionId];
                const value = row?.value ?? "";
                return (
                  <div key={q.questionId} className="border-b border-rule pb-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-accent">
                      {q.label}
                      {q.required ? " · required" : ""}
                      {q.unit ? ` · ${q.unit}` : ""}
                    </p>
                    <p className="mt-1 text-[13px] text-ink-muted">{q.prompt}</p>
                    {q.answerType === "number" ? (
                      <input
                        type="number"
                        className="mt-3 w-full max-w-xs border border-rule bg-surface-1 px-3 py-2 font-data text-[13px] text-ink outline-none focus:border-rule-strong disabled:opacity-60"
                        value={
                          typeof value === "number" || typeof value === "string"
                            ? value
                            : ""
                        }
                        disabled={locked || pending}
                        onChange={(e) => {
                          const raw = e.target.value;
                          setAnswer(q.questionId, raw === "" ? null : Number(raw));
                        }}
                      />
                    ) : q.answerType === "boolean" ? (
                      <select
                        className="mt-3 border border-rule bg-surface-1 px-3 py-2 text-[13px] text-ink disabled:opacity-60"
                        value={value === true ? "yes" : value === false ? "no" : ""}
                        disabled={locked || pending}
                        onChange={(e) => {
                          const v = e.target.value;
                          setAnswer(
                            q.questionId,
                            v === "yes" ? true : v === "no" ? false : null,
                          );
                        }}
                      >
                        <option value="">—</option>
                        <option value="yes">Yes</option>
                        <option value="no">No</option>
                      </select>
                    ) : (
                      <textarea
                        className="mt-3 w-full min-h-[96px] border border-rule bg-surface-1 px-3 py-2 text-[13px] text-ink outline-none focus:border-rule-strong disabled:opacity-60"
                        value={
                          typeof value === "string"
                            ? value
                            : value == null
                              ? ""
                              : String(value)
                        }
                        disabled={locked || pending}
                        onChange={(e) => setAnswer(q.questionId, e.target.value)}
                      />
                    )}
                  </div>
                );
              })}

              {sectionCalcs.length > 0 ? (
                <div className="space-y-3 border-t border-rule pt-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink">
                    Calculations
                  </p>
                  <p className="text-[12px] text-ink-muted">
                    Values refresh on save from numeric answers.
                  </p>
                  <ul className="space-y-2">
                    {sectionCalcs.map((c) => {
                      const r = calcResults[c.calcId];
                      return (
                        <li key={c.calcId} className="border-b border-rule pb-2">
                          <span className="text-[13px] text-ink">{c.label}</span>
                          <span className="mt-0.5 block font-data text-[12px] text-ink-muted">
                            {r?.quality === "calculated" && r.value != null
                              ? `${r.value}${r.unit ? ` ${r.unit}` : ""}`
                              : "Missing inputs — save after filling numbers"}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}
            </div>
          </>
        ) : null}

        {view === "assessment" && !templateSnap ? (
          <EmptyState
            title="No assessment open"
            body="Pick a template from the library or open an existing assessment from the rail."
          />
        ) : null}
      </div>
    </PageFrame>
  );
}
