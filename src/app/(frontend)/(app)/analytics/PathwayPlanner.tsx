"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { AlertCircle, Plus } from "lucide-react";

import { EmptyState, StatusLine } from "@/components/shell/PageFrame";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type FeasibilityLevel = "achievable" | "aggressive" | "unrealistic";
type MilestoneStatus = "planned" | "in_progress" | "completed" | "missed";
type PathwayScope = "1" | "2" | "3" | "cross";
type ProgressStatus = "ahead" | "on_track" | "behind";

type Milestone = {
  year: number;
  action: string;
  emissionsSaved: number;
  cost: number;
  status: MilestoneStatus;
  scope?: PathwayScope | null;
  cumulativeEmissionsSaved?: number | null;
  pathwayEmissions?: number | null;
  id?: string | null;
};

type TimelinePoint = {
  year: number;
  baselineHold: number;
  pathwayEmissions: number;
  isMilestone?: boolean | null;
};

type Feasibility = {
  level?: FeasibilityLevel | null;
  requiredAnnualReduction?: number | null;
  requiredAnnualReductionPercent?: number | null;
  peerTypicalAnnualPercent?: number | null;
  warning?: string | null;
  message?: string | null;
};

type PathwayRow = {
  id: string;
  name: string;
  description?: string | null;
  baselineYear: number;
  targetYear: number;
  baselineEmissions: number;
  targetEmissions: number;
  targetReduction?: number | null;
  milestones?: Milestone[] | null;
  timeline?: TimelinePoint[] | null;
  feasibility?: Feasibility | null;
  costEstimate?: number | null;
  status?: string | null;
};

type ProgressPayload = {
  asOfYear: number;
  comparison: {
    asOfYear: number;
    expectedEmissions: number;
    actualEmissions: number;
    varianceTco2e: number;
    aheadByTco2e: number;
    status: ProgressStatus;
    onTrack: boolean;
    message: string;
  } | null;
  actualQuality: "calculated" | "missing";
  actualMessage: string | null;
  timeline: TimelinePoint[];
};

type InterventionDraft = {
  id: string;
  action: string;
  scope: PathwayScope;
  emissionsSaved: string;
  cost: string;
};

type WizardState = {
  step: 1 | 2 | 3 | 4;
  name: string;
  baselineYear: string;
  targetYear: string;
  baselineEmissions: string;
  targetEmissions: string;
  distribution: "even" | "front_loaded" | "back_loaded";
  interventions: InterventionDraft[];
};

const DEFAULT_INTERVENTIONS: InterventionDraft[] = [
  {
    id: "scope1-fleet",
    action: "Switch to electric fleet",
    scope: "1",
    emissionsSaved: "500",
    cost: "250000",
  },
  {
    id: "scope2-renewable",
    action: "Renewable energy transition",
    scope: "2",
    emissionsSaved: "200",
    cost: "120000",
  },
  {
    id: "scope3-suppliers",
    action: "Supplier engagement program",
    scope: "3",
    emissionsSaved: "100",
    cost: "40000",
  },
];

const initialWizard = (): WizardState => {
  const y = new Date().getFullYear();
  return {
    step: 1,
    name: "Path to Net-Zero",
    baselineYear: String(y),
    targetYear: String(y + 6),
    baselineEmissions: "",
    targetEmissions: "0",
    distribution: "even",
    interventions: DEFAULT_INTERVENTIONS.map((i) => ({ ...i })),
  };
};

function fmtNum(n: number, digits = 0): string {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  });
}

function feasibilityClass(level: FeasibilityLevel | null | undefined): string {
  if (level === "achievable")
    return "border-[color:var(--signal)] text-[color:var(--signal)]";
  if (level === "aggressive")
    return "border-[color:var(--amber)] text-[color:var(--amber)]";
  return "border-[color:var(--rust)] text-[color:var(--rust)]";
}

function feasibilityLabel(level: FeasibilityLevel | null | undefined): string {
  if (level === "achievable") return "Achievable";
  if (level === "aggressive") return "Aggressive action required";
  if (level === "unrealistic") return "Unrealistic";
  return "Unknown";
}

function progressClass(status: ProgressStatus): string {
  if (status === "ahead" || status === "on_track") return "text-[color:var(--signal)]";
  return "text-[color:var(--rust)]";
}

function statusLabel(s: MilestoneStatus): string {
  if (s === "in_progress") return "In progress";
  if (s === "completed") return "Completed";
  if (s === "missed") return "Missed";
  return "Planned";
}

function PathwayChart({
  timeline,
  milestones,
  actual,
}: {
  timeline: TimelinePoint[];
  milestones: Milestone[];
  actual?: { year: number; emissions: number } | null;
}) {
  if (timeline.length === 0) return null;

  const years = timeline.map((p) => p.year);
  const allE = [
    ...timeline.map((p) => p.baselineHold),
    ...timeline.map((p) => p.pathwayEmissions),
    ...(actual ? [actual.emissions] : []),
  ];
  const maxE = Math.max(...allE, 1);
  const minE = 0;
  const w = 560;
  const h = 220;
  const padL = 48;
  const padR = 16;
  const padT = 16;
  const padB = 36;

  function x(year: number): number {
    if (years.length <= 1) return padL;
    const i = years.indexOf(year);
    const idx = i >= 0 ? i : 0;
    return padL + (idx / (years.length - 1)) * (w - padL - padR);
  }
  function y(emissions: number): number {
    const span = maxE - minE || 1;
    return padT + (1 - (emissions - minE) / span) * (h - padT - padB);
  }

  const baselinePath = timeline
    .map((p, i) => `${i === 0 ? "M" : "L"} ${x(p.year)} ${y(p.baselineHold)}`)
    .join(" ");
  const pathwayPath = timeline
    .map((p, i) => `${i === 0 ? "M" : "L"} ${x(p.year)} ${y(p.pathwayEmissions)}`)
    .join(" ");

  const milestoneYears = new Set(milestones.map((m) => m.year));

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="w-full h-auto"
      role="img"
      aria-label="Pathway timeline: baseline versus planned emissions"
    >
      <line
        x1={padL}
        y1={padT}
        x2={padL}
        y2={h - padB}
        stroke="var(--rule)"
        strokeWidth={1}
      />
      <line
        x1={padL}
        y1={h - padB}
        x2={w - padR}
        y2={h - padB}
        stroke="var(--rule)"
        strokeWidth={1}
      />
      <text
        x={4}
        y={padT + 4}
        className="fill-[color:var(--ink-muted)]"
        style={{ fontSize: 10, fontFamily: "var(--font-mono, monospace)" }}
      >
        {fmtNum(maxE)}
      </text>
      <text
        x={4}
        y={h - padB}
        className="fill-[color:var(--ink-muted)]"
        style={{ fontSize: 10, fontFamily: "var(--font-mono, monospace)" }}
      >
        0
      </text>

      <path
        d={baselinePath}
        fill="none"
        stroke="var(--ink-muted)"
        strokeWidth={1.5}
        strokeDasharray="4 3"
      />
      <path d={pathwayPath} fill="none" stroke="var(--accent)" strokeWidth={2} />

      {timeline
        .filter((p) => milestoneYears.has(p.year) || p.isMilestone)
        .map((p) => (
          <circle
            key={`m-${p.year}`}
            cx={x(p.year)}
            cy={y(p.pathwayEmissions)}
            r={4}
            fill="var(--accent)"
            stroke="var(--surface-1)"
            strokeWidth={1.5}
          />
        ))}

      {actual && years.includes(actual.year) ? (
        <circle
          cx={x(actual.year)}
          cy={y(actual.emissions)}
          r={5}
          fill="var(--cobalt)"
          stroke="var(--surface-1)"
          strokeWidth={1.5}
        />
      ) : null}

      {years.map((year) => (
        <text
          key={year}
          x={x(year)}
          y={h - 12}
          textAnchor="middle"
          className="fill-[color:var(--ink-muted)]"
          style={{ fontSize: 10, fontFamily: "var(--font-mono, monospace)" }}
        >
          {year}
        </text>
      ))}
    </svg>
  );
}

export default function PathwayPlanner() {
  const [pathways, setPathways] = useState<PathwayRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<{
    pathway: PathwayRow;
    progress: ProgressPayload;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizard, setWizard] = useState<WizardState>(initialWizard);
  const [wizardError, setWizardError] = useState<string | null>(null);
  const [feasibilityPreview, setFeasibilityPreview] = useState<Feasibility | null>(null);
  const [creating, setCreating] = useState(false);

  const loadList = useCallback(() => {
    startTransition(async () => {
      setError(null);
      try {
        const res = await fetch("/api/app/analytics/pathways");
        const json = (await res.json()) as {
          pathways?: PathwayRow[];
          error?: string;
        };
        if (!res.ok) {
          setError(json.error ?? "Could not load pathways");
          return;
        }
        const list = json.pathways ?? [];
        setPathways(list);
        if (!selectedId && list[0]) setSelectedId(list[0].id);
      } catch {
        setError("Network error loading pathways. Retry.");
      }
    });
  }, [selectedId]);

  const loadDetail = useCallback((id: string) => {
    startTransition(async () => {
      setError(null);
      try {
        const res = await fetch(`/api/app/analytics/pathways/${id}`);
        const json = (await res.json()) as {
          pathway?: PathwayRow;
          progress?: ProgressPayload;
          error?: string;
        };
        if (!res.ok || !json.pathway || !json.progress) {
          setError(json.error ?? "Could not load pathway detail");
          return;
        }
        setDetail({ pathway: json.pathway, progress: json.progress });
      } catch {
        setError("Network error loading pathway detail. Retry.");
      }
    });
  }, []);

  useEffect(() => {
    loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once
  }, []);

  useEffect(() => {
    if (selectedId) loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  async function previewFeasibility() {
    setWizardError(null);
    const baselineYear = Number(wizard.baselineYear);
    const targetYear = Number(wizard.targetYear);
    const baselineEmissions = Number(wizard.baselineEmissions);
    const targetEmissions = Number(wizard.targetEmissions);

    if (!(baselineEmissions > 0)) {
      setWizardError("Enter baseline emissions greater than zero.");
      return;
    }
    if (targetEmissions > baselineEmissions) {
      setWizardError("Target emissions must not exceed baseline.");
      return;
    }
    if (!(targetYear > baselineYear)) {
      setWizardError("Target year must be after baseline year.");
      return;
    }

    const params = new URLSearchParams({
      baselineEmissions: String(baselineEmissions),
      targetEmissions: String(targetEmissions),
      baselineYear: String(baselineYear),
      targetYear: String(targetYear),
      distribution: wizard.distribution,
    });

    try {
      const res = await fetch(`/api/app/analytics/pathways/feasibility?${params}`);
      const json = (await res.json()) as {
        feasibility?: Feasibility;
        error?: string;
      };
      if (!res.ok) {
        setWizardError(json.error ?? "Feasibility check failed");
        return;
      }
      setFeasibilityPreview(json.feasibility ?? null);
      setWizard((w) => ({ ...w, step: 3 }));
    } catch {
      setWizardError("Network error checking feasibility.");
    }
  }

  async function submitWizard() {
    setWizardError(null);
    setCreating(true);
    try {
      const interventions = wizard.interventions
        .filter((i) => i.action.trim() && Number(i.emissionsSaved) > 0)
        .map((i) => ({
          id: i.id || i.action,
          action: i.action.trim(),
          scope: i.scope,
          emissionsSaved: Number(i.emissionsSaved),
          cost: Number(i.cost) || 0,
        }));

      const res = await fetch("/api/app/analytics/pathways", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: wizard.name.trim() || undefined,
          baselineEmissions: Number(wizard.baselineEmissions),
          targetEmissions: Number(wizard.targetEmissions),
          baselineYear: Number(wizard.baselineYear),
          targetYear: Number(wizard.targetYear),
          distribution: wizard.distribution,
          interventions: interventions.length > 0 ? interventions : undefined,
        }),
      });
      const json = (await res.json()) as {
        pathway?: PathwayRow;
        error?: string;
      };
      if (!res.ok || !json.pathway) {
        setWizardError(json.error ?? "Failed to create pathway");
        return;
      }
      setWizardOpen(false);
      setWizard(initialWizard());
      setFeasibilityPreview(null);
      setSelectedId(json.pathway.id);
      loadList();
    } catch {
      setWizardError("Network error creating pathway.");
    } finally {
      setCreating(false);
    }
  }

  async function updateMilestoneStatus(milestoneIndex: number, status: MilestoneStatus) {
    if (!detail) return;
    const milestones = [...(detail.pathway.milestones ?? [])];
    const current = milestones[milestoneIndex];
    if (!current) return;
    milestones[milestoneIndex] = { ...current, status };

    const res = await fetch(
      `/api/app/analytics/pathways/${detail.pathway.id}/milestones`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          milestones: milestones.map((m) => ({
            year: m.year,
            action: m.action,
            emissionsSaved: m.emissionsSaved,
            cost: m.cost ?? 0,
            status: m.status,
            scope: m.scope ?? "cross",
          })),
        }),
      },
    );
    if (!res.ok) {
      const json = (await res.json()) as { error?: string };
      setError(json.error ?? "Failed to update milestone");
      return;
    }
    loadDetail(detail.pathway.id);
    loadList();
  }

  const selected = detail?.pathway;
  const progress = detail?.progress;
  const timeline = progress?.timeline ?? selected?.timeline ?? [];
  const feasibility = selected?.feasibility ?? feasibilityPreview;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--rule)] pb-3">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-lg text-[color:var(--ink)]">
            Decarbonization pathways
          </h2>
          <p className="text-sm text-[color:var(--ink-muted)]">
            Visual roadmap to net-zero with milestones and interventions.
          </p>
        </div>
        <Button
          type="button"
          onClick={() => {
            setWizard(initialWizard());
            setFeasibilityPreview(null);
            setWizardError(null);
            setWizardOpen(true);
          }}
        >
          <Plus className="mr-1 h-4 w-4" />
          Create pathway
        </Button>
      </div>

      {error ? <StatusLine tone="error">{error}</StatusLine> : null}

      {wizardOpen ? (
        <section className="space-y-4 border border-[color:var(--rule)] bg-[color:var(--surface-1)] p-4 rounded-[6px]">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-[color:var(--ink)]">
              Pathway wizard — step {wizard.step} of 4
            </h3>
            <Button type="button" variant="ghost" onClick={() => setWizardOpen(false)}>
              Cancel
            </Button>
          </div>

          {wizardError ? (
            <p className="text-sm text-[color:var(--rust)]">{wizardError}</p>
          ) : null}

          {wizard.step === 1 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="pw-name">Name</Label>
                <Input
                  id="pw-name"
                  value={wizard.name}
                  onChange={(e) => setWizard((w) => ({ ...w, name: e.target.value }))}
                  placeholder="Path to Net-Zero"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pw-base-year">Baseline year</Label>
                <Input
                  id="pw-base-year"
                  type="number"
                  value={wizard.baselineYear}
                  onChange={(e) =>
                    setWizard((w) => ({ ...w, baselineYear: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pw-target-year">Target year</Label>
                <Input
                  id="pw-target-year"
                  type="number"
                  value={wizard.targetYear}
                  onChange={(e) =>
                    setWizard((w) => ({ ...w, targetYear: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pw-baseline">Baseline emissions (tCO2e)</Label>
                <Input
                  id="pw-baseline"
                  type="number"
                  value={wizard.baselineEmissions}
                  onChange={(e) =>
                    setWizard((w) => ({
                      ...w,
                      baselineEmissions: e.target.value,
                    }))
                  }
                  placeholder="1000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pw-target">Target emissions (tCO2e)</Label>
                <Input
                  id="pw-target"
                  type="number"
                  value={wizard.targetEmissions}
                  onChange={(e) =>
                    setWizard((w) => ({
                      ...w,
                      targetEmissions: e.target.value,
                    }))
                  }
                  placeholder="0 for net-zero"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="pw-dist">Reduction pace</Label>
                <select
                  id="pw-dist"
                  className="w-full rounded-[4px] border border-[color:var(--rule)] bg-[color:var(--surface-2)] px-3 py-2 text-sm text-[color:var(--ink)]"
                  value={wizard.distribution}
                  onChange={(e) =>
                    setWizard((w) => ({
                      ...w,
                      distribution: e.target.value as WizardState["distribution"],
                    }))
                  }
                >
                  <option value="even">Even pace</option>
                  <option value="front_loaded">Front-loaded</option>
                  <option value="back_loaded">Back-loaded</option>
                </select>
              </div>
              <div className="sm:col-span-2 flex justify-end">
                <Button
                  type="button"
                  onClick={() => {
                    if (!(Number(wizard.baselineEmissions) > 0)) {
                      setWizardError("Enter baseline emissions greater than zero.");
                      return;
                    }
                    if (
                      Number(wizard.targetEmissions) > Number(wizard.baselineEmissions)
                    ) {
                      setWizardError("Target emissions must not exceed baseline.");
                      return;
                    }
                    setWizardError(null);
                    setWizard((w) => ({ ...w, step: 2 }));
                  }}
                >
                  Next: interventions
                </Button>
              </div>
            </div>
          ) : null}

          {wizard.step === 2 ? (
            <div className="space-y-4">
              <p className="text-sm text-[color:var(--ink-muted)]">
                Configure interventions (editable — not fixed to defaults). Leave blank to
                auto-distribute from templates.
              </p>
              {wizard.interventions.map((item, idx) => (
                <div
                  key={item.id}
                  className="grid gap-2 border-t border-[color:var(--rule)] pt-3 sm:grid-cols-5"
                >
                  <div className="sm:col-span-2 space-y-1">
                    <Label>Action</Label>
                    <Input
                      value={item.action}
                      onChange={(e) =>
                        setWizard((w) => {
                          const next = [...w.interventions];
                          next[idx] = { ...item, action: e.target.value };
                          return { ...w, interventions: next };
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Scope</Label>
                    <select
                      className="w-full rounded-[4px] border border-[color:var(--rule)] bg-[color:var(--surface-2)] px-2 py-2 text-sm"
                      value={item.scope}
                      onChange={(e) =>
                        setWizard((w) => {
                          const next = [...w.interventions];
                          next[idx] = {
                            ...item,
                            scope: e.target.value as PathwayScope,
                          };
                          return { ...w, interventions: next };
                        })
                      }
                    >
                      <option value="1">Scope 1</option>
                      <option value="2">Scope 2</option>
                      <option value="3">Scope 3</option>
                      <option value="cross">Cross</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label>Saved (tCO2e)</Label>
                    <Input
                      type="number"
                      value={item.emissionsSaved}
                      onChange={(e) =>
                        setWizard((w) => {
                          const next = [...w.interventions];
                          next[idx] = {
                            ...item,
                            emissionsSaved: e.target.value,
                          };
                          return { ...w, interventions: next };
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Cost</Label>
                    <Input
                      type="number"
                      value={item.cost}
                      onChange={(e) =>
                        setWizard((w) => {
                          const next = [...w.interventions];
                          next[idx] = { ...item, cost: e.target.value };
                          return { ...w, interventions: next };
                        })
                      }
                    />
                  </div>
                </div>
              ))}
              <div className="flex flex-wrap justify-between gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    setWizard((w) => ({
                      ...w,
                      interventions: [
                        ...w.interventions,
                        {
                          id: `custom-${w.interventions.length + 1}`,
                          action: "",
                          scope: "cross",
                          emissionsSaved: "",
                          cost: "0",
                        },
                      ],
                    }))
                  }
                >
                  Add intervention
                </Button>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setWizard((w) => ({ ...w, step: 1 }))}
                  >
                    Back
                  </Button>
                  <Button type="button" onClick={() => void previewFeasibility()}>
                    Next: feasibility
                  </Button>
                </div>
              </div>
            </div>
          ) : null}

          {wizard.step === 3 ? (
            <div className="space-y-4">
              {feasibilityPreview ? (
                <div
                  className={cn(
                    "rounded-[6px] border px-4 py-3",
                    feasibilityClass(feasibilityPreview.level),
                  )}
                >
                  <p className="text-sm font-medium">
                    {feasibilityLabel(feasibilityPreview.level)}
                  </p>
                  <p className="mt-1 font-[family-name:var(--font-mono)] text-sm tabular-nums">
                    Required{" "}
                    {fmtNum(feasibilityPreview.requiredAnnualReductionPercent ?? 0, 1)}% /
                    year ({fmtNum(feasibilityPreview.requiredAnnualReduction ?? 0)} tCO2e)
                  </p>
                  {feasibilityPreview.warning ? (
                    <p className="mt-2 text-sm text-[color:var(--ink)]">
                      {feasibilityPreview.warning}
                    </p>
                  ) : (
                    <p className="mt-2 text-sm text-[color:var(--ink-muted)]">
                      {feasibilityPreview.message}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-[color:var(--ink-muted)]">
                  Run the feasibility check to continue.
                </p>
              )}
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setWizard((w) => ({ ...w, step: 2 }))}
                >
                  Back
                </Button>
                <Button
                  type="button"
                  onClick={() => setWizard((w) => ({ ...w, step: 4 }))}
                  disabled={!feasibilityPreview}
                >
                  Review & create
                </Button>
              </div>
            </div>
          ) : null}

          {wizard.step === 4 ? (
            <div className="space-y-4">
              <dl className="grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-[color:var(--ink-muted)]">Name</dt>
                  <dd className="text-[color:var(--ink)]">{wizard.name}</dd>
                </div>
                <div>
                  <dt className="text-[color:var(--ink-muted)]">Horizon</dt>
                  <dd className="font-[family-name:var(--font-mono)] tabular-nums">
                    {wizard.baselineYear} → {wizard.targetYear}
                  </dd>
                </div>
                <div>
                  <dt className="text-[color:var(--ink-muted)]">Baseline</dt>
                  <dd className="font-[family-name:var(--font-mono)] tabular-nums">
                    {fmtNum(Number(wizard.baselineEmissions))} tCO2e
                  </dd>
                </div>
                <div>
                  <dt className="text-[color:var(--ink-muted)]">Target</dt>
                  <dd className="font-[family-name:var(--font-mono)] tabular-nums">
                    {fmtNum(Number(wizard.targetEmissions))} tCO2e
                  </dd>
                </div>
              </dl>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setWizard((w) => ({ ...w, step: 3 }))}
                >
                  Back
                </Button>
                <Button
                  type="button"
                  onClick={() => void submitWizard()}
                  disabled={creating}
                >
                  {creating ? "Creating…" : "Create pathway"}
                </Button>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {pathways.length === 0 && !wizardOpen ? (
        <EmptyState
          title="No pathways yet"
          body="Create a decarbonization pathway to chart baseline, milestones, and feasibility."
        />
      ) : null}

      {pathways.length > 0 ? (
        <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
          <ul className="space-y-1 border-r border-[color:var(--rule)] pr-3">
            {pathways.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(p.id)}
                  className={cn(
                    "w-full rounded-[4px] px-3 py-2 text-left text-sm",
                    selectedId === p.id
                      ? "bg-[color:var(--accent-quiet)] text-[color:var(--ink)]"
                      : "text-[color:var(--ink-muted)] hover:bg-[color:var(--surface-2)]",
                  )}
                >
                  <span className="block font-medium text-[color:var(--ink)]">
                    {p.name}
                  </span>
                  <span className="font-[family-name:var(--font-mono)] text-xs tabular-nums">
                    {p.baselineYear}–{p.targetYear}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          {selected ? (
            <div className="space-y-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-[family-name:var(--font-display)] text-xl text-[color:var(--ink)]">
                    {selected.name}
                  </h3>
                  <p className="text-sm text-[color:var(--ink-muted)]">
                    {selected.baselineYear} → {selected.targetYear} ·{" "}
                    <span className="font-[family-name:var(--font-mono)] tabular-nums">
                      {fmtNum(selected.baselineEmissions)} →{" "}
                      {fmtNum(selected.targetEmissions)} tCO2e
                    </span>
                    {selected.targetReduction != null
                      ? ` · ${fmtNum(selected.targetReduction, 0)}% reduction`
                      : null}
                  </p>
                </div>
                {feasibility?.level ? (
                  <div
                    className={cn(
                      "rounded-[4px] border px-3 py-2 text-sm",
                      feasibilityClass(feasibility.level),
                    )}
                  >
                    {feasibilityLabel(feasibility.level)}
                  </div>
                ) : null}
              </div>

              {feasibility?.warning ? (
                <div className="flex gap-2 rounded-[6px] border border-[color:var(--amber)] bg-[color:var(--surface-2)] px-3 py-2 text-sm text-[color:var(--ink)]">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--amber)]" />
                  <span>{feasibility.warning}</span>
                </div>
              ) : null}

              <div className="border border-[color:var(--rule)] rounded-[6px] bg-[color:var(--surface-1)] p-4">
                <div className="mb-3 flex flex-wrap gap-4 text-xs text-[color:var(--ink-muted)]">
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className="inline-block h-0.5 w-4"
                      style={{
                        background: "var(--ink-muted)",
                        borderTop: "1.5px dashed var(--ink-muted)",
                      }}
                    />
                    Baseline hold
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block h-0.5 w-4 bg-[color:var(--accent)]" />
                    Pathway
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block h-2 w-2 rounded-full bg-[color:var(--accent)]" />
                    Milestone
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block h-2 w-2 rounded-full bg-[color:var(--cobalt)]" />
                    Actual
                  </span>
                </div>
                <PathwayChart
                  timeline={timeline}
                  milestones={selected.milestones ?? []}
                  actual={
                    progress?.comparison
                      ? {
                          year: progress.asOfYear,
                          emissions: progress.comparison.actualEmissions,
                        }
                      : null
                  }
                />
              </div>

              <div className="border border-[color:var(--rule)] rounded-[6px] p-4">
                <h4 className="mb-2 text-sm font-medium text-[color:var(--ink)]">
                  Actual vs pathway
                </h4>
                {pending && !progress ? (
                  <p className="text-sm text-[color:var(--ink-muted)]">Loading…</p>
                ) : progress?.comparison ? (
                  <div className="space-y-1 text-sm">
                    <p className={cn(progressClass(progress.comparison.status))}>
                      {progress.comparison.message}
                    </p>
                    <p className="font-[family-name:var(--font-mono)] tabular-nums text-[color:var(--ink-muted)]">
                      As of {progress.asOfYear}: expected{" "}
                      {fmtNum(progress.comparison.expectedEmissions)} · actual{" "}
                      {fmtNum(progress.comparison.actualEmissions)} tCO2e
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-[color:var(--ink-muted)]">
                    {progress?.actualMessage ??
                      "Actual emissions not available for comparison yet."}
                  </p>
                )}
              </div>

              <div>
                <h4 className="mb-3 text-sm font-medium text-[color:var(--ink)]">
                  Milestones
                </h4>
                {(selected.milestones ?? []).length === 0 ? (
                  <p className="text-sm text-[color:var(--ink-muted)]">
                    No milestones on this pathway.
                  </p>
                ) : (
                  <ul className="divide-y divide-[color:var(--rule)] border-t border-[color:var(--rule)]">
                    {(selected.milestones ?? []).map((m, idx) => (
                      <li
                        key={`${m.year}-${m.action}-${idx}`}
                        className="grid gap-2 py-3 sm:grid-cols-[72px_1fr_auto] sm:items-center"
                      >
                        <span className="font-[family-name:var(--font-mono)] text-sm tabular-nums text-[color:var(--ink)]">
                          {m.year}
                        </span>
                        <div>
                          <p className="text-sm text-[color:var(--ink)]">{m.action}</p>
                          <p className="font-[family-name:var(--font-mono)] text-xs tabular-nums text-[color:var(--ink-muted)]">
                            −{fmtNum(m.emissionsSaved)} tCO2e
                            {m.cost != null ? ` · cost ${fmtNum(m.cost)}` : null}
                            {m.scope ? ` · Scope ${m.scope}` : null}
                          </p>
                        </div>
                        <select
                          className="rounded-[4px] border border-[color:var(--rule)] bg-[color:var(--surface-2)] px-2 py-1 text-xs"
                          value={m.status}
                          onChange={(e) =>
                            void updateMilestoneStatus(
                              idx,
                              e.target.value as MilestoneStatus,
                            )
                          }
                          aria-label={`Status for ${m.action}`}
                        >
                          <option value="planned">{statusLabel("planned")}</option>
                          <option value="in_progress">
                            {statusLabel("in_progress")}
                          </option>
                          <option value="completed">{statusLabel("completed")}</option>
                          <option value="missed">{statusLabel("missed")}</option>
                        </select>
                      </li>
                    ))}
                  </ul>
                )}
                {selected.costEstimate != null ? (
                  <p className="mt-3 font-[family-name:var(--font-mono)] text-sm tabular-nums text-[color:var(--ink-muted)]">
                    Cost estimate: {fmtNum(selected.costEstimate)}
                  </p>
                ) : null}
              </div>
            </div>
          ) : (
            <p className="text-sm text-[color:var(--ink-muted)]">
              Select a pathway to view the timeline.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
