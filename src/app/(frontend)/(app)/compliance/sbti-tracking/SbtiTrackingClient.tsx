"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useTransition } from "react";
import { ExternalLink, Plus, Target } from "lucide-react";

import { EmptyState, StatusLine } from "@/components/shell/PageFrame";
import { Button } from "@/components/ui/button";
import { ProgressRing } from "@/app/(frontend)/(app)/runway/ProgressRing";
import { cn } from "@/lib/utils";

type OnTrackStatus = "green" | "yellow" | "red";
type TargetType = "absolute" | "intensity";
type TargetStatus = "draft" | "submitted" | "validated" | "approved";
type ScopeKey = "Scope1" | "Scope2" | "Scope3";

type Progress = {
  baselineEmissions: number;
  targetEmissions: number;
  currentEmissions: number;
  reductionTargetPercent: number;
  reductionAchievedPercent: number;
  progressTowardTargetPercent: number | null;
  annualizedReductionNeededPercent: number | null;
  yearsRemaining: number;
  yearsElapsed: number;
  expectedProgressPercent: number;
  trajectoryGapPercent: number | null;
  onTrackStatus: OnTrackStatus;
};

type TargetRow = {
  id: string;
  name: string;
  targetType: TargetType;
  baselineYear: number;
  baselineEmissions: number;
  targetYear: number;
  targetEmissions: number | null;
  reductionPercent: number | null;
  scopesCovered: ScopeKey[];
  status: TargetStatus;
  validationUrl?: string | null;
};

type ScenarioProjection = {
  scenarioId: string;
  scenarioName: string;
  reductionPercent: number;
  scopes: ScopeKey[];
  projectedCurrent: number;
  progress: Progress;
};

type TargetBundle = {
  target: TargetRow;
  progress: Progress;
  asOfYear: number;
  currentQuality: "calculated" | "missing";
  currentMessage: string | null;
  alignment: {
    warming1_5C: boolean;
    warming2_0C: boolean;
    alignedWith: string;
  };
  registrySearchUrl: string;
  scenarios: ScenarioProjection[];
};

type DashboardPayload = {
  summary: {
    totalTargets: number;
    draft: number;
    submitted: number;
    validated: number;
    approved: number;
    onTrackGreen: number;
    onTrackYellow: number;
    onTrackRed: number;
  };
  primary: TargetBundle | null;
  targets: TargetBundle[];
};

const SCOPE_OPTIONS: ScopeKey[] = ["Scope1", "Scope2", "Scope3"];

function formatNum(n: number, digits = 1): string {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  });
}

function onTrackLabel(status: OnTrackStatus): string {
  if (status === "green") return "On track";
  if (status === "yellow") return "At risk";
  return "Off track";
}

function onTrackClass(status: OnTrackStatus): string {
  if (status === "green") return "text-[color:var(--signal)]";
  if (status === "yellow") return "text-[color:var(--amber)]";
  return "text-[color:var(--rust)]";
}

function onTrackBorder(status: OnTrackStatus): string {
  if (status === "green") return "border-[color:var(--signal)]";
  if (status === "yellow") return "border-[color:var(--amber)]";
  return "border-[color:var(--rust)]";
}

type WizardState = {
  step: 1 | 2 | 3 | 4 | 5;
  name: string;
  targetType: TargetType;
  baselineYear: string;
  targetYear: string;
  scopesCovered: ScopeKey[];
  baselineEmissions: string;
  reductionPercent: string;
  status: "draft" | "submitted";
  validationUrl: string;
};

const initialWizard = (): WizardState => ({
  step: 1,
  name: "",
  targetType: "absolute",
  baselineYear: "",
  targetYear: "",
  scopesCovered: ["Scope1", "Scope2"],
  baselineEmissions: "",
  reductionPercent: "50",
  status: "draft",
  validationUrl: "",
});

export function SbtiTrackingClient({ orgName }: { orgName: string }) {
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizard, setWizard] = useState<WizardState>(initialWizard);
  const [wizardError, setWizardError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(() => {
    startTransition(async () => {
      setError(null);
      try {
        const res = await fetch("/api/app/compliance/sbti/progress");
        const json = (await res.json()) as DashboardPayload & { error?: string };
        if (!res.ok) {
          setError(json.error ?? "Could not load SBTi progress");
          return;
        }
        setData(json);
        if (!selectedId && json.primary) {
          setSelectedId(json.primary.target.id);
        }
      } catch {
        setError("Network error loading SBTi progress. Retry.");
      }
    });
  }, [selectedId]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once
  }, []);

  const selected =
    data?.targets.find((t) => t.target.id === selectedId) ?? data?.primary ?? null;

  async function submitWizard() {
    setWizardError(null);
    const baselineYear = Number(wizard.baselineYear);
    const targetYear = Number(wizard.targetYear);
    const baselineEmissions = Number(wizard.baselineEmissions);
    const reductionPercent = Number(wizard.reductionPercent);

    if (!wizard.baselineYear.trim()) {
      setWizardError("Select a baseline year. It is not hardcoded.");
      return;
    }
    if (!Number.isInteger(baselineYear) || baselineYear < 1990) {
      setWizardError("Baseline year must be a valid calendar year.");
      return;
    }
    if (!Number.isInteger(targetYear) || targetYear < baselineYear) {
      setWizardError("Target year must be on or after the baseline year.");
      return;
    }
    if (!(baselineEmissions > 0)) {
      setWizardError("Enter baseline emissions (or intensity) greater than zero.");
      return;
    }
    if (!(reductionPercent >= 0) || reductionPercent > 100) {
      setWizardError("Reduction % must be between 0 and 100.");
      return;
    }
    if (wizard.scopesCovered.length === 0) {
      setWizardError("Select at least one scope.");
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/app/compliance/sbti", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name:
              wizard.name.trim() ||
              `${wizard.targetType === "intensity" ? "Intensity" : "Absolute"} ${baselineYear}→${targetYear}`,
            targetType: wizard.targetType,
            baselineYear,
            baselineEmissions,
            targetYear,
            reductionPercent,
            scopesCovered: wizard.scopesCovered,
            status: wizard.status,
            validationUrl: wizard.validationUrl.trim() || null,
          }),
        });
        const json = (await res.json()) as { error?: string; target?: TargetRow };
        if (!res.ok) {
          setWizardError(json.error ?? "Could not create target");
          return;
        }
        setWizardOpen(false);
        setWizard(initialWizard());
        if (json.target?.id) setSelectedId(json.target.id);
        load();
      } catch {
        setWizardError("Network error creating target. Retry.");
      }
    });
  }

  async function advanceStatus(id: string, status: TargetStatus) {
    startTransition(async () => {
      setError(null);
      try {
        const res = await fetch(`/api/app/compliance/sbti/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        });
        const json = (await res.json()) as { error?: string };
        if (!res.ok) {
          setError(json.error ?? "Could not update status");
          return;
        }
        load();
      } catch {
        setError("Network error updating status. Retry.");
      }
    });
  }

  function toggleScope(scope: ScopeKey) {
    setWizard((w) => {
      const has = w.scopesCovered.includes(scope);
      return {
        ...w,
        scopesCovered: has
          ? w.scopesCovered.filter((s) => s !== scope)
          : [...w.scopesCovered, scope],
      };
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <StatusLine tone={error ? "error" : "neutral"}>
          {error
            ? error
            : pending
              ? "Loading SBTi progress…"
              : data
                ? `${data.summary.totalTargets} target${data.summary.totalTargets === 1 ? "" : "s"} · ${data.summary.onTrackGreen} on track`
                : "Ready"}
        </StatusLine>
        <Button
          type="button"
          onClick={() => {
            setWizard(initialWizard());
            setWizardError(null);
            setWizardOpen(true);
          }}
          className="gap-2"
        >
          <Plus className="h-4 w-4" aria-hidden />
          New SBTi target
        </Button>
      </div>

      {wizardOpen && (
        <section
          className="rounded-[6px] border border-[color:var(--rule-strong)] bg-[color:var(--surface-1)] p-5"
          aria-label="SBTi setup wizard"
        >
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="font-[family-name:var(--font-display)] text-xl text-[color:var(--ink)]">
              Setup wizard · step {wizard.step} of 5
            </h2>
            <button
              type="button"
              className="text-sm text-[color:var(--ink-muted)] underline-offset-2 hover:underline"
              onClick={() => setWizardOpen(false)}
            >
              Cancel
            </button>
          </div>

          <div className="mb-4 flex gap-2" aria-hidden>
            {([1, 2, 3, 4, 5] as const).map((s) => (
              <div
                key={s}
                className={cn(
                  "h-1 flex-1 rounded-[2px]",
                  s <= wizard.step
                    ? "bg-[color:var(--accent)]"
                    : "bg-[color:var(--rule)]",
                )}
              />
            ))}
          </div>

          {wizard.step === 1 && (
            <div className="space-y-4">
              <p className="text-sm text-[color:var(--ink-muted)]">
                Choose absolute (total tCO2e) or intensity (per revenue).
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {(
                  [
                    ["absolute", "Absolute reduction"],
                    ["intensity", "Intensity (per revenue)"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setWizard((w) => ({ ...w, targetType: value }))}
                    className={cn(
                      "rounded-[6px] border px-4 py-3 text-left text-sm",
                      wizard.targetType === value
                        ? "border-[color:var(--accent)] bg-[color:var(--accent-quiet)]"
                        : "border-[color:var(--rule)] bg-[color:var(--surface-2)]",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <label className="block text-sm">
                <span className="text-[color:var(--ink-muted)]">Target name</span>
                <input
                  className="mt-1 w-full rounded-[4px] border border-[color:var(--rule)] bg-[color:var(--surface-2)] px-3 py-2 text-[color:var(--ink)]"
                  value={wizard.name}
                  onChange={(e) => setWizard((w) => ({ ...w, name: e.target.value }))}
                  placeholder={`${orgName} near-term`}
                />
              </label>
            </div>
          )}

          {wizard.step === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-[color:var(--ink-muted)]">
                Select the baseline (reference) year. ClearESG never hardcodes this.
              </p>
              <label className="block text-sm">
                <span className="text-[color:var(--ink-muted)]">Baseline year</span>
                <input
                  type="number"
                  min={1990}
                  max={2100}
                  className="mt-1 w-full rounded-[4px] border border-[color:var(--rule)] bg-[color:var(--surface-2)] px-3 py-2 font-mono tabular-nums text-[color:var(--ink)]"
                  value={wizard.baselineYear}
                  onChange={(e) =>
                    setWizard((w) => ({ ...w, baselineYear: e.target.value }))
                  }
                  placeholder="e.g. 2019"
                  required
                />
              </label>
              <label className="block text-sm">
                <span className="text-[color:var(--ink-muted)]">
                  Baseline{" "}
                  {wizard.targetType === "intensity"
                    ? "intensity (tCO2e / $M)"
                    : "emissions (tCO2e)"}
                </span>
                <input
                  type="number"
                  min={0}
                  step="any"
                  className="mt-1 w-full rounded-[4px] border border-[color:var(--rule)] bg-[color:var(--surface-2)] px-3 py-2 font-mono tabular-nums text-[color:var(--ink)]"
                  value={wizard.baselineEmissions}
                  onChange={(e) =>
                    setWizard((w) => ({ ...w, baselineEmissions: e.target.value }))
                  }
                  placeholder="Starting point"
                  required
                />
              </label>
            </div>
          )}

          {wizard.step === 3 && (
            <div className="space-y-4">
              <p className="text-sm text-[color:var(--ink-muted)]">
                When must the goal be met, and by how much?
              </p>
              <label className="block text-sm">
                <span className="text-[color:var(--ink-muted)]">Target year</span>
                <input
                  type="number"
                  min={1990}
                  max={2100}
                  className="mt-1 w-full rounded-[4px] border border-[color:var(--rule)] bg-[color:var(--surface-2)] px-3 py-2 font-mono tabular-nums text-[color:var(--ink)]"
                  value={wizard.targetYear}
                  onChange={(e) =>
                    setWizard((w) => ({ ...w, targetYear: e.target.value }))
                  }
                  placeholder="e.g. 2030"
                  required
                />
              </label>
              <label className="block text-sm">
                <span className="text-[color:var(--ink-muted)]">
                  Reduction from baseline (%)
                </span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="any"
                  className="mt-1 w-full rounded-[4px] border border-[color:var(--rule)] bg-[color:var(--surface-2)] px-3 py-2 font-mono tabular-nums text-[color:var(--ink)]"
                  value={wizard.reductionPercent}
                  onChange={(e) =>
                    setWizard((w) => ({ ...w, reductionPercent: e.target.value }))
                  }
                  required
                />
              </label>
            </div>
          )}

          {wizard.step === 4 && (
            <div className="space-y-4">
              <p className="text-sm text-[color:var(--ink-muted)]">
                Scopes covered by this commitment.
              </p>
              <div className="flex flex-wrap gap-2">
                {SCOPE_OPTIONS.map((scope) => {
                  const on = wizard.scopesCovered.includes(scope);
                  return (
                    <button
                      key={scope}
                      type="button"
                      onClick={() => toggleScope(scope)}
                      className={cn(
                        "rounded-[2px] border px-3 py-1.5 text-sm",
                        on
                          ? "border-[color:var(--accent)] bg-[color:var(--accent-quiet)] text-[color:var(--ink)]"
                          : "border-[color:var(--rule)] text-[color:var(--ink-muted)]",
                      )}
                    >
                      {scope.replace("Scope", "Scope ")}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {wizard.step === 5 && (
            <div className="space-y-4">
              <p className="text-sm text-[color:var(--ink-muted)]">
                Status discipline: create as draft or submitted. Validated and approved
                come after SBTi review.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {(
                  [
                    ["draft", "Draft — internal only"],
                    ["submitted", "Submitted to SBTi"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setWizard((w) => ({ ...w, status: value }))}
                    className={cn(
                      "rounded-[6px] border px-4 py-3 text-left text-sm",
                      wizard.status === value
                        ? "border-[color:var(--accent)] bg-[color:var(--accent-quiet)]"
                        : "border-[color:var(--rule)] bg-[color:var(--surface-2)]",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <label className="block text-sm">
                <span className="text-[color:var(--ink-muted)]">
                  Validation URL (optional)
                </span>
                <input
                  className="mt-1 w-full rounded-[4px] border border-[color:var(--rule)] bg-[color:var(--surface-2)] px-3 py-2 text-[color:var(--ink)]"
                  value={wizard.validationUrl}
                  onChange={(e) =>
                    setWizard((w) => ({ ...w, validationUrl: e.target.value }))
                  }
                  placeholder="https://sciencebasedtargets.org/…"
                />
              </label>
            </div>
          )}

          {wizardError && (
            <p className="mt-4 text-sm text-[color:var(--rust)]" role="alert">
              {wizardError}
            </p>
          )}

          <div className="mt-6 flex flex-wrap justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={wizard.step === 1 || pending}
              onClick={() =>
                setWizard((w) => ({
                  ...w,
                  step: Math.max(1, w.step - 1) as WizardState["step"],
                }))
              }
            >
              Back
            </Button>
            {wizard.step < 5 ? (
              <Button
                type="button"
                disabled={pending}
                onClick={() =>
                  setWizard((w) => ({
                    ...w,
                    step: Math.min(5, w.step + 1) as WizardState["step"],
                  }))
                }
              >
                Continue
              </Button>
            ) : (
              <Button
                type="button"
                disabled={pending}
                onClick={() => void submitWizard()}
              >
                Create target
              </Button>
            )}
          </div>
        </section>
      )}

      {!data && !error && (
        <div className="rounded-[6px] border border-[color:var(--rule)] bg-[color:var(--surface-1)] p-8 text-sm text-[color:var(--ink-muted)]">
          Loading progress dashboard…
        </div>
      )}

      {data && data.targets.length === 0 && !wizardOpen && (
        <EmptyState
          title="No SBTi target yet"
          body="Run the setup wizard to define target type, baseline year, target year, and scopes. Progress is always shown with the target."
          action={
            <Button
              type="button"
              onClick={() => {
                setWizard(initialWizard());
                setWizardOpen(true);
              }}
            >
              Start wizard
            </Button>
          }
        />
      )}

      {data && data.targets.length > 0 && selected && (
        <>
          <div className="flex flex-wrap gap-2">
            {data.targets.map((row) => (
              <button
                key={row.target.id}
                type="button"
                onClick={() => setSelectedId(row.target.id)}
                className={cn(
                  "rounded-[2px] border px-3 py-1.5 text-sm",
                  selected.target.id === row.target.id
                    ? "border-[color:var(--accent)] bg-[color:var(--accent-quiet)]"
                    : "border-[color:var(--rule)] text-[color:var(--ink-muted)]",
                )}
              >
                {row.target.name}
              </button>
            ))}
          </div>

          <ProgressDashboard
            bundle={selected}
            pending={pending}
            onAdvanceStatus={advanceStatus}
          />
        </>
      )}
    </div>
  );
}

function ProgressDashboard({
  bundle,
  pending,
  onAdvanceStatus,
}: {
  bundle: TargetBundle;
  pending: boolean;
  onAdvanceStatus: (id: string, status: TargetStatus) => void;
}) {
  const { target, progress, alignment, registrySearchUrl, scenarios } = bundle;
  const progressPct = Math.max(
    0,
    Math.min(100, progress.progressTowardTargetPercent ?? 0),
  );

  const nextStatus: TargetStatus | null =
    target.status === "draft"
      ? "submitted"
      : target.status === "submitted"
        ? "validated"
        : target.status === "validated"
          ? "approved"
          : null;

  return (
    <div className="space-y-6">
      <section
        className={cn(
          "grid gap-6 rounded-[6px] border border-l-4 bg-[color:var(--surface-1)] p-5 md:grid-cols-[160px_1fr]",
          onTrackBorder(progress.onTrackStatus),
        )}
      >
        <div className="flex flex-col items-center justify-center gap-2">
          <ProgressRing value={progressPct} label="to target" size={140} />
          <p
            className={cn(
              "text-xs font-semibold uppercase tracking-[0.08em]",
              onTrackClass(progress.onTrackStatus),
            )}
          >
            {onTrackLabel(progress.onTrackStatus)}
          </p>
        </div>

        <div className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-[family-name:var(--font-display)] text-2xl text-[color:var(--ink)]">
                {target.name}
              </h2>
              <p className="mt-1 text-sm text-[color:var(--ink-muted)]">
                {target.targetType === "intensity" ? "Intensity" : "Absolute"} ·{" "}
                {target.scopesCovered.map((s) => s.replace("Scope", "S")).join(", ")} ·{" "}
                status {target.status}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                href={target.validationUrl || registrySearchUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-[4px] border border-[color:var(--rule)] px-3 py-1.5 text-sm text-[color:var(--ink)] hover:border-[color:var(--rule-strong)]"
              >
                SBTi registry
                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              </a>
              {nextStatus && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  onClick={() => onAdvanceStatus(target.id, nextStatus)}
                >
                  Mark {nextStatus}
                </Button>
              )}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              label="Baseline"
              value={`${formatNum(progress.baselineEmissions)} · ${target.baselineYear}`}
            />
            <MetricCard
              label="Current"
              value={`${formatNum(progress.currentEmissions)} · ${bundle.asOfYear}`}
              hint={bundle.currentMessage ?? undefined}
            />
            <MetricCard
              label="Target"
              value={`${formatNum(progress.targetEmissions)} · ${target.targetYear}`}
            />
            <MetricCard
              label="Reduction achieved"
              value={`${formatNum(progress.reductionAchievedPercent)}%`}
              hint={`of ${formatNum(progress.reductionTargetPercent)}% required`}
            />
          </div>

          {bundle.currentQuality === "missing" && (
            <p className="text-sm text-[color:var(--amber)]">
              {bundle.currentMessage ??
                "Current emissions quality is missing. Progress uses available values; add period data for a calculated reading."}
            </p>
          )}
        </div>
      </section>

      <section className="rounded-[6px] border border-[color:var(--rule)] bg-[color:var(--surface-1)] p-5">
        <h3 className="font-[family-name:var(--font-display)] text-lg text-[color:var(--ink)]">
          Timeline
        </h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <MetricCard label="Years remaining" value={String(progress.yearsRemaining)} />
          <MetricCard
            label="Annual reduction needed"
            value={
              progress.annualizedReductionNeededPercent === null
                ? "—"
                : `${formatNum(progress.annualizedReductionNeededPercent)}%/yr`
            }
          />
          <MetricCard
            label="Expected vs actual"
            value={
              progress.trajectoryGapPercent === null
                ? "—"
                : `${progress.trajectoryGapPercent >= 0 ? "+" : ""}${formatNum(progress.trajectoryGapPercent)} pp`
            }
            hint={`Expected ${formatNum(progress.expectedProgressPercent)}% by now`}
          />
        </div>
        <div className="mt-4">
          <div className="mb-1 flex justify-between text-xs text-[color:var(--ink-muted)]">
            <span className="font-mono tabular-nums">{target.baselineYear}</span>
            <span>Trajectory vs SBTi requirement</span>
            <span className="font-mono tabular-nums">{target.targetYear}</span>
          </div>
          <div className="relative h-2 rounded-[2px] bg-[color:var(--surface-2)]">
            <div
              className="absolute inset-y-0 left-0 rounded-[2px] bg-[color:var(--rule-strong)]"
              style={{
                width: `${Math.max(0, Math.min(100, progress.expectedProgressPercent))}%`,
              }}
              title="Expected linear progress"
            />
            <div
              className={cn(
                "absolute inset-y-0 left-0 rounded-[2px]",
                progress.onTrackStatus === "green" && "bg-[color:var(--signal)]",
                progress.onTrackStatus === "yellow" && "bg-[color:var(--amber)]",
                progress.onTrackStatus === "red" && "bg-[color:var(--rust)]",
              )}
              style={{ width: `${progressPct}%` }}
              title="Actual progress toward target"
            />
          </div>
          <p className="mt-2 text-sm text-[color:var(--ink-muted)]">
            Pathway alignment: {alignment.alignedWith}
            {alignment.warming1_5C
              ? " (meets 1.5°C annual rate)"
              : alignment.warming2_0C
                ? " (meets 2.0°C annual rate)"
                : " (below SBTi annual rate bands)"}
            .
          </p>
        </div>
      </section>

      <section className="rounded-[6px] border border-[color:var(--rule)] bg-[color:var(--surface-1)] p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="font-[family-name:var(--font-display)] text-lg text-[color:var(--ink)]">
              Scenarios
            </h3>
            <p className="mt-1 text-sm text-[color:var(--ink-muted)]">
              If a modelled scenario is achieved, SBTi progress is recalculated against
              this target.
            </p>
          </div>
          <Link
            href="/analytics?tab=scenarios"
            className="inline-flex items-center gap-1.5 text-sm text-[color:var(--accent)] underline-offset-2 hover:underline"
          >
            <Target className="h-3.5 w-3.5" aria-hidden />
            Open scenario builder
          </Link>
        </div>

        {scenarios.length === 0 ? (
          <p className="mt-4 text-sm text-[color:var(--ink-muted)]">
            No scenarios with a reduction % yet. Create one in Analytics → Scenarios to
            see “what if we hit that reduction” against this SBTi target.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-[color:var(--rule)]">
            {scenarios.map((s) => (
              <li
                key={s.scenarioId}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-[color:var(--ink)]">
                    {s.scenarioName}
                  </p>
                  <p className="text-xs text-[color:var(--ink-muted)]">
                    −{formatNum(s.reductionPercent)}% on{" "}
                    {s.scopes.map((x) => x.replace("Scope", "S")).join(", ")} → projected{" "}
                    <span className="font-mono tabular-nums">
                      {formatNum(s.projectedCurrent)}
                    </span>
                  </p>
                </div>
                <div className="text-right">
                  <p
                    className={cn(
                      "font-mono text-lg tabular-nums",
                      onTrackClass(s.progress.onTrackStatus),
                    )}
                  >
                    {s.progress.progressTowardTargetPercent === null
                      ? "—"
                      : `${formatNum(s.progress.progressTowardTargetPercent)}%`}
                  </p>
                  <p className="text-xs text-[color:var(--ink-muted)]">
                    {onTrackLabel(s.progress.onTrackStatus)} if achieved
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-[6px] border border-[color:var(--rule)] bg-[color:var(--surface-2)] px-3 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[color:var(--ink-muted)]">
        {label}
      </p>
      <p className="mt-1 font-mono text-lg tabular-nums text-[color:var(--ink)]">
        {value}
      </p>
      {hint ? (
        <p className="mt-0.5 text-xs text-[color:var(--ink-muted)]">{hint}</p>
      ) : null}
    </div>
  );
}
