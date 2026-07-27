import type { CalcResult } from "@/lib/calc";
import type { MatrixPoint } from "@/lib/materiality";

export const REPORT_DISCLAIMER =
  "ClearESG is not an assurance provider. This report summarises management-reported data and calculated estimates. It is not an audit opinion.";

export type ReportSnapshot = {
  organisationName: string;
  periodLabel: string;
  framework: string;
  version: number;
  publishedAt: string;
  scores: CalcResult["scores"];
  emissions: {
    scope1: number;
    scope2: number;
    scope3: number;
    total: number;
    dataQualityPct: number;
    /** Share of Scope 3 from supplier primary data (0–100). */
    scope3PrimarySharePct?: number;
    scope3PrimaryTco2e?: number;
    scope3EstimateTco2e?: number;
  };
  band: CalcResult["band"];
  breakdown: CalcResult["breakdown"];
  factorsUsed: CalcResult["factorsUsed"];
  materiality: {
    narrative: string | null;
    points: MatrixPoint[];
  };
  evidenceIndex: Array<{ filename: string; sha256: string; metricKey?: string }>;
  disclaimer: string;
};

export function diffSnapshots(
  a: ReportSnapshot,
  b: ReportSnapshot,
): Array<{ path: string; from: string; to: string }> {
  const diffs: Array<{ path: string; from: string; to: string }> = [];
  const keys: Array<keyof ReportSnapshot["scores"]> = ["overall", "e", "s", "g"];
  for (const k of keys) {
    if (a.scores[k] !== b.scores[k]) {
      diffs.push({
        path: `scores.${k}`,
        from: String(a.scores[k]),
        to: String(b.scores[k]),
      });
    }
  }
  for (const scope of ["scope1", "scope2", "scope3", "total"] as const) {
    if (a.emissions[scope] !== b.emissions[scope]) {
      diffs.push({
        path: `emissions.${scope}`,
        from: String(a.emissions[scope]),
        to: String(b.emissions[scope]),
      });
    }
  }
  if (a.emissions.dataQualityPct !== b.emissions.dataQualityPct) {
    diffs.push({
      path: "emissions.dataQualityPct",
      from: String(a.emissions.dataQualityPct),
      to: String(b.emissions.dataQualityPct),
    });
  }

  // Factors — by factorId
  const aFactors = new Map(a.factorsUsed.map((f) => [f.factorId, f]));
  const bFactors = new Map(b.factorsUsed.map((f) => [f.factorId, f]));
  for (const id of new Set([...aFactors.keys(), ...bFactors.keys()])) {
    const fa = aFactors.get(id);
    const fb = bFactors.get(id);
    if (!fa && fb) {
      diffs.push({ path: `factors.${id}`, from: "", to: `${fb.key}@${fb.year}` });
    } else if (fa && !fb) {
      diffs.push({ path: `factors.${id}`, from: `${fa.key}@${fa.year}`, to: "" });
    } else if (fa && fb && (fa.value !== fb.value || fa.year !== fb.year)) {
      diffs.push({
        path: `factors.${id}`,
        from: `${fa.value}/${fa.year}`,
        to: `${fb.value}/${fb.year}`,
      });
    }
  }

  // Evidence index — by sha256
  const aEv = new Map(a.evidenceIndex.map((e) => [e.sha256, e]));
  const bEv = new Map(b.evidenceIndex.map((e) => [e.sha256, e]));
  for (const sha of new Set([...aEv.keys(), ...bEv.keys()])) {
    const ea = aEv.get(sha);
    const eb = bEv.get(sha);
    if (!ea && eb) {
      diffs.push({ path: `evidence.${sha.slice(0, 12)}`, from: "", to: eb.filename });
    } else if (ea && !eb) {
      diffs.push({ path: `evidence.${sha.slice(0, 12)}`, from: ea.filename, to: "" });
    }
  }

  // Materiality narrative
  if ((a.materiality.narrative ?? "") !== (b.materiality.narrative ?? "")) {
    diffs.push({
      path: "materiality.narrative",
      from: a.materiality.narrative ?? "",
      to: b.materiality.narrative ?? "",
    });
  }

  return diffs;
}

export function snapshotToCsv(snapshot: ReportSnapshot): string {
  const lines = [
    "section,key,value",
    `meta,organisation,${csv(snapshot.organisationName)}`,
    `meta,period,${csv(snapshot.periodLabel)}`,
    `meta,framework,${csv(snapshot.framework)}`,
    `meta,version,${snapshot.version}`,
    `scores,overall,${snapshot.scores.overall}`,
    `scores,e,${snapshot.scores.e}`,
    `scores,s,${snapshot.scores.s}`,
    `scores,g,${snapshot.scores.g}`,
    `emissions,scope1,${snapshot.emissions.scope1}`,
    `emissions,scope2,${snapshot.emissions.scope2}`,
    `emissions,scope3,${snapshot.emissions.scope3}`,
    `emissions,total,${snapshot.emissions.total}`,
    `emissions,dataQualityPct,${snapshot.emissions.dataQualityPct}`,
  ];
  for (const p of snapshot.materiality.points) {
    lines.push(
      `materiality,${p.esrsTopic},${p.material ? "material" : "below"};impact=${p.impactScore};financial=${p.financialScore}`,
    );
  }
  return lines.join("\n");
}

function csv(v: string): string {
  if (v.includes(",") || v.includes('"')) return `"${v.replace(/"/g, '""')}"`;
  return v;
}
