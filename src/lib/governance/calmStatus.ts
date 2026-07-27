/** Deadline calm status from days-left + readiness. */

export type CalmLevel = "on_track" | "at_risk" | "critical" | "unknown";

export function calmStatus(opts: {
  daysLeft: number | null;
  collected: number;
  required: number;
}): { level: CalmLevel; label: string; hint: string } {
  const { daysLeft, collected, required } = opts;
  const ready = required > 0 ? collected / required : 0;

  if (daysLeft === null) {
    return {
      level: "unknown",
      label: "Set a filing deadline",
      hint: "Add a compliance obligation to see runway status.",
    };
  }

  if (daysLeft <= 14 || (daysLeft <= 30 && ready < 0.7)) {
    return {
      level: "critical",
      label: "Critical",
      hint: "Focus on the single next action below.",
    };
  }

  if (daysLeft <= 45 || ready < 0.85) {
    return {
      level: "at_risk",
      label: "At risk",
      hint: "Close the biggest gaps before the deadline tightens.",
    };
  }

  return {
    level: "on_track",
    label: "On track",
    hint: "Keep collecting proof and you will be ready to share.",
  };
}

export function readinessBreakdown(
  collected: number,
  required: number,
): {
  pct: number;
  label: string;
  detail: string;
} {
  if (required <= 0) {
    return {
      pct: 0,
      label: "No required metrics configured",
      detail: "Required runway metrics are not loaded.",
    };
  }
  const pct = Math.round((collected / required) * 100);
  return {
    pct,
    label: `${collected} of ${required} required metrics`,
    detail:
      pct >= 100
        ? "All required runway metrics are present. Evidence and approval may still be open."
        : `Counted only present (non-missing) required metrics — not evidence or approvals.`,
  };
}
