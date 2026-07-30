import type { TcfdDisclosureSnapshot, TcfdEmissionsSnapshot } from "./types";
import { parseAnswers, parseEmissions } from "./snapshot";
import { TCFD_QUESTIONS } from "./questions";

export type TcfdYearCompare = {
  yearA: number;
  yearB: number;
  emissions: {
    yearA: TcfdEmissionsSnapshot | null;
    yearB: TcfdEmissionsSnapshot | null;
    totalChangePct: number | null;
  };
  answers: Array<{
    questionId: string;
    label: string;
    pillar: string;
    textA: string;
    textB: string;
    changed: boolean;
  }>;
  statusA: string;
  statusB: string;
};

export function compareTcfdYears(opts: {
  yearA: number;
  yearB: number;
  statusA: string;
  statusB: string;
  answersA: unknown;
  answersB: unknown;
  emissionsA: unknown;
  emissionsB: unknown;
}): TcfdYearCompare {
  const a = parseAnswers(opts.answersA);
  const b = parseAnswers(opts.answersB);
  const emA = parseEmissions(opts.emissionsA);
  const emB = parseEmissions(opts.emissionsB);

  let totalChangePct: number | null = null;
  if (emA && emB && emA.total > 0) {
    totalChangePct = ((emB.total - emA.total) / emA.total) * 100;
  } else if (emA && emB && emA.total === 0 && emB.total === 0) {
    totalChangePct = 0;
  }

  const answers = TCFD_QUESTIONS.map((q) => {
    const textA = a[q.id]?.text ?? "";
    const textB = b[q.id]?.text ?? "";
    return {
      questionId: q.id,
      label: q.label,
      pillar: q.pillar,
      textA,
      textB,
      changed: textA.trim() !== textB.trim(),
    };
  });

  return {
    yearA: opts.yearA,
    yearB: opts.yearB,
    emissions: { yearA: emA, yearB: emB, totalChangePct },
    answers,
    statusA: opts.statusA,
    statusB: opts.statusB,
  };
}

export function yoyFromPrior(
  current: TcfdEmissionsSnapshot | null,
  priorYear: number,
  priorEmissions: unknown,
): TcfdDisclosureSnapshot["yoy"] {
  const prior = parseEmissions(priorEmissions);
  if (!current || !prior) return null;
  const changePct =
    prior.total > 0 ? ((current.total - prior.total) / prior.total) * 100 : null;
  return {
    previousYear: priorYear,
    previousTotal: prior.total,
    changePct,
  };
}
