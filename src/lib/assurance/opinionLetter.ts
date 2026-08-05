/**
 * Limited / reasonable assurance opinion letter draft — pure, zero I/O.
 * Not a signed opinion. Operators paste into their provider workflow.
 */

export type OpinionLetterInput = {
  level: "limited" | "reasonable";
  organisationName: string;
  periodLabel: string;
  materialityThresholdTco2e: number | null;
  samplingPlan: {
    method: string | null;
    populationSize: number | null;
    sampleSize: number | null;
    notes: string | null;
  } | null;
  findingsSummary: string | null;
  generatedAt?: string;
};

export function buildOpinionLetterDraft(input: OpinionLetterInput): string {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const levelLabel = input.level === "reasonable" ? "reasonable" : "limited";
  const materiality =
    input.materialityThresholdTco2e == null
      ? "not set (set a quantitative threshold before drafting)"
      : `${input.materialityThresholdTco2e} tCO₂e`;

  const sampling = input.samplingPlan
    ? [
        `Method: ${input.samplingPlan.method ?? "—"}`,
        `Population size: ${input.samplingPlan.populationSize ?? "—"}`,
        `Sample size: ${input.samplingPlan.sampleSize ?? "—"}`,
        input.samplingPlan.notes ? `Notes: ${input.samplingPlan.notes}` : null,
      ]
        .filter(Boolean)
        .join("\n")
    : "Sampling plan not recorded.";

  return [
    "ClearESG — Assurance opinion letter DRAFT",
    `Generated: ${generatedAt}`,
    "",
    "This is a working draft generated from engagement metadata. It is not a signed",
    "assurance opinion and must be reviewed and issued by the assurance provider.",
    "",
    `To the Directors of ${input.organisationName},`,
    "",
    `We have performed a ${levelLabel} assurance engagement over the GHG inventory`,
    `for the reporting period ${input.periodLabel}.`,
    "",
    `Materiality threshold (engagement): ${materiality}`,
    "",
    "Sampling plan:",
    sampling,
    "",
    input.findingsSummary?.trim()
      ? `Findings summary:\n${input.findingsSummary.trim()}`
      : "Findings summary: (none recorded on the engagement yet)",
    "",
    input.level === "limited"
      ? "Draft conclusion (limited): Based on the procedures performed and evidence obtained, nothing has come to our attention that causes us to believe the subject matter is not prepared, in all material respects, in accordance with the stated criteria. [Provider to confirm or modify.]"
      : "Draft conclusion (reasonable): In our opinion, the subject matter is prepared, in all material respects, in accordance with the stated criteria. [Provider to confirm or modify.]",
    "",
    "— End of draft —",
  ].join("\n");
}
