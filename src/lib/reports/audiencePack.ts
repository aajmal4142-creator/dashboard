/**
 * Pure audience report-pack manifest (F36).
 * Distinct from assurance evidence packs (F17, kind assurance_evidence). No I/O. No AI.
 */

export const AUDIENCE_PACK_KIND = "audience_pack" as const;

export type AudienceKind = "board_investor" | "ops" | "auditor";

export type AudiencePackKpi = {
  key: string;
  label: string;
  value: number | null;
  unit: string;
  /** Human-readable formatted value for PDF/CSV (numbers stay numeric above). */
  display: string;
};

export type AudiencePackNarrativePlaceholder = {
  id: string;
  title: string;
  /** Prompt for a human author — never AI-filled. */
  prompt: string;
  /** Empty body reserved for board narrative paste-in. */
  body: string;
};

export type AudiencePackEmissions = {
  scope1Tco2e: number;
  scope2LocationTco2e: number;
  scope2MarketTco2e: number | null;
  scope3Tco2e: number;
  totalTco2e: number;
  dataQualityPct: number;
};

export type AudiencePackScores = {
  overall: number;
  e: number;
  s: number;
  g: number;
};

export type AudiencePackYoy = {
  previousPeriodLabel: string;
  previousTotalTco2e: number;
  changePct: number | null;
};

export type AudiencePackManifest = {
  kind: typeof AUDIENCE_PACK_KIND;
  generatedAt: string;
  organisationId: string;
  organisationName: string;
  periodId: string;
  periodLabel: string;
  framework: string;
  versionLabel: string;
  audience: AudienceKind;
  reportId: string | null;
  disclaimer: string;
  band: string;
  scores: AudiencePackScores;
  kpis: AudiencePackKpi[];
  narrativePlaceholders: AudiencePackNarrativePlaceholder[];
  emissions: AudiencePackEmissions;
  highlights: string[];
  yoy: AudiencePackYoy | null;
  materialityNarrative: string | null;
  gapCount: number;
};

export type BuildAudiencePackManifestInput = {
  organisationId: string;
  organisationName: string;
  periodId: string;
  periodLabel: string;
  framework: string;
  versionLabel: string;
  generatedAt: string;
  disclaimer: string;
  reportId?: string | null;
  audience?: AudienceKind;
  band: string;
  scores: AudiencePackScores;
  emissions: {
    scope1: number;
    scope2: number;
    scope2LocationBased?: number;
    scope2MarketBased?: number | null;
    scope3: number;
    total: number;
    dataQualityPct: number;
  };
  yoy?: {
    previousPeriodLabel: string;
    previousTotal: number;
    changePct: number | null;
  } | null;
  materialityNarrative?: string | null;
  gapCount?: number;
  /** Optional pre-built highlight lines; otherwise derived from emissions/scores. */
  highlights?: string[];
  /** Optional ops/auditor gap lines from snapshot.dataGaps */
  gapSummaries?: string[];
};

const BOARD_NARRATIVES: AudiencePackNarrativePlaceholder[] = [
  {
    id: "strategic_context",
    title: "Strategic context",
    prompt:
      "Summarise why this period matters for the board or investors (strategy, regulation, capital allocation).",
    body: "",
  },
  {
    id: "performance_vs_prior",
    title: "Performance versus prior period",
    prompt:
      "Explain drivers of emissions and score movement versus the prior period. Cite management actions, not estimates alone.",
    body: "",
  },
  {
    id: "material_risks",
    title: "Material risks and opportunities",
    prompt:
      "List the highest-priority climate and ESG risks/opportunities for capital allocation this period.",
    body: "",
  },
  {
    id: "outlook",
    title: "Outlook and next-period focus",
    prompt:
      "State management priorities for the next reporting period (data quality, abatement, assurance readiness).",
    body: "",
  },
];

const OPS_NARRATIVES: AudiencePackNarrativePlaceholder[] = [
  {
    id: "data_ops",
    title: "Data operations focus",
    prompt: "List metric owners and next actions for open data gaps this period.",
    body: "",
  },
  {
    id: "quality_plan",
    title: "Quality uplift plan",
    prompt:
      "Which estimated metrics move to measured next period, and which evidence packs are outstanding?",
    body: "",
  },
];

const AUDITOR_NARRATIVES: AudiencePackNarrativePlaceholder[] = [
  {
    id: "assurance_scope",
    title: "Assurance scope notes",
    prompt:
      "Confirm limited vs reasonable pathway, materiality memo status, and evidence pack ZIP reference.",
    body: "",
  },
  {
    id: "exceptions",
    title: "Exceptions and restatements",
    prompt: "Record known exceptions, restatements, and unresolved high-severity gaps.",
    body: "",
  },
];

function narrativesFor(audience: AudienceKind): AudiencePackNarrativePlaceholder[] {
  if (audience === "ops") return OPS_NARRATIVES;
  if (audience === "auditor") return AUDITOR_NARRATIVES;
  return BOARD_NARRATIVES;
}

function formatTco2eDisplay(value: number): string {
  if (!Number.isFinite(value)) return "—";
  if (value === 0) return "0.00";
  const abs = Math.abs(value);
  if (abs < 0.001) return value.toFixed(6);
  if (abs < 0.01) return value.toFixed(4);
  if (abs < 1) return value.toFixed(3);
  if (abs < 100) return value.toFixed(2);
  return value.toLocaleString("en-GB", { maximumFractionDigits: 1 });
}

function formatPctDisplay(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return `${Math.round(value)}%`;
}

function formatScoreDisplay(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return String(Math.round(value));
}

function defaultHighlights(
  input: BuildAudiencePackManifestInput,
  audience: AudienceKind,
): string[] {
  const gaps = input.gapCount ?? 0;
  if (audience === "ops") {
    const lines = [
      `Data quality ${formatPctDisplay(input.emissions.dataQualityPct)} for ${input.periodLabel}.`,
      `${gaps} data gap(s) open on this snapshot.`,
      `Total inventory ${formatTco2eDisplay(input.emissions.total)} tCO₂e (ops view — focus on gaps, not board narrative).`,
    ];
    for (const g of (input.gapSummaries ?? []).slice(0, 8)) {
      lines.push(g);
    }
    return lines;
  }
  if (audience === "auditor") {
    return [
      `Auditor index for ${input.periodLabel} (${input.organisationName}).`,
      `Report ${input.reportId ?? "—"} · framework ${input.framework} · ${input.versionLabel}.`,
      `Data quality ${formatPctDisplay(input.emissions.dataQualityPct)} · ${gaps} gap(s).`,
      "Download the assurance evidence ZIP for lineage, factors, evidence links, and pathway checklist.",
      "This audience pack is an index only — not an assurance opinion.",
    ];
  }
  const lines: string[] = [
    `Total GHG emissions ${formatTco2eDisplay(input.emissions.total)} tCO₂e for ${input.periodLabel}.`,
    `Overall score ${formatScoreDisplay(input.scores.overall)} of 100 (${input.band}).`,
    `Data quality ${formatPctDisplay(input.emissions.dataQualityPct)}.`,
  ];
  const yoy = input.yoy;
  if (yoy) {
    if (yoy.changePct === null) {
      lines.push(
        `Prior period (${yoy.previousPeriodLabel}): ${formatTco2eDisplay(yoy.previousTotal)} tCO₂e. Change not defined.`,
      );
    } else {
      const sign = yoy.changePct > 0 ? "+" : "";
      lines.push(
        `YoY vs ${yoy.previousPeriodLabel}: ${sign}${yoy.changePct.toFixed(1)}%.`,
      );
    }
  }
  if (gaps > 0) {
    lines.push(`${gaps} data gap(s) flagged on this snapshot.`);
  }
  return lines;
}

function kpisFor(
  input: BuildAudiencePackManifestInput,
  audience: AudienceKind,
  scope2Location: number,
  scope2Market: number | null,
): AudiencePackKpi[] {
  const quality: AudiencePackKpi = {
    key: "data_quality_pct",
    label: "Data quality",
    value: input.emissions.dataQualityPct,
    unit: "%",
    display: formatPctDisplay(input.emissions.dataQualityPct),
  };
  const gapKpi: AudiencePackKpi = {
    key: "gap_count",
    label: "Open data gaps",
    value: input.gapCount ?? 0,
    unit: "gaps",
    display: String(input.gapCount ?? 0),
  };

  if (audience === "ops") {
    return [
      quality,
      gapKpi,
      {
        key: "total_tco2e",
        label: "Total emissions",
        value: input.emissions.total,
        unit: "tCO₂e",
        display: formatTco2eDisplay(input.emissions.total),
      },
    ];
  }

  if (audience === "auditor") {
    return [
      quality,
      gapKpi,
      {
        key: "overall_score",
        label: "Overall ESG score",
        value: input.scores.overall,
        unit: "/100",
        display: formatScoreDisplay(input.scores.overall),
      },
      {
        key: "total_tco2e",
        label: "Total emissions",
        value: input.emissions.total,
        unit: "tCO₂e",
        display: formatTco2eDisplay(input.emissions.total),
      },
    ];
  }

  return [
    {
      key: "total_tco2e",
      label: "Total emissions",
      value: input.emissions.total,
      unit: "tCO₂e",
      display: formatTco2eDisplay(input.emissions.total),
    },
    {
      key: "scope1_tco2e",
      label: "Scope 1",
      value: input.emissions.scope1,
      unit: "tCO₂e",
      display: formatTco2eDisplay(input.emissions.scope1),
    },
    {
      key: "scope2_location_tco2e",
      label: "Scope 2 (location)",
      value: scope2Location,
      unit: "tCO₂e",
      display: formatTco2eDisplay(scope2Location),
    },
    {
      key: "scope2_market_tco2e",
      label: "Scope 2 (market)",
      value: scope2Market,
      unit: "tCO₂e",
      display: scope2Market === null ? "—" : formatTco2eDisplay(scope2Market),
    },
    {
      key: "scope3_tco2e",
      label: "Scope 3",
      value: input.emissions.scope3,
      unit: "tCO₂e",
      display: formatTco2eDisplay(input.emissions.scope3),
    },
    {
      key: "overall_score",
      label: "Overall ESG score",
      value: input.scores.overall,
      unit: "/100",
      display: formatScoreDisplay(input.scores.overall),
    },
    quality,
  ];
}

export function isAudienceKind(value: unknown): value is AudienceKind {
  return value === "board_investor" || value === "ops" || value === "auditor";
}

/** Build a deterministic audience-pack manifest. Pure. */
export function buildAudiencePackManifest(
  input: BuildAudiencePackManifestInput,
): AudiencePackManifest {
  const audience = input.audience ?? "board_investor";
  const scope2Location = input.emissions.scope2LocationBased ?? input.emissions.scope2;
  const scope2Market =
    input.emissions.scope2MarketBased === undefined
      ? null
      : input.emissions.scope2MarketBased;

  const yoy = input.yoy
    ? {
        previousPeriodLabel: input.yoy.previousPeriodLabel,
        previousTotalTco2e: input.yoy.previousTotal,
        changePct: input.yoy.changePct,
      }
    : null;

  return {
    kind: AUDIENCE_PACK_KIND,
    generatedAt: input.generatedAt,
    organisationId: input.organisationId,
    organisationName: input.organisationName,
    periodId: input.periodId,
    periodLabel: input.periodLabel,
    framework: input.framework,
    versionLabel: input.versionLabel,
    audience,
    reportId: input.reportId ?? null,
    disclaimer: input.disclaimer,
    band: input.band,
    scores: { ...input.scores },
    kpis: kpisFor(input, audience, scope2Location, scope2Market),
    narrativePlaceholders: narrativesFor(audience).map((n) => ({ ...n })),
    emissions: {
      scope1Tco2e: input.emissions.scope1,
      scope2LocationTco2e: scope2Location,
      scope2MarketTco2e: scope2Market,
      scope3Tco2e: input.emissions.scope3,
      totalTco2e: input.emissions.total,
      dataQualityPct: input.emissions.dataQualityPct,
    },
    highlights:
      input.highlights && input.highlights.length > 0 && audience === "board_investor"
        ? [...input.highlights]
        : defaultHighlights(input, audience),
    yoy,
    materialityNarrative:
      audience === "board_investor" ? (input.materialityNarrative ?? null) : null,
    gapCount: input.gapCount ?? 0,
  };
}

function csvEscape(v: string): string {
  if (v.includes(",") || v.includes('"') || v.includes("\n")) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

/** Flatten audience pack to CSV sections for the ZIP companion file. */
export function audiencePackToCsv(manifest: AudiencePackManifest): string {
  const lines: string[] = [
    "section,key,value",
    `meta,kind,${manifest.kind}`,
    `meta,audience,${manifest.audience}`,
    `meta,organisation,${csvEscape(manifest.organisationName)}`,
    `meta,organisationId,${csvEscape(manifest.organisationId)}`,
    `meta,period,${csvEscape(manifest.periodLabel)}`,
    `meta,periodId,${csvEscape(manifest.periodId)}`,
    `meta,framework,${csvEscape(manifest.framework)}`,
    `meta,version,${csvEscape(manifest.versionLabel)}`,
    `meta,reportId,${csvEscape(manifest.reportId ?? "")}`,
    `meta,band,${csvEscape(manifest.band)}`,
    `meta,generatedAt,${csvEscape(manifest.generatedAt)}`,
    `meta,gapCount,${manifest.gapCount}`,
    `scores,overall,${manifest.scores.overall}`,
    `scores,e,${manifest.scores.e}`,
    `scores,s,${manifest.scores.s}`,
    `scores,g,${manifest.scores.g}`,
    `emissions,scope1_tco2e,${manifest.emissions.scope1Tco2e}`,
    `emissions,scope2_location_tco2e,${manifest.emissions.scope2LocationTco2e}`,
    `emissions,scope2_market_tco2e,${manifest.emissions.scope2MarketTco2e ?? ""}`,
    `emissions,scope3_tco2e,${manifest.emissions.scope3Tco2e}`,
    `emissions,total_tco2e,${manifest.emissions.totalTco2e}`,
    `emissions,dataQualityPct,${manifest.emissions.dataQualityPct}`,
  ];

  if (manifest.yoy) {
    lines.push(
      `yoy,previousPeriod,${csvEscape(manifest.yoy.previousPeriodLabel)}`,
      `yoy,previousTotal_tco2e,${manifest.yoy.previousTotalTco2e}`,
      `yoy,changePct,${manifest.yoy.changePct ?? ""}`,
    );
  }

  for (const k of manifest.kpis) {
    lines.push(
      `kpi,${csvEscape(k.key)},${csvEscape(`${k.display} ${k.unit}; label=${k.label}`)}`,
    );
  }
  for (const h of manifest.highlights) {
    lines.push(`highlight,,${csvEscape(h)}`);
  }
  for (const n of manifest.narrativePlaceholders) {
    lines.push(`narrative,${csvEscape(n.id)},${csvEscape(`${n.title}: ${n.prompt}`)}`);
  }
  if (manifest.materialityNarrative) {
    lines.push(`materiality,narrative,${csvEscape(manifest.materialityNarrative)}`);
  }

  return lines.join("\n");
}

export function audiencePackBasename(manifest: AudiencePackManifest): string {
  const org = manifest.organisationName
    .replace(/[^\w.-]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  const period = manifest.periodLabel
    .replace(/[^\w.-]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24);
  const audienceSlug =
    manifest.audience === "board_investor"
      ? "board"
      : manifest.audience === "ops"
        ? "ops"
        : "auditor";
  return `clearesg-${audienceSlug}-pack-${org || "org"}-${period || "period"}`;
}
