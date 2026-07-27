/**
 * lib/narrative/index.ts — BUILD_PLAN §5, hard rule 4.
 *
 * Deterministic, template-based plain-English sentences. No LLM, ever. Every sentence
 * traces back to a `breakdown[]` entry or a direct comparison between two `CalcResult`s.
 * Pure. Zero I/O, zero framework imports.
 */
import type { Band, CalcResult } from "../calc";

type ScoreKey = "e" | "s" | "g" | "overall";

const SCORE_LABELS: Record<ScoreKey, string> = {
  e: "E",
  s: "S",
  g: "G",
  overall: "Overall",
};

/** breakdown `component` prefixes that belong to each score, used to find the biggest mover. */
const SCORE_DRIVER_PREFIXES: Record<Exclude<ScoreKey, "overall">, string[]> = {
  e: ["e_", "scope1_", "scope2_", "scope3_"],
  s: ["s_"],
  g: ["g_"],
};

function round1(value: number): number {
  const rounded = Math.round(value * 10) / 10;
  return rounded === 0 ? 0 : rounded; // normalise -0
}

function plural(count: number, singular: string, pluralForm: string): string {
  return count === 1 ? singular : pluralForm;
}

/** One sentence per breakdown item — these already read as complete statements. */
export function describeBreakdown(result: CalcResult): string[] {
  return result.breakdown.map((item) => item.explanation);
}

function biggestMover(
  key: Exclude<ScoreKey, "overall">,
  current: CalcResult,
  previous: CalcResult,
): { label: string; deltaTco2eOrPoints: number } | null {
  const prefixes = SCORE_DRIVER_PREFIXES[key];
  const matches = (component: string) => prefixes.some((p) => component.startsWith(p));

  const currentByComponent = new Map(
    current.breakdown.filter((b) => matches(b.component)).map((b) => [b.component, b]),
  );
  const previousByComponent = new Map(
    previous.breakdown.filter((b) => matches(b.component)).map((b) => [b.component, b]),
  );

  let best: { label: string; delta: number } | null = null;
  for (const [component, currentItem] of currentByComponent) {
    const previousItem = previousByComponent.get(component);
    const delta = currentItem.contribution - (previousItem?.contribution ?? 0);
    if (best === null || Math.abs(delta) > Math.abs(best.delta)) {
      best = { label: currentItem.explanation, delta };
    }
  }
  if (best === null || best.delta === 0) return null;
  return { label: best.label, deltaTco2eOrPoints: best.delta };
}

function driverClause(key: ScoreKey, current: CalcResult, previous: CalcResult): string {
  if (key === "overall") return "";
  const mover = biggestMover(key, current, previous);
  if (mover === null) return "";
  // Lower-case the first letter of the driving breakdown sentence to fit mid-sentence.
  const clause =
    mover.label.charAt(0).toLowerCase() + mover.label.slice(1).replace(/\.$/, "");
  return ` — the largest mover was: ${clause}`;
}

/** One sentence per E / S / G / Overall comparing this period to the previous one. */
export function describeScoreDeltas(current: CalcResult, previous: CalcResult): string[] {
  const keys: ScoreKey[] = ["e", "s", "g", "overall"];
  return keys.map((key) => {
    const label = SCORE_LABELS[key];
    const curr = key === "overall" ? current.scores.overall : current.scores[key];
    const prev = key === "overall" ? previous.scores.overall : previous.scores[key];
    const delta = round1(curr - prev);

    if (delta === 0) {
      return `Your ${label} score held steady at ${round1(curr)}.`;
    }
    const direction = delta > 0 ? "rose" : "fell";
    const magnitude = Math.abs(delta);
    const pointWord = plural(magnitude, "point", "points");
    return `Your ${label} score ${direction} ${magnitude} ${pointWord} to ${round1(curr)}${driverClause(key, current, previous)}.`;
  });
}

function describeEmissionsDelta(current: CalcResult, previous: CalcResult): string {
  const currentTotal = round1(current.emissions.total.value);
  const previousTotal = round1(previous.emissions.total.value);
  const delta = round1(currentTotal - previousTotal);

  if (delta === 0) {
    return `Total emissions held steady at ${currentTotal} tCO2e.`;
  }
  const direction = delta > 0 ? "rose" : "fell";
  const pctBase = previousTotal !== 0 ? Math.abs((delta / previousTotal) * 100) : null;
  const pctClause = pctBase !== null ? ` (${round1(pctBase)}%)` : "";
  return `Total emissions ${direction} from ${previousTotal} to ${currentTotal} tCO2e${pctClause}.`;
}

function describeDataQualityDelta(
  current: CalcResult,
  previous: CalcResult,
): string | null {
  const delta = current.dataQualityPct - previous.dataQualityPct;
  if (delta === 0) return null;
  const direction = delta > 0 ? "improved" : "declined";
  return `Data quality ${direction} from ${previous.dataQualityPct}% to ${current.dataQualityPct}%.`;
}

export function bandChangeSentence(
  current: CalcResult,
  previous: CalcResult,
): string | null {
  if (current.band === previous.band) return null;
  const describe = (band: Band) => band;
  return `Your compliance band moved from ${describe(previous.band)} to ${describe(current.band)}.`;
}

/**
 * The full narrative for one CalcResult: every breakdown sentence, plus — when a previous
 * period is supplied — score deltas, an emissions delta, a data-quality delta, and a band
 * change sentence. Order is deterministic: current-period facts first, then deltas.
 */
export function generateNarrative(current: CalcResult, previous?: CalcResult): string[] {
  const sentences: string[] = [...describeBreakdown(current)];

  if (previous !== undefined) {
    sentences.push(...describeScoreDeltas(current, previous));
    sentences.push(describeEmissionsDelta(current, previous));
    const qualitySentence = describeDataQualityDelta(current, previous);
    if (qualitySentence !== null) sentences.push(qualitySentence);
    const bandSentence = bandChangeSentence(current, previous);
    if (bandSentence !== null) sentences.push(bandSentence);
  }

  return sentences;
}
