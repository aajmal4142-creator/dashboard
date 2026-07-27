/**
 * Phase 1c Step 3 — Propose mappings for review (E fuel/electricity metrics only).
 *
 * approved is always null. Never invent a dpId.
 * matchBasis must cite something concrete in the source row — not semantic vibes.
 * A gap (empty array) is a correct answer.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const dataDir = path.join(root, "data");

const ESRS_PATH = path.join(dataDir, "esrs-set1-datapoints.json");
const OUT_JSON = path.join(dataDir, "mapping-review.json");
const OUT_MD = path.join(dataDir, "mapping-review.md");

const METRIC_KEYS = [
  "electricity_kwh",
  "diesel_litres",
  "natural_gas_m3",
  "petrol_litres",
  "district_heat_kwh",
  "electricity_renewable_pct",
] as const;

type MetricKey = (typeof METRIC_KEYS)[number];
type Confidence = "strong" | "possible" | "weak";

type EsrsDatapoint = {
  dpId: string;
  name: string | null;
  sourceSheet: string;
  sourceRow: number;
  paragraph: string | null;
  relatedAr: string | null;
  dataType: string | null;
  voluntary: boolean | null;
  phaseInUnder750Employees: string | null;
  phaseInAllUndertakings: string | null;
  conditional: boolean | null;
  conditionalOrAlternative: string | null;
  disclosureRequirement: string | null;
  standard: string | null;
};

type MappingCandidate = {
  metricKey: MetricKey;
  framework: "CSRD_SET1";
  dpId: string;
  dpNameVerbatim: string;
  sourceSheet: string;
  sourceRow: number;
  paragraph: string | null;
  relatedAr: string | null;
  dataType: string | null;
  voluntary: boolean | null;
  phaseInUnder750Employees: string | null;
  phaseInAllUndertakings: string | null;
  conditional: boolean | null;
  matchBasis: string;
  confidence: Confidence;
  approved: null;
};

/** Explicit proposals only — no fuzzy search. */
const PROPOSALS: Record<
  MetricKey,
  Array<{ dpId: string; matchBasis: string; confidence: Confidence }>
> = {
  electricity_kwh: [
    {
      dpId: "E1-5_07",
      confidence: "possible",
      matchBasis:
        'DR E1-5 §37 c ii name includes the words "purchased or acquired electricity" and dataType is energy; caveat: the same DP also bundles heat, steam, and cooling and is renewable-sources only, so it is not an electricity-kWh total.',
    },
    {
      dpId: "E1-5_14",
      confidence: "possible",
      matchBasis:
        'DR E1-5 §38 e name includes "purchased or acquired electricity" with dataType energy; caveat: bundles heat/steam/cooling and covers fossil-sourced purchases only, not total grid kWh.',
    },
  ],
  diesel_litres: [
    {
      dpId: "E1-5_11",
      confidence: "weak",
      matchBasis:
        'DR E1-5 §38 b names "Fuel consumption from crude oil and petroleum products" — diesel sits in that petroleum-products class — but the DP does not say diesel and dataType is energy, not litres.',
    },
  ],
  natural_gas_m3: [
    {
      dpId: "E1-5_12",
      confidence: "possible",
      matchBasis:
        'DR E1-5 §38 c name is exactly "Fuel consumption from natural gas" (same fuel named); dataType is energy, not cubic metres, so a unit conversion would still be required.',
    },
  ],
  petrol_litres: [
    {
      dpId: "E1-5_11",
      confidence: "weak",
      matchBasis:
        'DR E1-5 §38 b names "petroleum products" — petrol is a petroleum product — but the DP does not say petrol and dataType is energy, not litres; same bucket as diesel.',
    },
  ],
  district_heat_kwh: [
    {
      dpId: "E1-5_07",
      confidence: "possible",
      matchBasis:
        'DR E1-5 §37 c ii name lists purchased "heat, steam, and cooling" (district heat is purchased heat) with dataType energy; caveat: bundled with electricity and renewable-only.',
    },
    {
      dpId: "E1-5_14",
      confidence: "possible",
      matchBasis:
        'DR E1-5 §38 e name lists purchased "heat, steam, or cooling" from fossil sources with dataType energy; caveat: bundled with electricity and fossil-only.',
    },
  ],
  electricity_renewable_pct: [
    {
      dpId: "E1-5_09",
      confidence: "weak",
      matchBasis:
        'DR E1-5 AR 34 name is "Percentage of renewable sources in total energy consumption" and dataType is percent (matches a % field), but the denominator is total energy, not electricity alone.',
    },
  ],
};

function assertDpIdsExist(
  proposals: typeof PROPOSALS,
  byId: Map<string, EsrsDatapoint>,
): void {
  const missing: string[] = [];
  for (const metricKey of METRIC_KEYS) {
    for (const p of proposals[metricKey]) {
      if (!byId.has(p.dpId)) missing.push(`${metricKey} → ${p.dpId}`);
    }
  }
  if (missing.length > 0) {
    throw new Error(
      `propose-mappings: dpId not found in esrs-set1-datapoints.json:\n  - ${missing.join("\n  - ")}`,
    );
  }
}

function buildCandidates(
  byId: Map<string, EsrsDatapoint>,
): Record<MetricKey, MappingCandidate[]> {
  const out = {} as Record<MetricKey, MappingCandidate[]>;

  for (const metricKey of METRIC_KEYS) {
    out[metricKey] = PROPOSALS[metricKey].map((p) => {
      const dp = byId.get(p.dpId);
      if (!dp) {
        throw new Error(`Unreachable: missing ${p.dpId}`);
      }
      if (!dp.name) {
        throw new Error(
          `DP ${p.dpId} has null name — cannot emit verbatim dpNameVerbatim`,
        );
      }
      const candidate: MappingCandidate = {
        metricKey,
        framework: "CSRD_SET1",
        dpId: dp.dpId,
        dpNameVerbatim: dp.name,
        sourceSheet: dp.sourceSheet,
        sourceRow: dp.sourceRow,
        paragraph: dp.paragraph,
        relatedAr: dp.relatedAr,
        dataType: dp.dataType,
        voluntary: dp.voluntary,
        phaseInUnder750Employees: dp.phaseInUnder750Employees,
        phaseInAllUndertakings: dp.phaseInAllUndertakings,
        conditional: dp.conditional,
        matchBasis: p.matchBasis,
        confidence: p.confidence,
        approved: null,
      };
      return candidate;
    });
  }

  return out;
}

function fmt(value: string | boolean | number | null | undefined): string {
  if (value === null || value === undefined) return "`null`";
  if (typeof value === "boolean") return value ? "`true`" : "`false`";
  return `\`${String(value).replace(/`/g, "'")}\``;
}

function toMarkdown(
  byMetric: Record<MetricKey, MappingCandidate[]>,
  extractedAt: string,
): string {
  const lines: string[] = [];
  lines.push("# Mapping review — E energy metrics (CSRD Set 1)");
  lines.push("");
  lines.push(`Extracted at: ${extractedAt}`);
  lines.push("");
  lines.push(
    "Human review only. Every `approved` field is `null`. Do not treat this file as a seed.",
  );
  lines.push("");
  lines.push(
    "Scope: `electricity_kwh`, `diesel_litres`, `natural_gas_m3`, `petrol_litres`, `district_heat_kwh`, `electricity_renewable_pct`.",
  );
  lines.push("");
  lines.push("BRSR / VSME not proposed — source files not in `/docs`.");
  lines.push("");

  for (const metricKey of METRIC_KEYS) {
    const candidates = byMetric[metricKey];
    lines.push(`## \`${metricKey}\``);
    lines.push("");
    if (candidates.length === 0) {
      lines.push(
        "**No candidates.** Empty array — treated as a coverage gap, not an error.",
      );
      lines.push("");
      continue;
    }

    lines.push(`${candidates.length} candidate(s). All \`approved: null\`.`);
    lines.push("");

    for (const [i, c] of candidates.entries()) {
      lines.push(`### ${i + 1}. \`${c.dpId}\` (${c.confidence})`);
      lines.push("");
      lines.push(`- **Name (verbatim):** “${c.dpNameVerbatim}”`);
      lines.push(`- **sourceSheet / sourceRow:** ${c.sourceSheet} / ${c.sourceRow}`);
      lines.push(`- **paragraph:** ${fmt(c.paragraph)}`);
      lines.push(`- **relatedAr:** ${fmt(c.relatedAr)}`);
      lines.push(`- **dataType:** ${fmt(c.dataType)}`);
      lines.push(`- **voluntary:** ${fmt(c.voluntary)}`);
      lines.push(`- **phaseInUnder750Employees:** ${fmt(c.phaseInUnder750Employees)}`);
      lines.push(`- **phaseInAllUndertakings:** ${fmt(c.phaseInAllUndertakings)}`);
      lines.push(`- **conditional:** ${fmt(c.conditional)}`);
      lines.push(`- **framework:** \`${c.framework}\``);
      lines.push(`- **matchBasis:** ${c.matchBasis}`);
      lines.push(`- **approved:** \`null\``);
      lines.push("");
    }
  }

  lines.push("---");
  lines.push("");
  lines.push("## Gaps summary");
  lines.push("");
  for (const metricKey of METRIC_KEYS) {
    const n = byMetric[metricKey].length;
    lines.push(
      n === 0
        ? `- \`${metricKey}\`: **no candidates**`
        : `- \`${metricKey}\`: ${n} candidate(s), none approved`,
    );
  }
  lines.push("");

  return lines.join("\n");
}

function main() {
  const raw = JSON.parse(fs.readFileSync(ESRS_PATH, "utf8")) as {
    datapoints: EsrsDatapoint[];
  };
  const byId = new Map(raw.datapoints.map((d) => [d.dpId, d]));

  assertDpIdsExist(PROPOSALS, byId);
  const byMetric = buildCandidates(byId);

  // Re-assert every emitted dpId
  for (const metricKey of METRIC_KEYS) {
    for (const c of byMetric[metricKey]) {
      if (!byId.has(c.dpId)) {
        throw new Error(`Emitted candidate dpId missing from source: ${c.dpId}`);
      }
      if (c.approved !== null) {
        throw new Error(`approved must be null, got ${String(c.approved)} on ${c.dpId}`);
      }
    }
  }

  const extractedAt = new Date().toISOString();
  const payload = {
    extractedAt,
    framework: "CSRD_SET1" as const,
    source: "data/esrs-set1-datapoints.json",
    metricsInScope: [...METRIC_KEYS],
    note: "Human review file. approved is null on every row. Not a seed.",
    byMetric,
  };

  fs.writeFileSync(OUT_JSON, JSON.stringify(payload, null, 2));
  fs.writeFileSync(OUT_MD, toMarkdown(byMetric, extractedAt));

  console.log(`Wrote ${OUT_JSON}`);
  console.log(`Wrote ${OUT_MD}`);
  for (const metricKey of METRIC_KEYS) {
    console.log(`  ${metricKey}: ${byMetric[metricKey].length} candidate(s)`);
  }
  console.log("\n=== STOP — Step 3 (E metrics only) complete. Not seeding. ===");
}

main();
