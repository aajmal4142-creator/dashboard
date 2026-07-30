import type { Payload } from "payload";

import { resolveOrgBaselineByScope } from "@/lib/analytics/resolveOrgBaseline";
import { EMISSIONS_STANDARD_LABELS, resolveOrgEmissionsStandard } from "@/lib/factors";

import { TCFD_QUESTIONS } from "./questions";
import type { TcfdAnswersMap, TcfdEmissionsSnapshot, TcfdScenarioSummary } from "./types";

function periodLabel(doc: { label?: string | null; startDate?: string | null }): string {
  if (doc.label) return String(doc.label);
  if (doc.startDate) return String(doc.startDate).slice(0, 10);
  return "Period";
}

/**
 * Resolve Scope 1/2/3 for a disclosure year via registry factors (never hardcoded).
 */
export async function loadTcfdEmissions(
  payload: Payload,
  organisationId: string,
  reportingYear: number,
): Promise<TcfdEmissionsSnapshot> {
  const org = await payload.findByID({
    collection: "organisations",
    id: organisationId,
    depth: 0,
    overrideAccess: true,
  });
  const standard = resolveOrgEmissionsStandard(org);
  const resolved = await resolveOrgBaselineByScope(
    payload,
    organisationId,
    reportingYear,
  );
  const total =
    resolved.baseline.scope1 + resolved.baseline.scope2 + resolved.baseline.scope3;

  let label: string | null = null;
  if (resolved.periodId) {
    try {
      const period = await payload.findByID({
        collection: "reporting-periods",
        id: resolved.periodId,
        depth: 0,
        overrideAccess: true,
      });
      label = periodLabel(period);
    } catch {
      label = null;
    }
  }

  return {
    scope1: resolved.baseline.scope1,
    scope2: resolved.baseline.scope2,
    scope3: resolved.baseline.scope3,
    total,
    dataQualityPct: resolved.quality === "calculated" ? 100 : 0,
    periodId: resolved.periodId,
    periodLabel: label,
    quality: resolved.quality,
    emissionsStandard: EMISSIONS_STANDARD_LABELS[standard],
    capturedAt: new Date().toISOString(),
  };
}

export async function loadOrgScenarios(
  payload: Payload,
  organisationId: string,
): Promise<TcfdScenarioSummary[]> {
  const result = await payload.find({
    collection: "scenarios",
    where: { organisation: { equals: organisationId } },
    sort: "-updatedAt",
    limit: 20,
    overrideAccess: true,
  });

  return result.docs.map((s) => ({
    id: String(s.id),
    name: String(s.name),
    type: String(s.type),
    baselineYear: Number(s.baselineYear),
    targetYear: Number(s.targetYear),
    reductionPercent: Number(s.reductionPercent ?? 0),
    category: s.category ? String(s.category) : null,
  }));
}

function formatEmissionsText(snap: TcfdEmissionsSnapshot): string {
  if (snap.quality === "missing") {
    return `No calculable emissions for ${snap.periodLabel ?? "this year"}. Treat Scope 1/2/3 as data gaps until activity data and registry factors are available.`;
  }
  const std = snap.emissionsStandard ? ` (${snap.emissionsStandard})` : "";
  return [
    `Scope 1: ${snap.scope1.toFixed(2)} tCO₂e`,
    `Scope 2: ${snap.scope2.toFixed(2)} tCO₂e`,
    `Scope 3: ${snap.scope3.toFixed(2)} tCO₂e`,
    `Total: ${snap.total.toFixed(2)} tCO₂e${std}.`,
    snap.periodLabel ? `Period: ${snap.periodLabel}.` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function formatScenariosText(scenarios: TcfdScenarioSummary[]): string {
  if (scenarios.length === 0) {
    return "No ClearESG scenarios linked yet. Create reduction scenarios under Analytics → Scenarios, then re-run autofill.";
  }
  const lines = scenarios.slice(0, 5).map((s) => {
    const cat = s.category ? `, ${s.category}` : "";
    return `• ${s.name} (${s.type}${cat}): ${s.reductionPercent}% reduction ${s.baselineYear}→${s.targetYear}`;
  });
  return [
    "Strategy resilience draws on the following ClearESG scenarios:",
    ...lines,
    "Management should confirm alignment with 1.5°C / 2°C pathways and disclose residual physical and transition risk.",
  ].join("\n");
}

function formatQualityText(snap: TcfdEmissionsSnapshot): string {
  if (snap.quality === "missing") {
    return "Emissions metrics are marked missing — no activity data or period matched the disclosure year. Prefer measured invoices/meters before finalising.";
  }
  return `Emissions auto-populated from ClearESG activity × registry factors (${snap.emissionsStandard ?? "org standard"}). Data quality for matched period: calculated. Residual factor-year uncertainty remains.`;
}

/**
 * Merge autofill into answers. Does not overwrite non-empty manual answers unless force=true.
 */
export function applyTcfdAutofill(opts: {
  existing: TcfdAnswersMap;
  emissions: TcfdEmissionsSnapshot;
  scenarios: TcfdScenarioSummary[];
  force?: boolean;
}): TcfdAnswersMap {
  const now = new Date().toISOString();
  const next: TcfdAnswersMap = { ...opts.existing };

  for (const q of TCFD_QUESTIONS) {
    if (!q.autofillKey) continue;
    const current = next[q.id];
    const hasManual =
      current &&
      current.text.trim().length > 0 &&
      current.source === "manual" &&
      !current.autoFilled;
    if (hasManual && !opts.force) continue;

    let text = "";
    let source: "clearesg" | "scenario" = "clearesg";
    if (q.autofillKey === "emissions") {
      text = formatEmissionsText(opts.emissions);
      source = "clearesg";
    } else if (q.autofillKey === "scenarios") {
      text = formatScenariosText(opts.scenarios);
      source = "scenario";
    } else if (q.autofillKey === "quality") {
      text = formatQualityText(opts.emissions);
      source = "clearesg";
    }

    next[q.id] = {
      text,
      source,
      autoFilled: true,
      updatedAt: now,
    };
  }

  return next;
}
