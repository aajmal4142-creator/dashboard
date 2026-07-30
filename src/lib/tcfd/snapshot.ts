import type { Payload } from "payload";

import { TCFD_QUESTIONS } from "./questions";
import {
  TCFD_DISCLAIMER,
  TCFD_PILLAR_TITLES,
  type TcfdAnswersMap,
  type TcfdDisclosureSnapshot,
  type TcfdEmissionsSnapshot,
  type TcfdPillar,
  type TcfdScenarioSummary,
} from "./types";

const PILLAR_ORDER: TcfdPillar[] = [
  "governance",
  "strategy",
  "risk_management",
  "metrics_targets",
];

function parseAnswers(raw: unknown): TcfdAnswersMap {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: TcfdAnswersMap = {};
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const row = value as Record<string, unknown>;
    const text = typeof row.text === "string" ? row.text : "";
    const source =
      row.source === "manual" || row.source === "clearesg" || row.source === "scenario"
        ? row.source
        : "manual";
    out[id] = {
      text,
      source,
      autoFilled: Boolean(row.autoFilled),
      updatedAt:
        typeof row.updatedAt === "string" ? row.updatedAt : new Date().toISOString(),
    };
  }
  return out;
}

function parseEmissions(raw: unknown): TcfdEmissionsSnapshot | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  return {
    scope1: Number(row.scope1 ?? 0),
    scope2: Number(row.scope2 ?? 0),
    scope3: Number(row.scope3 ?? 0),
    total: Number(row.total ?? 0),
    dataQualityPct: Number(row.dataQualityPct ?? 0),
    periodId: row.periodId ? String(row.periodId) : null,
    periodLabel: row.periodLabel ? String(row.periodLabel) : null,
    quality: row.quality === "calculated" ? "calculated" : "missing",
    emissionsStandard: row.emissionsStandard ? String(row.emissionsStandard) : undefined,
    capturedAt:
      typeof row.capturedAt === "string" ? row.capturedAt : new Date().toISOString(),
  };
}

export function buildTcfdSnapshot(opts: {
  organisationName: string;
  reportingYear: number;
  status: "draft" | "final";
  answers: unknown;
  emissionsSnapshot: unknown;
  scenarios: TcfdScenarioSummary[];
  preparedBy?: { id: string; name: string } | null;
  yoy?: TcfdDisclosureSnapshot["yoy"];
}): TcfdDisclosureSnapshot {
  const answers = parseAnswers(opts.answers);

  const pillars = PILLAR_ORDER.map((pillar) => ({
    pillar,
    title: TCFD_PILLAR_TITLES[pillar],
    questions: TCFD_QUESTIONS.filter((q) => q.pillar === pillar).map((q) => {
      const a = answers[q.id];
      return {
        id: q.id,
        label: q.label,
        prompt: q.prompt,
        answer: a?.text?.trim() ? a.text : "— Not disclosed —",
        source: a?.source ?? "manual",
        autoFilled: Boolean(a?.autoFilled),
      };
    }),
  }));

  return {
    organisationName: opts.organisationName,
    reportingYear: opts.reportingYear,
    status: opts.status,
    versionLabel: opts.status === "final" ? "Final" : "Draft",
    publishedAt: new Date().toISOString(),
    pillars,
    emissions: parseEmissions(opts.emissionsSnapshot),
    scenarios: opts.scenarios,
    disclaimer: TCFD_DISCLAIMER,
    preparedBy: opts.preparedBy ?? null,
    yoy: opts.yoy ?? null,
  };
}

export async function resolveScenarioSummaries(
  payload: Payload,
  links: Array<{ scenario?: string | { id: string } | null }> | null | undefined,
): Promise<TcfdScenarioSummary[]> {
  if (!links?.length) return [];
  const out: TcfdScenarioSummary[] = [];
  for (const link of links) {
    const id =
      typeof link.scenario === "string"
        ? link.scenario
        : link.scenario && typeof link.scenario === "object"
          ? link.scenario.id
          : null;
    if (!id) continue;
    try {
      const s = await payload.findByID({
        collection: "scenarios",
        id,
        depth: 0,
        overrideAccess: true,
      });
      out.push({
        id: String(s.id),
        name: String(s.name),
        type: String(s.type),
        baselineYear: Number(s.baselineYear),
        targetYear: Number(s.targetYear),
        reductionPercent: Number(s.reductionPercent ?? 0),
        category: s.category ? String(s.category) : null,
      });
    } catch {
      // skip missing
    }
  }
  return out;
}

export type AnswerDiff = {
  questionId: string;
  from: string;
  to: string;
};

export function diffTcfdAnswers(before: unknown, after: unknown): AnswerDiff[] {
  const a = parseAnswers(before);
  const b = parseAnswers(after);
  const ids = new Set([...Object.keys(a), ...Object.keys(b)]);
  const diffs: AnswerDiff[] = [];
  for (const id of ids) {
    const from = a[id]?.text ?? "";
    const to = b[id]?.text ?? "";
    if (from !== to) diffs.push({ questionId: id, from, to });
  }
  return diffs;
}

export { parseAnswers, parseEmissions };
