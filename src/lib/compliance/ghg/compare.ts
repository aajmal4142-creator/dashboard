/**
 * Pure helpers for base-year inventory restatement comparison + disclosure notes.
 * Zero I/O. No Next/Payload imports.
 */

import type {
  BaseYearInventoryComparison,
  DisclosureNoteInput,
  InventoryQuality,
  InventorySnapshot,
  RestatementReason,
  ScopeDelta,
} from "./types";

const REASON_LABELS: Record<RestatementReason, string> = {
  acquisition: "acquisition",
  divestiture: "divestiture",
  merger: "merger",
  methodology_change: "methodology change",
  boundary_change: "organisational / operational boundary change",
  outsourcing_insourcing: "outsourcing or insourcing",
  other: "other structural change",
};

function finiteOrNull(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (!Number.isFinite(value)) return null;
  return value;
}

/**
 * Normalise a snapshot: quality is measured only when all three scopes are finite.
 * Does not invent zeros for missing scopes.
 */
export function normaliseInventorySnapshot(
  input: Partial<InventorySnapshot> | null | undefined,
): InventorySnapshot {
  const scope1 = finiteOrNull(input?.scope1 ?? null);
  const scope2 = finiteOrNull(input?.scope2 ?? null);
  const scope3 = finiteOrNull(input?.scope3 ?? null);
  const allPresent = scope1 !== null && scope2 !== null && scope3 !== null;
  const quality: InventoryQuality = allPresent ? "measured" : "missing";
  return {
    scope1,
    scope2,
    scope3,
    quality,
    source: input?.source ?? null,
    capturedAt: input?.capturedAt ?? null,
  };
}

export function inventoryTotal(snapshot: InventorySnapshot): number | null {
  if (snapshot.quality !== "measured") return null;
  if (snapshot.scope1 === null || snapshot.scope2 === null || snapshot.scope3 === null) {
    return null;
  }
  return snapshot.scope1 + snapshot.scope2 + snapshot.scope3;
}

function scopeDelta(prior: number | null, restated: number | null): ScopeDelta {
  if (prior === null || restated === null) {
    return { prior, restated, absolute: null, relative: null };
  }
  const absolute = restated - prior;
  const relative = prior === 0 ? null : absolute / prior;
  return { prior, restated, absolute, relative };
}

/**
 * Compare prior base-year inventory vs restated totals when both snapshots
 * are available. Missing either side → quality "missing", deltas null.
 * Never silently treats missing scopes as zero for comparison.
 */
export function compareBaseYearInventories(
  priorInput: Partial<InventorySnapshot> | null | undefined,
  restatedInput: Partial<InventorySnapshot> | null | undefined,
): BaseYearInventoryComparison {
  const prior = normaliseInventorySnapshot(priorInput);
  const restated = normaliseInventorySnapshot(restatedInput);

  const priorTotal = inventoryTotal(prior);
  const restatedTotal = inventoryTotal(restated);

  const scope1 = scopeDelta(prior.scope1, restated.scope1);
  const scope2 = scopeDelta(prior.scope2, restated.scope2);
  const scope3 = scopeDelta(prior.scope3, restated.scope3);
  const total = scopeDelta(priorTotal, restatedTotal);

  if (prior.quality === "missing" && restated.quality === "missing") {
    return {
      scope1,
      scope2,
      scope3,
      total,
      quality: "missing",
      message:
        "Prior and restated base-year inventories are both incomplete. Enter measured scope totals before comparing.",
    };
  }

  if (prior.quality === "missing") {
    return {
      scope1,
      scope2,
      scope3,
      total,
      quality: "missing",
      message:
        "Prior base-year inventory is incomplete. Comparison deltas are unavailable until all scopes are present.",
    };
  }

  if (restated.quality === "missing") {
    return {
      scope1,
      scope2,
      scope3,
      total,
      quality: "missing",
      message:
        "Restated base-year inventory is incomplete. Comparison deltas are unavailable until all scopes are present.",
    };
  }

  return {
    scope1,
    scope2,
    scope3,
    total,
    quality: "measured",
    message: null,
  };
}

function formatTco2e(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "not available";
  return `${value.toLocaleString("en-IN", {
    maximumFractionDigits: 3,
    minimumFractionDigits: 0,
  })} tCO₂e`;
}

function formatPct(relative: number | null): string {
  if (relative === null || !Number.isFinite(relative)) return "n/a";
  return `${(relative * 100).toLocaleString("en-IN", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
    signDisplay: "exceptZero",
  })}%`;
}

/**
 * Build a disclosure-package note for GHG Protocol restatement reporting.
 */
export function buildDisclosureNote(input: DisclosureNoteInput): string {
  const reasonLabel = REASON_LABELS[input.reason];
  const lines: string[] = [
    "Base-year restatement disclosure note",
    "────────────────────────────────────",
    `Organisation: ${input.organisationName}`,
    `Base year period: ${input.baseYearPeriodLabel}`,
    `Effective period of structural change: ${input.effectivePeriodLabel}`,
    `Reason: ${reasonLabel}`,
    "",
    "Narrative",
    input.reasonDetail.trim(),
    "",
    "Methodology",
    input.methodologyNote.trim(),
  ];

  if (input.comparison && input.comparison.quality === "measured") {
    const c = input.comparison;
    lines.push(
      "",
      "Inventory comparison (prior → restated)",
      `Scope 1: ${formatTco2e(c.scope1.prior)} → ${formatTco2e(c.scope1.restated)} (Δ ${formatTco2e(c.scope1.absolute)}, ${formatPct(c.scope1.relative)})`,
      `Scope 2: ${formatTco2e(c.scope2.prior)} → ${formatTco2e(c.scope2.restated)} (Δ ${formatTco2e(c.scope2.absolute)}, ${formatPct(c.scope2.relative)})`,
      `Scope 3: ${formatTco2e(c.scope3.prior)} → ${formatTco2e(c.scope3.restated)} (Δ ${formatTco2e(c.scope3.absolute)}, ${formatPct(c.scope3.relative)})`,
      `Total:   ${formatTco2e(c.total.prior)} → ${formatTco2e(c.total.restated)} (Δ ${formatTco2e(c.total.absolute)}, ${formatPct(c.total.relative)})`,
    );
  } else if (input.comparison?.message) {
    lines.push("", "Inventory comparison", input.comparison.message);
  } else {
    lines.push(
      "",
      "Inventory comparison",
      "Measured prior and restated inventories were not both available at disclosure time.",
    );
  }

  if (input.auditNarrative?.trim()) {
    lines.push(
      "",
      "Audit narrative (datapoint version history)",
      input.auditNarrative.trim(),
    );
  }

  if (input.finalizedAt) {
    lines.push("", `Finalised: ${input.finalizedAt}`);
  }

  lines.push(
    "",
    "This note accompanies the GHG inventory disclosure package per GHG Protocol Corporate Standard §12 (recalculations).",
  );

  return lines.join("\n");
}

/**
 * Short audit narrative from datapoint version change summaries.
 * Pure — caller supplies already-fetched version rows.
 */
export function buildAuditNarrativeFromVersions(
  versions: Array<{
    datapointId: string;
    versionNumber: number;
    changeType: string;
    changedAt?: string | null;
    changeReason?: string | null;
  }>,
): string | null {
  if (versions.length === 0) return null;
  const lines = versions.slice(0, 40).map((v) => {
    const when = v.changedAt ? ` at ${v.changedAt}` : "";
    const reason = v.changeReason?.trim() ? ` — ${v.changeReason.trim()}` : "";
    return `• datapoint ${v.datapointId} v${v.versionNumber} (${v.changeType})${when}${reason}`;
  });
  const more =
    versions.length > 40
      ? `\n… and ${versions.length - 40} additional version entries`
      : "";
  return (
    `Datapoint version history referenced for this restatement (${versions.length} entries):\n` +
    lines.join("\n") +
    more
  );
}
