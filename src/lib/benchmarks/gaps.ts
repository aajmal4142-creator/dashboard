/**
 * Gap callouts vs peer cohort — pure. Never references peer org names.
 * Lower values are treated as better (emissions / intensity / kWh).
 */

export type PeerReferenceStats = {
  median: number;
  mean: number;
  best: number;
  p25?: number;
  p75?: number;
};

export type GapCallout = {
  metricKey: string;
  label: string;
  yourValue: number;
  median: number;
  best: number;
  /** your − median (positive ⇒ above median / worse for lower-is-better) */
  gapVsMedian: number;
  /** your − best (positive ⇒ worse than best-in-class proxy) */
  gapVsBest: number;
  /** Relative gap vs median: (your − median) / median */
  gapVsMedianPct: number | null;
  severity: "ahead" | "near" | "behind";
  message: string;
};

const METRIC_LABELS: Record<string, string> = {
  electricity_kwh: "Electricity (kWh)",
  scope1_tco2e: "Scope 1",
  scope2_tco2e: "Scope 2",
  scope3_tco2e: "Scope 3",
  total_tco2e: "Total emissions",
};

export function metricLabel(metricKey: string): string {
  return METRIC_LABELS[metricKey] ?? metricKey;
}

function severityFor(gapVsMedianPct: number | null): GapCallout["severity"] {
  if (gapVsMedianPct === null) return "near";
  if (gapVsMedianPct <= -0.1) return "ahead";
  if (gapVsMedianPct <= 0.1) return "near";
  return "behind";
}

function messageFor(
  label: string,
  severity: GapCallout["severity"],
  gapVsMedian: number,
  gapVsBest: number,
): string {
  if (severity === "ahead") {
    return `${label} is below peer median (gap ${gapVsMedian.toLocaleString()}).`;
  }
  if (severity === "near") {
    return `${label} is near peer median. Best-in-class proxy is ${gapVsBest.toLocaleString()} lower.`;
  }
  return `${label} sits ${gapVsMedian.toLocaleString()} above peer median. Closing toward best narrows ${gapVsBest.toLocaleString()}.`;
}

/**
 * Build a single gap callout for one metric against anonymised peer stats.
 */
export function buildGapCallout(
  metricKey: string,
  yourValue: number,
  peers: PeerReferenceStats,
): GapCallout {
  const label = metricLabel(metricKey);
  const gapVsMedian = Math.round((yourValue - peers.median) * 100) / 100;
  const gapVsBest = Math.round((yourValue - peers.best) * 100) / 100;
  const gapVsMedianPct =
    peers.median !== 0
      ? Math.round(((yourValue - peers.median) / Math.abs(peers.median)) * 1000) / 1000
      : null;
  const severity = severityFor(gapVsMedianPct);
  return {
    metricKey,
    label,
    yourValue,
    median: peers.median,
    best: peers.best,
    gapVsMedian,
    gapVsBest,
    gapVsMedianPct,
    severity,
    message: messageFor(label, severity, gapVsMedian, gapVsBest),
  };
}

/**
 * You / Median / Best row for comparison UI.
 */
export function youVsMedianVsBest(
  yourValue: number | null,
  peers: PeerReferenceStats,
): {
  you: number | null;
  median: number;
  best: number;
  mean: number;
} {
  return {
    you: yourValue,
    median: peers.median,
    best: peers.best,
    mean: peers.mean,
  };
}

/**
 * Trend of percentile rank across periods. Values only — no peer identities.
 */
export function trendVsPeers(
  currentRank: number | null,
  previousRank: number | null,
): {
  currentRank: number | null;
  previousRank: number | null;
  delta: number | null;
  direction: "improved" | "worsened" | "flat" | "unknown";
} {
  if (currentRank === null || previousRank === null) {
    return {
      currentRank,
      previousRank,
      delta: null,
      direction: "unknown",
    };
  }
  const delta = currentRank - previousRank;
  // Higher percentile = better (more peers worse than you) for lower-is-better metrics
  // when rank is "share of peers below you". Wait — existing percentileRank is
  // "share of cohort below your value". For lower-is-better, higher rank = worse.
  // Document: delta > 0 means your value rose vs peers (worse for intensity).
  let direction: "improved" | "worsened" | "flat" = "flat";
  if (delta < -2) direction = "improved";
  else if (delta > 2) direction = "worsened";
  return { currentRank, previousRank, delta, direction };
}
