import {
  FRAMEWORK_LABELS,
  MULTI_FRAMEWORK_DISCLAIMER,
  type CsrdSectionContent,
  type FrameworkCompletenessInput,
  type GriMaterialTopic,
  type GriSectionContent,
  type IssbMetricItem,
  type IssbSectionContent,
  type MultiFrameworkExecutiveSummary,
  type MultiFrameworkId,
  type MultiFrameworkReport,
  type MultiFrameworkSection,
  type MultiFrameworkTarget,
  type SharedEmissionsBlock,
  type TcfdRiskItem,
  type TcfdScenarioItem,
  type TcfdSectionContent,
} from "./types";

/** Preferred owner of the single shared emissions block. */
export const EMISSIONS_OWNER_PRIORITY: MultiFrameworkId[] = ["csrd", "tcfd", "issb"];

/**
 * Keep only complete frameworks. Incomplete entries are skipped — never rendered
 * as finished sections.
 */
export function selectCompleteFrameworks(inputs: FrameworkCompletenessInput[]): {
  included: MultiFrameworkId[];
  skipped: Array<{ framework: MultiFrameworkId; reason: string }>;
} {
  const included: MultiFrameworkId[] = [];
  const skipped: Array<{ framework: MultiFrameworkId; reason: string }> = [];
  const order: MultiFrameworkId[] = ["csrd", "tcfd", "issb", "gri"];

  for (const id of order) {
    const row = inputs.find((i) => i.framework === id);
    if (!row) {
      skipped.push({
        framework: id,
        reason: "No assessment found for this period.",
      });
      continue;
    }
    if (row.complete) {
      included.push(id);
    } else {
      skipped.push({
        framework: id,
        reason: row.skipReason ?? "Incomplete — omitted from consolidated report.",
      });
    }
  }

  return { included, skipped };
}

/**
 * Pick a single emissions owner among included frameworks that have data.
 * Prevents Scope 1/2/3 totals from being printed in multiple sections.
 */
export function resolveEmissionsOwner(
  included: MultiFrameworkId[],
  sources: Partial<Record<MultiFrameworkId, SharedEmissionsBlock | null | undefined>>,
): {
  owner: MultiFrameworkId | null;
  emissions: SharedEmissionsBlock | null;
} {
  for (const id of EMISSIONS_OWNER_PRIORITY) {
    if (!included.includes(id)) continue;
    const block = sources[id];
    if (block && Number.isFinite(block.total)) {
      return { owner: id, emissions: block };
    }
  }
  return { owner: null, emissions: null };
}

/**
 * Cross-reference copy pointing at the section that owns shared emissions.
 */
export function buildEmissionsCrossReference(
  owner: MultiFrameworkId,
  sectionNumber: number,
): string {
  const label = FRAMEWORK_LABELS[owner];
  return `See ${label} Section ${sectionNumber} for emissions details.`;
}

export function sectionNumberFor(
  included: MultiFrameworkId[],
  framework: MultiFrameworkId,
): number | null {
  const idx = included.indexOf(framework);
  if (idx < 0) return null;
  // Section 1 = executive summary; frameworks start at 2.
  return idx + 2;
}

export function buildExecutiveSummary(opts: {
  organisationName: string;
  periodLabel: string;
  reportingYear: number;
  included: MultiFrameworkId[];
  skipped: Array<{ framework: MultiFrameworkId; reason: string }>;
  emissions: SharedEmissionsBlock | null;
  materialTopicCount: number;
  targetCount: number;
  scenarioCount: number;
}): MultiFrameworkExecutiveSummary {
  const names = opts.included.map((id) => FRAMEWORK_LABELS[id]);
  const frameworkList =
    names.length === 0
      ? "no completed frameworks"
      : names.length === 1
        ? names[0]
        : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;

  const parts: string[] = [
    `${opts.organisationName} multi-framework disclosure for ${opts.periodLabel} (${opts.reportingYear}) covers ${frameworkList}.`,
  ];

  if (opts.emissions) {
    parts.push(
      `Shared GHG inventory: Scope 1 ${opts.emissions.scope1.toFixed(2)} tCO₂e, Scope 2 ${opts.emissions.scope2.toFixed(2)} tCO₂e, Scope 3 ${opts.emissions.scope3.toFixed(2)} tCO₂e (total ${opts.emissions.total.toFixed(2)} tCO₂e). Figures appear once; other sections cross-reference.`,
    );
  }

  if (opts.included.includes("gri") && opts.materialTopicCount > 0) {
    parts.push(
      `GRI material topics: ${opts.materialTopicCount} topic${opts.materialTopicCount === 1 ? "" : "s"} above threshold.`,
    );
  }

  if (opts.skipped.length > 0) {
    parts.push(
      `Omitted incomplete frameworks: ${opts.skipped.map((s) => FRAMEWORK_LABELS[s.framework]).join(", ")}.`,
    );
  }

  const highlights: string[] = [];
  if (opts.emissions) {
    highlights.push(
      `Total emissions ${opts.emissions.total.toFixed(2)} tCO₂e (single shared inventory).`,
    );
  }
  if (opts.targetCount > 0) {
    highlights.push(`${opts.targetCount} CSRD reduction target(s).`);
  }
  if (opts.scenarioCount > 0) {
    highlights.push(`${opts.scenarioCount} TCFD climate scenario(s).`);
  }
  if (opts.materialTopicCount > 0 && opts.included.includes("gri")) {
    highlights.push(`${opts.materialTopicCount} material topic(s) (GRI).`);
  }
  for (const id of opts.included) {
    highlights.push(`${FRAMEWORK_LABELS[id]} section included.`);
  }

  return {
    paragraph: parts.join(" "),
    includedFrameworks: opts.included,
    skippedFrameworks: opts.skipped,
    highlights,
  };
}

export type AssembleMultiFrameworkInput = {
  organisationId: string;
  organisationName: string;
  periodId: string;
  periodLabel: string;
  reportingYear: number;
  generatedAt?: string;
  completeness: FrameworkCompletenessInput[];
  emissionsByFramework: Partial<
    Record<MultiFrameworkId, SharedEmissionsBlock | null | undefined>
  >;
  csrd?: {
    reportId: string | null;
    reportFramework: string | null;
    targets: MultiFrameworkTarget[];
    scores: { overall: number; e: number; s: number; g: number } | null;
  };
  tcfd?: {
    disclosureId: string | null;
    riskItems: TcfdRiskItem[];
    scenarios: TcfdScenarioItem[];
  };
  issb?: {
    disclosureId: string | null;
    metrics: IssbMetricItem[];
  };
  gri?: {
    narrative: string | null;
    materialTopics: GriMaterialTopic[];
  };
};

/**
 * Assemble the unified report. Skips incomplete frameworks and prints emissions
 * in exactly one section (preferred: CSRD).
 */
export function assembleMultiFrameworkReport(
  input: AssembleMultiFrameworkInput,
): MultiFrameworkReport {
  const { included, skipped } = selectCompleteFrameworks(input.completeness);
  const { owner, emissions } = resolveEmissionsOwner(
    included,
    input.emissionsByFramework,
  );

  const ownerSectionNumber = owner != null ? sectionNumberFor(included, owner) : null;

  const sections: MultiFrameworkSection[] = [];

  for (const id of included) {
    const sectionNumber = sectionNumberFor(included, id);
    if (sectionNumber == null) continue;

    const ownsEmissions = owner === id;
    const emissionsCrossRef =
      !ownsEmissions && owner != null && ownerSectionNumber != null
        ? buildEmissionsCrossReference(owner, ownerSectionNumber)
        : null;

    if (id === "csrd") {
      const section: CsrdSectionContent = {
        framework: "csrd",
        sectionNumber,
        reportId: input.csrd?.reportId ?? null,
        reportFramework: input.csrd?.reportFramework ?? null,
        includeEmissions: ownsEmissions,
        emissions: ownsEmissions ? emissions : null,
        emissionsCrossRef,
        targets: input.csrd?.targets ?? [],
        scores: input.csrd?.scores ?? null,
      };
      sections.push(section);
    } else if (id === "tcfd") {
      const section: TcfdSectionContent = {
        framework: "tcfd",
        sectionNumber,
        disclosureId: input.tcfd?.disclosureId ?? null,
        riskItems: input.tcfd?.riskItems ?? [],
        scenarios: input.tcfd?.scenarios ?? [],
        includeEmissions: ownsEmissions,
        emissions: ownsEmissions ? emissions : null,
        emissionsCrossRef,
      };
      sections.push(section);
    } else if (id === "issb") {
      const tcfdIncluded = included.includes("tcfd");
      const tcfdSection = tcfdIncluded ? sectionNumberFor(included, "tcfd") : null;
      const section: IssbSectionContent = {
        framework: "issb",
        sectionNumber,
        disclosureId: input.issb?.disclosureId ?? null,
        metrics: input.issb?.metrics ?? [],
        includeEmissions: ownsEmissions,
        emissions: ownsEmissions ? emissions : null,
        emissionsCrossRef,
        linkedTcfdCrossRef:
          tcfdSection != null
            ? `See TCFD Section ${tcfdSection} for climate risk and scenario analysis.`
            : null,
      };
      sections.push(section);
    } else if (id === "gri") {
      const section: GriSectionContent = {
        framework: "gri",
        sectionNumber,
        narrative: input.gri?.narrative ?? null,
        materialTopics: input.gri?.materialTopics ?? [],
      };
      sections.push(section);
    }
  }

  const executiveSummary = buildExecutiveSummary({
    organisationName: input.organisationName,
    periodLabel: input.periodLabel,
    reportingYear: input.reportingYear,
    included,
    skipped,
    emissions,
    materialTopicCount: input.gri?.materialTopics.length ?? 0,
    targetCount: input.csrd?.targets.length ?? 0,
    scenarioCount: input.tcfd?.scenarios.length ?? 0,
  });

  return {
    organisationId: input.organisationId,
    organisationName: input.organisationName,
    periodId: input.periodId,
    periodLabel: input.periodLabel,
    reportingYear: input.reportingYear,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    emissionsOwner: owner,
    emissions,
    executiveSummary,
    sections,
    disclaimer: MULTI_FRAMEWORK_DISCLAIMER,
  };
}

/** Filter ISSB answers that merely restate Scope totals (owned elsewhere). */
export function filterIssbMetricsWithoutEmissionsDup(
  metrics: IssbMetricItem[],
): IssbMetricItem[] {
  return metrics.filter((m) => {
    const lower = `${m.id} ${m.label}`.toLowerCase();
    if (lower.includes("emission") || lower.includes("ghg")) {
      // Keep qualitative GHG process answers; drop autofill that restates scopes.
      if (/scope\s*[123]/i.test(m.answer) && /tCO₂e|tco2e/i.test(m.answer)) {
        return false;
      }
    }
    return true;
  });
}

/**
 * Completeness helpers — pure predicates used by the loader and tests.
 */
export function isCsrdSourceComplete(opts: {
  status: string | null | undefined;
  hasSnapshot: boolean;
}): boolean {
  return opts.status === "published" && opts.hasSnapshot;
}

export function isTcfdSourceComplete(opts: {
  status: string | null | undefined;
}): boolean {
  return opts.status === "final";
}

export function isIssbSourceComplete(opts: {
  status: string | null | undefined;
}): boolean {
  return opts.status === "final";
}

export function isGriSourceComplete(opts: {
  materialityStatus: string | null | undefined;
  materialTopicCount: number;
  publishedGriReport?: boolean;
}): boolean {
  if (opts.publishedGriReport) return true;
  return opts.materialityStatus === "final" && opts.materialTopicCount > 0;
}

/** Count how many times Scope totals appear across sections (must be ≤ 1). */
export function countEmissionsBlocksInSections(
  sections: MultiFrameworkSection[],
): number {
  let n = 0;
  for (const s of sections) {
    if (s.framework === "gri") continue;
    if (s.includeEmissions && s.emissions) n += 1;
  }
  return n;
}
