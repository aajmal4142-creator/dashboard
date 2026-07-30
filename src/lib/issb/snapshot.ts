import type { TcfdAnswersMap, TcfdEmissionsSnapshot } from "@/lib/tcfd/types";
import { parseAnswers, parseEmissions } from "@/lib/tcfd/snapshot";

import { ISSB_QUESTIONS } from "./questions";
import {
  ISSB_DISCLAIMER,
  type IssbAnswersMap,
  type IssbDisclosureSnapshot,
} from "./types";

export function parseIssbAnswers(raw: unknown): IssbAnswersMap {
  return parseAnswers(raw) as IssbAnswersMap;
}

/**
 * Inherit S2 answers from linked TCFD where S2 question maps to a TCFD id
 * and the ISSB answer is empty (or force).
 */
export function inheritS2FromTcfd(opts: {
  s2Answers: IssbAnswersMap;
  tcfdAnswers: TcfdAnswersMap;
  force?: boolean;
}): IssbAnswersMap {
  const now = new Date().toISOString();
  const next: IssbAnswersMap = { ...opts.s2Answers };

  for (const q of ISSB_QUESTIONS) {
    if (q.standard !== "S2" || !q.tcfdQuestionId) continue;
    const tcfd = opts.tcfdAnswers[q.tcfdQuestionId];
    if (!tcfd?.text?.trim()) continue;
    const current = next[q.id];
    const hasContent = current && current.text.trim().length > 0;
    if (hasContent && !opts.force && !current.autoFilled) continue;

    next[q.id] = {
      text: tcfd.text,
      source: tcfd.source,
      autoFilled: true,
      updatedAt: now,
    };
  }

  return next;
}

export function applyIssbAutofill(opts: {
  s1Answers: IssbAnswersMap;
  s2Answers: IssbAnswersMap;
  emissions: TcfdEmissionsSnapshot;
  materialityNote: string | null;
  force?: boolean;
}): { s1Answers: IssbAnswersMap; s2Answers: IssbAnswersMap } {
  const now = new Date().toISOString();
  const s1: IssbAnswersMap = { ...opts.s1Answers };
  const s2: IssbAnswersMap = { ...opts.s2Answers };

  for (const q of ISSB_QUESTIONS) {
    if (!q.autofillKey) continue;
    const map = q.standard === "S1" ? s1 : s2;
    const current = map[q.id];
    const hasManual =
      current &&
      current.text.trim().length > 0 &&
      current.source === "manual" &&
      !current.autoFilled;
    if (hasManual && !opts.force) continue;

    let text = "";
    if (q.autofillKey === "emissions") {
      if (opts.emissions.quality === "missing") {
        text = `No calculable emissions for this year. Scope 1/2/3 treated as data gaps.`;
      } else {
        text = [
          `Scope 1: ${opts.emissions.scope1.toFixed(2)} tCO₂e`,
          `Scope 2: ${opts.emissions.scope2.toFixed(2)} tCO₂e`,
          `Scope 3: ${opts.emissions.scope3.toFixed(2)} tCO₂e`,
          `Total: ${opts.emissions.total.toFixed(2)} tCO₂e`,
          opts.emissions.emissionsStandard ? `(${opts.emissions.emissionsStandard})` : "",
        ]
          .filter(Boolean)
          .join(". ");
      }
    } else if (q.autofillKey === "materiality") {
      text =
        opts.materialityNote ??
        "No materiality assessment linked. Complete Materiality workshop, then re-run autofill.";
    } else if (q.autofillKey === "quality") {
      text =
        opts.emissions.quality === "calculated"
          ? `Emissions from ClearESG activity × registry factors (${opts.emissions.emissionsStandard ?? "org standard"}).`
          : "Emissions quality missing — close data gaps before finalising.";
    }

    map[q.id] = {
      text,
      source: "clearesg",
      autoFilled: true,
      updatedAt: now,
    };
  }

  return { s1Answers: s1, s2Answers: s2 };
}

export function buildIssbSnapshot(opts: {
  organisationName: string;
  reportingYear: number;
  status: "draft" | "final";
  s1Answers: unknown;
  s2Answers: unknown;
  emissionsSnapshot: unknown;
  linkedTcfdId: string | null;
  materialityNote: string | null;
  preparedBy?: { id: string; name: string } | null;
}): IssbDisclosureSnapshot {
  const s1Map = parseIssbAnswers(opts.s1Answers);
  const s2Map = parseIssbAnswers(opts.s2Answers);

  return {
    organisationName: opts.organisationName,
    reportingYear: opts.reportingYear,
    status: opts.status,
    versionLabel: opts.status === "final" ? "Final" : "Draft",
    publishedAt: new Date().toISOString(),
    s1: ISSB_QUESTIONS.filter((q) => q.standard === "S1").map((q) => {
      const a = s1Map[q.id];
      return {
        id: q.id,
        label: q.label,
        prompt: q.prompt,
        answer: a?.text?.trim() ? a.text : "— Not disclosed —",
        source: a?.source ?? "manual",
        autoFilled: Boolean(a?.autoFilled),
      };
    }),
    s2: ISSB_QUESTIONS.filter((q) => q.standard === "S2").map((q) => {
      const a = s2Map[q.id];
      return {
        id: q.id,
        label: q.label,
        prompt: q.prompt,
        answer: a?.text?.trim() ? a.text : "— Not disclosed —",
        source: a?.source ?? "manual",
        autoFilled: Boolean(a?.autoFilled),
        tcfdPillar: q.tcfdPillar,
      };
    }),
    emissions: parseEmissions(opts.emissionsSnapshot),
    linkedTcfdId: opts.linkedTcfdId,
    materialityNote: opts.materialityNote,
    disclaimer: ISSB_DISCLAIMER,
    preparedBy: opts.preparedBy ?? null,
  };
}

export function diffIssbAnswerMaps(
  before: unknown,
  after: unknown,
): Array<{ questionId: string; from: string; to: string }> {
  const a = parseIssbAnswers(before);
  const b = parseIssbAnswers(after);
  const ids = new Set([...Object.keys(a), ...Object.keys(b)]);
  const diffs: Array<{ questionId: string; from: string; to: string }> = [];
  for (const id of ids) {
    const from = a[id]?.text ?? "";
    const to = b[id]?.text ?? "";
    if (from !== to) diffs.push({ questionId: id, from, to });
  }
  return diffs;
}
