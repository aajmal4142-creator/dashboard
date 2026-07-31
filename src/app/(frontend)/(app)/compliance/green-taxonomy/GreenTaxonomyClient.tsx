"use client";

import { useEffect, useState, useTransition } from "react";
import { Download, Leaf, Plus, Search } from "lucide-react";

import { EmptyState, StatusLine } from "@/components/shell/PageFrame";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type YesNo = "yes" | "no" | "unanswered";
type AssessmentStatus = "draft" | "completed" | "verified";
type ObjectiveId =
  | "climate_mitigation"
  | "climate_adaptation"
  | "water"
  | "circular_economy"
  | "pollution"
  | "biodiversity";

type CriterionDef = { id: string; label: string; prompt: string };

type ObjectiveDef = {
  id: ObjectiveId;
  label: string;
  shortLabel: string;
  description: string;
  criteriaCount: number;
  dnshCount: number;
  criteria: CriterionDef[];
  dnsh: CriterionDef[];
};

type NaceRow = {
  code: string;
  name: string;
  section: string;
  level: "section" | "division" | "class";
};

type CriteriaAnswer = {
  criteriaId: string;
  met: YesNo;
  evidenceId?: string | null;
  notes?: string | null;
};

type ObjectiveAnswer = {
  objective: ObjectiveId;
  applicable: YesNo;
  answers: CriteriaAnswer[];
};

type DnshAnswer = {
  objective: ObjectiveId;
  criteriaId: string;
  compliant: YesNo;
  notes?: string | null;
};

type ObjectiveAlignment = {
  objective: ObjectiveId;
  label: string;
  applicable: boolean;
  criteriaTotal: number;
  criteriaMet: number;
  alignmentPercent: number | null;
  gaps: string[];
  dnshTotal: number;
  dnshCompliant: number;
  dnshPercent: number | null;
  dnshGaps: string[];
  fullyAligned: boolean;
};

type Report = {
  naceCode: string;
  naceName: string | null;
  applicableCount: number;
  nonApplicableCount: number;
  overallAlignmentPercent: number | null;
  fullyAlignedCount: number;
  objectives: ObjectiveAlignment[];
  gaps: Array<{
    objective: ObjectiveId;
    label: string;
    missingCriteria: string[];
    missingDnsh: string[];
  }>;
  euAveragePercent: number | null;
  euAverageNote: string | null;
};

type Assessment = {
  id: string;
  status: AssessmentStatus;
  naceCode: string;
  naceName: string | null;
  objectives: ObjectiveAnswer[];
  dnshCompliance: DnshAnswer[];
  overallAlignmentPercent: number | null;
  wizardStep: number;
  completedAt: string | null;
  report: Report;
  updatedAt: string;
  createdAt: string;
};

const OBJECTIVE_ORDER: ObjectiveId[] = [
  "climate_mitigation",
  "climate_adaptation",
  "water",
  "circular_economy",
  "pollution",
  "biodiversity",
];

function formatPct(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return `${n.toLocaleString(undefined, { maximumFractionDigits: 1 })}%`;
}

function YesNoToggle(props: {
  value: YesNo;
  onChange: (v: YesNo) => void;
  disabled?: boolean;
}) {
  return (
    <div className="inline-flex gap-1">
      {(["yes", "no"] as const).map((v) => (
        <button
          key={v}
          type="button"
          disabled={props.disabled}
          onClick={() => props.onChange(v)}
          className={cn(
            "rounded-[2px] border px-2.5 py-1 font-[family-name:var(--font-mono)] text-xs uppercase tracking-wide transition-colors",
            props.value === v
              ? v === "yes"
                ? "border-[color:var(--signal)] bg-[color:var(--signal)]/10 text-[color:var(--signal)]"
                : "border-[color:var(--rust)] bg-[color:var(--rust)]/10 text-[color:var(--rust)]"
              : "border-[color:var(--rule)] text-[color:var(--ink-muted)] hover:border-[color:var(--rule-strong)]",
          )}
        >
          {v}
        </button>
      ))}
    </div>
  );
}

function AlignmentBar(props: { percent: number | null; muted?: boolean }) {
  const pct = props.percent ?? 0;
  return (
    <div className="h-2 w-full overflow-hidden rounded-[2px] bg-[color:var(--surface-2)]">
      <div
        className={cn(
          "h-full rounded-[2px] transition-[width] duration-500",
          props.muted
            ? "bg-[color:var(--rule-strong)]"
            : pct >= 80
              ? "bg-[color:var(--signal)]"
              : pct >= 40
                ? "bg-[color:var(--amber)]"
                : "bg-[color:var(--accent)]",
        )}
        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
      />
    </div>
  );
}

export function GreenTaxonomyClient(props: { orgName: string }) {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [active, setActive] = useState<Assessment | null>(null);
  const [catalog, setCatalog] = useState<ObjectiveDef[]>([]);
  const [naceHits, setNaceHits] = useState<NaceRow[]>([]);
  const [naceQuery, setNaceQuery] = useState("");
  const [selectedNace, setSelectedNace] = useState<NaceRow | null>(null);
  const [mode, setMode] = useState<"list" | "wizard" | "results">("list");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();
  const [openDnsh, setOpenDnsh] = useState(false);

  async function loadList() {
    const res = await fetch("/api/app/compliance/green-taxonomy");
    const data = (await res.json()) as {
      assessments?: Assessment[];
      error?: string;
    };
    if (!res.ok) throw new Error(data.error ?? "Failed to load assessments");
    setAssessments(data.assessments ?? []);
  }

  async function loadCatalog(q = "") {
    const url = new URL("/api/app/compliance/green-taxonomy", window.location.origin);
    url.searchParams.set("catalog", "true");
    if (q) url.searchParams.set("q", q);
    const res = await fetch(url.toString());
    const data = (await res.json()) as {
      naceCodes?: NaceRow[];
      objectives?: ObjectiveDef[];
      error?: string;
    };
    if (!res.ok) throw new Error(data.error ?? "Failed to load catalog");
    setNaceHits(data.naceCodes ?? []);
    if (data.objectives) setCatalog(data.objectives);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        await Promise.all([loadList(), loadCatalog("")]);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (mode !== "wizard") return;
    const t = window.setTimeout(() => {
      void loadCatalog(naceQuery).catch(() => undefined);
    }, 200);
    return () => window.clearTimeout(t);
  }, [naceQuery, mode]);

  function startNew() {
    setActive(null);
    setSelectedNace(null);
    setNaceQuery("");
    setMode("wizard");
    setError(null);
    void loadCatalog("");
  }

  function openAssessment(row: Assessment) {
    setActive(row);
    setSelectedNace(
      row.naceCode
        ? {
            code: row.naceCode,
            name: row.naceName ?? row.naceCode,
            section: row.naceCode.charAt(0),
            level: "division",
          }
        : null,
    );
    if (row.status === "completed" || row.status === "verified") {
      setMode("results");
    } else {
      setMode("wizard");
    }
    setError(null);
  }

  function createAssessment() {
    if (!selectedNace) {
      setError("Select a NACE code from the catalog before continuing.");
      return;
    }
    startTransition(async () => {
      try {
        setError(null);
        const res = await fetch("/api/app/compliance/green-taxonomy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ naceCode: selectedNace.code }),
        });
        const data = (await res.json()) as {
          assessment?: Assessment;
          error?: string;
        };
        if (!res.ok) throw new Error(data.error ?? "Create failed");
        if (!data.assessment) throw new Error("Create failed");
        setActive(data.assessment);
        await loadList();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Create failed");
      }
    });
  }

  function saveAnswers(patch: Record<string, unknown>, nextMode?: "wizard" | "results") {
    if (!active) return;
    startTransition(async () => {
      try {
        setError(null);
        const res = await fetch(
          `/api/app/compliance/green-taxonomy/${active.id}/answers`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(patch),
          },
        );
        const data = (await res.json()) as {
          assessment?: Assessment;
          error?: string;
        };
        if (!res.ok) throw new Error(data.error ?? "Save failed");
        if (!data.assessment) throw new Error("Save failed");
        setActive(data.assessment);
        await loadList();
        if (nextMode) setMode(nextMode);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Save failed");
      }
    });
  }

  function currentObjectiveStep(): number {
    if (!active) return 1;
    return Math.min(7, Math.max(2, active.wizardStep));
  }

  function objectiveAtStep(step: number): ObjectiveDef | null {
    if (step < 2 || step > 7) return null;
    const id = OBJECTIVE_ORDER[step - 2];
    return catalog.find((o) => o.id === id) ?? null;
  }

  function goToStep(step: number) {
    if (!active) return;
    saveAnswers({ wizardStep: step });
  }

  function completeAssessment() {
    if (!active) return;
    saveAnswers({ status: "completed", wizardStep: 7 }, "results");
  }

  async function exportPdf() {
    if (!active) return;
    try {
      setError(null);
      const res = await fetch(`/api/app/compliance/green-taxonomy/${active.id}/pdf`);
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "PDF export failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `green-taxonomy-${active.naceCode}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "PDF export failed");
    }
  }

  if (loading) {
    return <StatusLine tone="neutral">Loading green taxonomy assessments…</StatusLine>;
  }

  // —— List ——
  if (mode === "list") {
    return (
      <div className="space-y-6">
        {error ? <StatusLine tone="error">{error}</StatusLine> : null}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-[color:var(--ink-muted)]">
            Assessments for {props.orgName}. Each run is scoped to your organisation.
          </p>
          <Button type="button" onClick={startNew} className="gap-2">
            <Plus className="h-4 w-4" />
            New assessment
          </Button>
        </div>

        {assessments.length === 0 ? (
          <EmptyState
            title="No taxonomy assessments yet"
            body="Start a wizard: select your primary NACE code, answer applicability and screening criteria for each environmental objective, then review alignment and gaps."
            action={
              <Button type="button" onClick={startNew} className="gap-2">
                <Leaf className="h-4 w-4" />
                Start assessment
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-[color:var(--rule)] border-y border-[color:var(--rule)]">
            {assessments.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  onClick={() => openAssessment(row)}
                  className="flex w-full flex-col gap-1 py-4 text-left transition-colors hover:bg-[color:var(--surface-2)]/60 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-[family-name:var(--font-mono)] text-sm text-[color:var(--ink)]">
                      NACE {row.naceCode}
                    </p>
                    <p className="text-sm text-[color:var(--ink-muted)]">
                      {row.naceName ?? "—"}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="font-[family-name:var(--font-mono)] tabular-nums text-[color:var(--ink)]">
                      {formatPct(row.report.overallAlignmentPercent)}
                    </span>
                    <span className="rounded-[2px] border border-[color:var(--rule)] px-2 py-0.5 text-xs uppercase tracking-wide text-[color:var(--ink-muted)]">
                      {row.status}
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  // —— Results ——
  if (mode === "results" && active) {
    const report = active.report;
    return (
      <div className="space-y-8">
        {error ? <StatusLine tone="error">{error}</StatusLine> : null}

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-[color:var(--accent)]">
              Results
            </p>
            <h2 className="mt-1 font-[family-name:var(--font-display)] text-2xl text-[color:var(--ink)]">
              Alignment report
            </h2>
            <p className="mt-1 font-[family-name:var(--font-mono)] text-sm text-[color:var(--ink-muted)]">
              NACE {report.naceCode}
              {report.naceName ? ` — ${report.naceName}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setMode("wizard");
                saveAnswers({ wizardStep: 2, status: "draft" });
              }}
            >
              Edit answers
            </Button>
            <Button type="button" variant="outline" onClick={() => setMode("list")}>
              All assessments
            </Button>
            <Button type="button" onClick={() => void exportPdf()} className="gap-2">
              <Download className="h-4 w-4" />
              Export PDF
            </Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="border-t border-[color:var(--rule)] pt-3">
            <p className="text-xs uppercase tracking-wide text-[color:var(--ink-muted)]">
              Overall alignment
            </p>
            <p className="mt-1 font-[family-name:var(--font-mono)] text-3xl tabular-nums text-[color:var(--ink)]">
              {formatPct(report.overallAlignmentPercent)}
            </p>
            <p className="mt-1 text-xs text-[color:var(--ink-muted)]">
              Mean of {report.applicableCount} applicable objective
              {report.applicableCount === 1 ? "" : "s"}; {report.nonApplicableCount}{" "}
              excluded
            </p>
          </div>
          <div className="border-t border-[color:var(--rule)] pt-3">
            <p className="text-xs uppercase tracking-wide text-[color:var(--ink-muted)]">
              Fully aligned
            </p>
            <p className="mt-1 font-[family-name:var(--font-mono)] text-3xl tabular-nums text-[color:var(--ink)]">
              {report.fullyAlignedCount}
            </p>
            <p className="mt-1 text-xs text-[color:var(--ink-muted)]">
              Screening + DNSH complete
            </p>
          </div>
          <div className="border-t border-[color:var(--rule)] pt-3">
            <p className="text-xs uppercase tracking-wide text-[color:var(--ink-muted)]">
              EU peer reference
            </p>
            <p className="mt-1 font-[family-name:var(--font-mono)] text-3xl tabular-nums text-[color:var(--ink)]">
              {formatPct(report.euAveragePercent)}
            </p>
            <p className="mt-1 text-xs text-[color:var(--ink-muted)]">
              {report.euAverageNote ?? "No reference for this NACE"}
            </p>
          </div>
        </div>

        <section className="space-y-4">
          <h3 className="font-[family-name:var(--font-display)] text-lg text-[color:var(--ink)]">
            Alignment by objective
          </h3>
          {report.objectives.map((o) => (
            <div
              key={o.objective}
              className="space-y-2 border-t border-[color:var(--rule)] pt-3"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm text-[color:var(--ink)]">{o.label}</p>
                <p className="font-[family-name:var(--font-mono)] text-sm tabular-nums text-[color:var(--ink-muted)]">
                  {o.applicable
                    ? `${o.criteriaMet}/${o.criteriaTotal} · ${formatPct(o.alignmentPercent)}`
                    : "Not applicable"}
                </p>
              </div>
              <AlignmentBar
                percent={o.applicable ? o.alignmentPercent : 0}
                muted={!o.applicable}
              />
            </div>
          ))}
        </section>

        <section className="space-y-3">
          <h3 className="font-[family-name:var(--font-display)] text-lg text-[color:var(--ink)]">
            Gap analysis
          </h3>
          {report.gaps.length === 0 ? (
            <p className="text-sm text-[color:var(--ink-muted)]">
              No screening or DNSH gaps on applicable objectives.
            </p>
          ) : (
            <ul className="space-y-3">
              {report.gaps.map((g) => (
                <li
                  key={g.objective}
                  className="border-l-2 border-[color:var(--accent)] pl-3"
                >
                  <p className="text-sm text-[color:var(--ink)]">
                    {g.missingCriteria.length > 0
                      ? `You're missing ${g.missingCriteria.length} criteria for ${g.label} alignment`
                      : g.label}
                  </p>
                  {g.missingCriteria.length > 0 ? (
                    <p className="mt-1 text-xs text-[color:var(--ink-muted)]">
                      {g.missingCriteria.join(" · ")}
                    </p>
                  ) : null}
                  {g.missingDnsh.length > 0 ? (
                    <p className="mt-1 text-xs text-[color:var(--ink-muted)]">
                      DNSH gaps: {g.missingDnsh.join(" · ")}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    );
  }

  // —— Wizard ——
  const step = active ? currentObjectiveStep() : 1;
  const objDef = objectiveAtStep(step);
  const currentObjAnswer = active?.objectives.find((o) => o.objective === objDef?.id);

  return (
    <div className="space-y-6">
      {error ? <StatusLine tone="error">{error}</StatusLine> : null}

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--rule)] pb-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-[color:var(--accent)]">
            Assessment wizard
          </p>
          <p className="mt-1 font-[family-name:var(--font-mono)] text-sm text-[color:var(--ink)]">
            Step {active ? step : 1} of 7
          </p>
        </div>
        <Button type="button" variant="outline" onClick={() => setMode("list")}>
          Cancel
        </Button>
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-[2px] bg-[color:var(--surface-2)]">
        <div
          className="h-full bg-[color:var(--accent)] transition-[width] duration-300"
          style={{ width: `${((active ? step : 1) / 7) * 100}%` }}
        />
      </div>

      {!active ? (
        <section className="space-y-4">
          <h2 className="font-[family-name:var(--font-display)] text-xl text-[color:var(--ink)]">
            Select primary NACE code
          </h2>
          <p className="text-sm text-[color:var(--ink-muted)]">
            Search the official NACE Rev. 2 catalog (Eurostat). Codes are not hardcoded in
            the UI.
          </p>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--ink-muted)]" />
            <input
              type="search"
              value={naceQuery}
              onChange={(e) => setNaceQuery(e.target.value)}
              placeholder="Search by code or name (e.g. 3511, electricity)"
              className="w-full rounded-[4px] border border-[color:var(--rule)] bg-[color:var(--surface-1)] py-2.5 pl-10 pr-3 text-sm text-[color:var(--ink)] outline-none focus:border-[color:var(--rule-strong)]"
            />
          </div>
          {selectedNace ? (
            <p className="font-[family-name:var(--font-mono)] text-sm text-[color:var(--signal)]">
              Selected: {selectedNace.code} — {selectedNace.name}
            </p>
          ) : null}
          <ul className="max-h-80 overflow-y-auto divide-y divide-[color:var(--rule)] border border-[color:var(--rule)] rounded-[6px]">
            {naceHits.map((row) => (
              <li key={`${row.level}-${row.code}`}>
                <button
                  type="button"
                  onClick={() => setSelectedNace(row)}
                  className={cn(
                    "flex w-full flex-col gap-0.5 px-3 py-2.5 text-left hover:bg-[color:var(--surface-2)]/60",
                    selectedNace?.code === row.code && "bg-[color:var(--accent-quiet)]",
                  )}
                >
                  <span className="font-[family-name:var(--font-mono)] text-sm text-[color:var(--ink)]">
                    {row.code}
                    <span className="ml-2 text-xs uppercase text-[color:var(--ink-muted)]">
                      {row.level}
                    </span>
                  </span>
                  <span className="text-xs text-[color:var(--ink-muted)]">
                    {row.name}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <Button
            type="button"
            disabled={!selectedNace || pending}
            onClick={createAssessment}
          >
            Continue to objectives
          </Button>
        </section>
      ) : objDef && currentObjAnswer ? (
        <ObjectiveStep
          step={step}
          def={objDef}
          answer={currentObjAnswer}
          dnsh={active.dnshCompliance.filter((d) => d.objective === objDef.id)}
          openDnsh={openDnsh}
          setOpenDnsh={setOpenDnsh}
          pending={pending}
          onApplicable={(applicable) =>
            saveAnswers({
              wizardStep: step,
              objectives: [{ objective: objDef.id, applicable }],
            })
          }
          onCriteria={(criteriaId, met) =>
            saveAnswers({
              wizardStep: step,
              objectives: [
                {
                  objective: objDef.id,
                  answers: [{ criteriaId, met }],
                },
              ],
            })
          }
          onDnsh={(criteriaId, compliant) =>
            saveAnswers({
              wizardStep: step,
              dnshCompliance: [{ objective: objDef.id, criteriaId, compliant }],
            })
          }
          onBack={() => goToStep(Math.max(2, step - 1))}
          onNext={() => {
            if (step >= 7) {
              completeAssessment();
            } else {
              goToStep(step + 1);
            }
          }}
          onResults={() => {
            setMode("results");
          }}
        />
      ) : (
        <StatusLine tone="neutral">Loading objective…</StatusLine>
      )}
    </div>
  );
}

function ObjectiveStep(props: {
  step: number;
  def: ObjectiveDef;
  answer: ObjectiveAnswer;
  dnsh: DnshAnswer[];
  openDnsh: boolean;
  setOpenDnsh: (v: boolean) => void;
  pending: boolean;
  onApplicable: (v: YesNo) => void;
  onCriteria: (criteriaId: string, met: YesNo) => void;
  onDnsh: (criteriaId: string, compliant: YesNo) => void;
  onBack: () => void;
  onNext: () => void;
  onResults: () => void;
}) {
  const applicable = props.answer.applicable === "yes";
  const metById = new Map(props.answer.answers.map((a) => [a.criteriaId, a.met]));
  const dnshById = new Map(props.dnsh.map((d) => [d.criteriaId, d.compliant]));
  const metCount = props.def.criteria.filter((c) => metById.get(c.id) === "yes").length;

  return (
    <section className="space-y-5">
      <div>
        <p className="text-xs uppercase tracking-wide text-[color:var(--ink-muted)]">
          Objective {props.step - 1} of 6
        </p>
        <h2 className="mt-1 font-[family-name:var(--font-display)] text-xl text-[color:var(--ink)]">
          {props.def.label}
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-[color:var(--ink-muted)]">
          {props.def.description}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border border-[color:var(--rule)] rounded-[6px] px-4 py-3">
        <p className="text-sm text-[color:var(--ink)]">
          Is this objective applicable to your business?
        </p>
        <YesNoToggle
          value={props.answer.applicable}
          onChange={props.onApplicable}
          disabled={props.pending}
        />
      </div>

      {applicable ? (
        <>
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-[color:var(--ink-muted)]">
              <span>Technical screening criteria</span>
              <span className="font-[family-name:var(--font-mono)] tabular-nums">
                {metCount}/{props.def.criteria.length} met
              </span>
            </div>
            <AlignmentBar percent={(metCount / props.def.criteria.length) * 100} />
          </div>

          <ul className="divide-y divide-[color:var(--rule)] border-y border-[color:var(--rule)]">
            {props.def.criteria.map((c) => (
              <li
                key={c.id}
                className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-[color:var(--ink)]">{c.prompt}</p>
                  <p className="mt-0.5 text-xs text-[color:var(--ink-muted)]">
                    {c.label}
                  </p>
                </div>
                <YesNoToggle
                  value={metById.get(c.id) ?? "unanswered"}
                  onChange={(v) => props.onCriteria(c.id, v)}
                  disabled={props.pending}
                />
              </li>
            ))}
          </ul>

          <div className="border border-[color:var(--rule)] rounded-[6px]">
            <button
              type="button"
              onClick={() => props.setOpenDnsh(!props.openDnsh)}
              className="flex w-full items-center justify-between px-4 py-3 text-left text-sm text-[color:var(--ink)]"
            >
              <span>Do No Significant Harm (DNSH)</span>
              <span className="font-[family-name:var(--font-mono)] text-xs text-[color:var(--ink-muted)]">
                {props.openDnsh ? "Hide" : "Show"}
              </span>
            </button>
            {props.openDnsh ? (
              <ul className="divide-y divide-[color:var(--rule)] border-t border-[color:var(--rule)]">
                {props.def.dnsh.map((d) => (
                  <li
                    key={d.id}
                    className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:justify-between"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-[color:var(--ink)]">{d.prompt}</p>
                      <p className="mt-0.5 text-xs text-[color:var(--ink-muted)]">
                        {d.label}
                      </p>
                    </div>
                    <YesNoToggle
                      value={dnshById.get(d.id) ?? "unanswered"}
                      onChange={(v) => props.onDnsh(d.id, v)}
                      disabled={props.pending}
                    />
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </>
      ) : props.answer.applicable === "no" ? (
        <p className="text-sm text-[color:var(--ink-muted)]">
          Marked not applicable — this objective will be excluded from overall alignment
          percentage.
        </p>
      ) : (
        <p className="text-sm text-[color:var(--ink-muted)]">
          Answer applicability to unlock screening criteria, or mark as not applicable to
          skip.
        </p>
      )}

      <div className="flex flex-wrap gap-2 pt-2">
        <Button
          type="button"
          variant="outline"
          disabled={props.step <= 2 || props.pending}
          onClick={props.onBack}
        >
          Back
        </Button>
        <Button type="button" disabled={props.pending} onClick={props.onNext}>
          {props.step >= 7 ? "Complete & view results" : "Next objective"}
        </Button>
        {props.step >= 7 ? (
          <Button type="button" variant="outline" onClick={props.onResults}>
            View results without completing
          </Button>
        ) : null}
      </div>
    </section>
  );
}
