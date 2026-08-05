"use client";

import { useMemo, useState } from "react";

import { PageFrame, StatusLine } from "@/components/shell/PageFrame";
import {
  crosswalkForTopic,
  ESRS_TOPICS,
  financialScoreOf,
  impactScoreOf,
  isMaterial,
  MATERIALITY_THRESHOLD,
  SECTOR_DEFAULTS_DISCLAIMER,
  sectorDefaults,
  topicOriginAgainstDefault,
  type EsrsTopic,
  type TopicOrigin,
} from "@/lib/materiality";

type IroKind = "impact" | "risk" | "opportunity";

type Iro = {
  kind: IroKind;
  description: string;
  severity: number;
};

type TopicScore = {
  esrsTopic: string;
  impactSeverity: number;
  impactScope: number;
  impactIrremediability: number;
  financialMagnitude: number;
  financialLikelihood: number;
  rationale: string;
  origin: TopicOrigin;
  stakeholderSurveyAvg: number | null;
  iros: Iro[];
};

function fromDefaults(sector: string): TopicScore[] {
  return sectorDefaults(sector).map((s) => ({
    ...s,
    origin: "suggested" as const,
    stakeholderSurveyAvg: null,
    iros: [],
  }));
}

function parseIros(value: unknown): Iro[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw) => {
    const row = raw as Record<string, unknown>;
    const kind = row.kind;
    if (kind !== "impact" && kind !== "risk" && kind !== "opportunity") return [];
    const description = typeof row.description === "string" ? row.description : "";
    const severity =
      typeof row.severity === "number" && Number.isFinite(row.severity)
        ? row.severity
        : 0;
    return [{ kind, description, severity }];
  });
}

function fromAssessment(topics: unknown, sector: string): TopicScore[] {
  const baselines = sectorDefaults(sector);
  const baselineById = new Map(baselines.map((b) => [b.esrsTopic, b]));
  if (!Array.isArray(topics) || topics.length === 0) return fromDefaults(sector);
  const byId = new Map(
    topics.map((t) => {
      const row = t as Record<string, unknown>;
      return [String(row.esrsTopic), row] as const;
    }),
  );
  return ESRS_TOPICS.map((t) => {
    const row = byId.get(t.id);
    const baseline = baselineById.get(t.id)!;
    if (!row) {
      return {
        ...baseline,
        origin: "suggested" as const,
        stakeholderSurveyAvg: null,
        iros: [],
      };
    }
    const current = {
      esrsTopic: t.id,
      impactSeverity: Number(row.impactSeverity ?? baseline.impactSeverity),
      impactScope: Number(row.impactScope ?? baseline.impactScope),
      impactIrremediability: Number(
        row.impactIrremediability ?? baseline.impactIrremediability,
      ),
      financialMagnitude: Number(row.financialMagnitude ?? baseline.financialMagnitude),
      financialLikelihood: Number(
        row.financialLikelihood ?? baseline.financialLikelihood,
      ),
      rationale: String(row.rationale ?? baseline.rationale),
    };
    const origin =
      row.origin === "suggested" || row.origin === "adjusted"
        ? (row.origin as TopicOrigin)
        : topicOriginAgainstDefault(current, baseline);
    const stakeholderSurveyAvg =
      typeof row.stakeholderSurveyAvg === "number" &&
      Number.isFinite(row.stakeholderSurveyAvg)
        ? row.stakeholderSurveyAvg
        : null;
    return { ...current, origin, stakeholderSurveyAvg, iros: parseIros(row.iros) };
  });
}

export function MaterialityWorkshop({
  initialAssessment,
  topicsCatalog,
  canWrite = true,
  sector,
}: {
  initialAssessment: {
    topics?: unknown;
    status?: string;
    narrative?: string | null;
    surveyNotes?: string | null;
  } | null;
  topicsCatalog: EsrsTopic[];
  canWrite?: boolean;
  sector: string;
}) {
  const baselines = useMemo(() => sectorDefaults(sector), [sector]);
  const [scores, setScores] = useState(() =>
    fromAssessment(initialAssessment?.topics, sector),
  );
  const [active, setActive] = useState(0);
  const [status, setStatus] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<"neutral" | "error" | "ok">("neutral");
  const [narrative, setNarrative] = useState(initialAssessment?.narrative ?? "");
  const [surveyNotes, setSurveyNotes] = useState(initialAssessment?.surveyNotes ?? "");
  const [assessmentStatus, setAssessmentStatus] = useState(
    initialAssessment?.status ?? "draft",
  );
  const [newIroKind, setNewIroKind] = useState<IroKind>("impact");
  const [newIroDescription, setNewIroDescription] = useState("");
  const [newIroSeverity, setNewIroSeverity] = useState(3);

  const locked = assessmentStatus === "final" || !canWrite;

  const computed = useMemo(
    () =>
      scores.map((s) => {
        const impact = impactScoreOf({
          severity: s.impactSeverity,
          scope: s.impactScope,
          irremediability: s.impactIrremediability,
        });
        const financial = financialScoreOf({
          magnitude: s.financialMagnitude,
          likelihood: s.financialLikelihood,
        });
        return {
          ...s,
          impactScore: impact,
          financialScore: financial,
          material: isMaterial(impact, financial),
        };
      }),
    [scores],
  );

  const topic = topicsCatalog[active] ?? ESRS_TOPICS[active];
  const row = scores[active];

  async function save(finalise: boolean) {
    if (locked) return;
    setStatusTone("neutral");
    setStatus(finalise ? "Finalising…" : "Saving…");
    const res = await fetch("/api/app/materiality", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topics: computed, finalise, surveyNotes }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      assessment?: { narrative?: string; status?: string };
    };
    if (!res.ok) {
      const raw = data.error ?? "Save failed";
      setStatusTone("error");
      setStatus(
        raw === "Forbidden"
          ? "You do not have permission to change this assessment. Ask an admin."
          : raw,
      );
      return;
    }
    if (data.assessment?.narrative) setNarrative(data.assessment.narrative);
    if (finalise) setAssessmentStatus("final");
    setStatusTone("ok");
    setStatus(finalise ? "Assessment finalised" : "Draft saved");
  }

  function setField(key: keyof TopicScore, value: number | string) {
    setScores((prev) =>
      prev.map((s, i) => {
        if (i !== active) return s;
        const next = { ...s, [key]: value };
        const baseline = baselines.find((b) => b.esrsTopic === s.esrsTopic);
        const origin = baseline
          ? topicOriginAgainstDefault(
              {
                esrsTopic: next.esrsTopic,
                impactSeverity: next.impactSeverity,
                impactScope: next.impactScope,
                impactIrremediability: next.impactIrremediability,
                financialMagnitude: next.financialMagnitude,
                financialLikelihood: next.financialLikelihood,
                rationale: next.rationale,
              },
              baseline,
            )
          : "adjusted";
        return { ...next, origin };
      }),
    );
  }

  function addIro() {
    if (locked || !newIroDescription.trim()) return;
    const description = newIroDescription.trim();
    setScores((prev) =>
      prev.map((s, i) =>
        i !== active
          ? s
          : {
              ...s,
              iros: [
                ...s.iros,
                { kind: newIroKind, description, severity: newIroSeverity },
              ],
            },
      ),
    );
    setNewIroDescription("");
    setNewIroSeverity(3);
  }

  function removeIro(index: number) {
    if (locked) return;
    setScores((prev) =>
      prev.map((s, i) =>
        i !== active ? s : { ...s, iros: s.iros.filter((_, j) => j !== index) },
      ),
    );
  }

  return (
    <PageFrame
      eyebrow="Double materiality"
      title="Workshop"
      help={`Score each topic in turn. The matrix on the right is the output of those scores — not an input. Threshold ${MATERIALITY_THRESHOLD} on either axis.`}
      actions={
        !canWrite ? (
          <p className="text-[13px] text-ink-muted">View only</p>
        ) : assessmentStatus === "final" ? (
          <p className="text-[13px] text-signal">Final — locked for this period</p>
        ) : undefined
      }
      rail={
        <div>
          <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
            Matrix (output)
          </p>
          <div className="relative aspect-square w-full rounded-[6px] border border-rule bg-surface-1">
            <div
              className="absolute left-0 right-0 border-t border-dashed border-rule"
              style={{ bottom: `${(MATERIALITY_THRESHOLD / 5) * 100}%` }}
            />
            <div
              className="absolute top-0 bottom-0 border-l border-dashed border-rule"
              style={{ left: `${(MATERIALITY_THRESHOLD / 5) * 100}%` }}
            />
            <span className="absolute bottom-2 left-2 text-xs text-ink-muted">
              Impact →
            </span>
            <span className="absolute left-2 top-2 text-xs text-ink-muted">
              Financial ↑
            </span>

            {computed.map((p, idx) => {
              const baseLeft = (p.impactScore / 5) * 100;
              const baseBottom = (p.financialScore / 5) * 100;
              const jitterX = ((idx % 5) - 2) * 0.4;
              const jitterY = (((idx * 3) % 5) - 2) * 0.4;
              const left = `${Math.min(98, Math.max(2, baseLeft + jitterX))}%`;
              const bottom = `${Math.min(98, Math.max(2, baseBottom + jitterY))}%`;
              const topicIdx = scores.findIndex((s) => s.esrsTopic === p.esrsTopic);
              return (
                <button
                  key={p.esrsTopic}
                  type="button"
                  className={`absolute -translate-x-1/2 translate-y-1/2 font-data text-xs ${
                    p.material ? "text-signal" : "text-ink-muted"
                  }`}
                  style={{ left, bottom }}
                  onClick={() => setActive(topicIdx)}
                >
                  {p.esrsTopic}
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-[12px] text-ink-muted">
            Material topics render in signal green. Click a label to open that topic.
          </p>
        </div>
      }
    >
      <div className="space-y-4">
        {status ? <StatusLine tone={statusTone}>{status}</StatusLine> : null}

        <p className="text-[13px] text-ink-muted">{SECTOR_DEFAULTS_DISCLAIMER}</p>

        <div className="mt-4 flex flex-wrap gap-2">
          {topicsCatalog.map((t, i) => {
            const c = computed[i];
            const selected = i === active;
            return (
              <button
                key={t.id}
                type="button"
                aria-pressed={selected}
                onClick={() => setActive(i)}
                className={`border px-2 py-1 font-data text-xs ${
                  selected
                    ? "border-rule-strong text-ink"
                    : c?.material
                      ? "border-signal/60 text-signal"
                      : "border-rule text-ink-muted"
                }`}
              >
                {t.id}
              </button>
            );
          })}
        </div>

        {topic && row ? (
          <div
            className={`mt-8 space-y-4 border-t border-rule pt-4 ${locked ? "opacity-60" : ""}`}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg text-ink">
                {topic.id} — {topic.label}
              </h2>
              <p className="label-caps text-ink-muted">
                Origin · {row.origin === "suggested" ? "suggested" : "adjusted"}
              </p>
            </div>
            <p className="text-sm text-ink-muted">{topic.description}</p>
            {(() => {
              const crosswalk = crosswalkForTopic(topic.id);
              if (!crosswalk) return null;
              return (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="label-caps text-ink-muted">ESRS disclosures</span>
                  {crosswalk.disclosureCodes.map((code) => (
                    <span
                      key={code}
                      className="rounded-[2px] border border-rule px-1.5 py-0.5 font-data text-[11px] text-ink-muted"
                      title={crosswalk.note}
                    >
                      {code}
                    </span>
                  ))}
                </div>
              );
            })()}
            {(
              [
                ["impactSeverity", "Impact severity"],
                ["impactScope", "Impact scope"],
                ["impactIrremediability", "Irremediability"],
                ["financialMagnitude", "Financial magnitude"],
                ["financialLikelihood", "Financial likelihood"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className={`block ${locked ? "opacity-70" : ""}`}>
                <span className="label-caps">{label}</span>
                <input
                  type="range"
                  min={0}
                  max={5}
                  step={1}
                  disabled={locked}
                  className="mt-2 w-full accent-[var(--signal)] disabled:cursor-not-allowed"
                  value={Number(row[key])}
                  onChange={(e) => setField(key, Number(e.target.value))}
                />
                <span className="font-data text-sm text-ink">{row[key]}</span>
              </label>
            ))}
            <label className={`block ${locked ? "opacity-70" : ""}`}>
              <span className="label-caps">Rationale</span>
              <textarea
                disabled={locked}
                className="mt-2 w-full border border-rule bg-surface-1 px-2 py-2 text-sm text-ink disabled:cursor-not-allowed"
                rows={3}
                value={row.rationale}
                onChange={(e) => setField("rationale", e.target.value)}
              />
            </label>
            <label className={`block ${locked ? "opacity-70" : ""}`}>
              <span className="label-caps">
                Stakeholder survey average (optional, 0–5)
              </span>
              <input
                type="number"
                min={0}
                max={5}
                step={0.1}
                disabled={locked}
                className="mt-2 w-32 border border-rule bg-surface-1 px-2 py-1.5 font-data text-sm text-ink disabled:cursor-not-allowed"
                value={row.stakeholderSurveyAvg ?? ""}
                onChange={(e) =>
                  setScores((prev) =>
                    prev.map((s, i) =>
                      i !== active
                        ? s
                        : {
                            ...s,
                            stakeholderSurveyAvg:
                              e.target.value === "" ? null : Number(e.target.value),
                          },
                    ),
                  )
                }
              />
            </label>

            <div className={locked ? "opacity-70" : ""}>
              <span className="label-caps">Impacts, risks, opportunities</span>
              <ul className="mt-2 space-y-2">
                {row.iros.length === 0 ? (
                  <li className="text-[12px] text-ink-muted">No IRO entries recorded.</li>
                ) : (
                  row.iros.map((iro, idx) => (
                    <li
                      key={idx}
                      className="flex items-start justify-between gap-2 border border-rule bg-surface-1 px-2 py-1.5 text-[12px]"
                    >
                      <span>
                        <span className="font-data uppercase text-ink-muted">
                          {iro.kind}
                        </span>
                        {" · severity "}
                        <span className="font-data text-ink">{iro.severity}</span>
                        {" — "}
                        <span className="text-ink-muted">{iro.description}</span>
                      </span>
                      {!locked ? (
                        <button
                          type="button"
                          onClick={() => removeIro(idx)}
                          className="shrink-0 text-ink-muted hover:text-rust"
                          aria-label="Remove IRO"
                        >
                          ×
                        </button>
                      ) : null}
                    </li>
                  ))
                )}
              </ul>
              {!locked ? (
                <div className="mt-2 flex flex-wrap items-end gap-2">
                  <select
                    value={newIroKind}
                    onChange={(e) => setNewIroKind(e.target.value as IroKind)}
                    className="border border-rule bg-surface-1 px-2 py-1.5 text-[12px] text-ink"
                  >
                    <option value="impact">Impact</option>
                    <option value="risk">Risk</option>
                    <option value="opportunity">Opportunity</option>
                  </select>
                  <input
                    type="number"
                    min={0}
                    max={5}
                    value={newIroSeverity}
                    onChange={(e) => setNewIroSeverity(Number(e.target.value))}
                    className="w-16 border border-rule bg-surface-1 px-2 py-1.5 font-data text-[12px] text-ink"
                  />
                  <input
                    type="text"
                    placeholder="Description"
                    value={newIroDescription}
                    onChange={(e) => setNewIroDescription(e.target.value)}
                    className="min-w-[12rem] flex-1 border border-rule bg-surface-1 px-2 py-1.5 text-[12px] text-ink"
                  />
                  <button
                    type="button"
                    onClick={addIro}
                    disabled={!newIroDescription.trim()}
                    className="border border-rule px-2 py-1.5 text-[12px] text-ink-muted hover:border-rule-strong hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Add
                  </button>
                </div>
              ) : null}
            </div>

            <p className="font-data text-sm text-ink-muted">
              Impact {computed[active]?.impactScore} · Financial{" "}
              {computed[active]?.financialScore}
              {computed[active]?.material ? " · material" : ""}
            </p>
          </div>
        ) : null}

        <label className={`block ${locked ? "opacity-70" : ""}`}>
          <span className="label-caps">
            Stakeholder engagement / survey notes (optional)
          </span>
          <textarea
            disabled={locked}
            className="mt-2 w-full border border-rule bg-surface-1 px-2 py-2 text-sm text-ink disabled:cursor-not-allowed"
            rows={3}
            value={surveyNotes}
            onChange={(e) => setSurveyNotes(e.target.value)}
            placeholder="Methodology, respondent count, dates — free text."
          />
        </label>

        {!locked && canWrite && assessmentStatus !== "final" ? (
          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={() => void save(false)}
              className="border border-rule px-3 py-2 text-sm text-ink-muted hover:border-rule-strong hover:text-ink"
            >
              Save draft
            </button>
            <button
              type="button"
              onClick={() => void save(true)}
              className="border border-rule bg-surface-1 px-3 py-2 text-sm text-ink hover:border-rule-strong"
            >
              Finalise
            </button>
          </div>
        ) : null}

        {narrative ? (
          <div className="rounded-[6px] border border-rule bg-surface-1 p-4 md:p-5">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
              Narrative
            </p>
            <p className="text-[13px] text-ink-muted">{narrative}</p>
          </div>
        ) : null}
      </div>
    </PageFrame>
  );
}
