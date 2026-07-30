/**
 * Peer-group matching — pure.
 * Groups by industry (NACE section), size (revenue band), geography (country), period.
 * Never carries org identities.
 */

export type PeerGroupDimensions = {
  sector: string;
  sizeBand: string;
  geography: string;
  period: string;
  metricKey: string;
};

/** Coarse NACE section letter from org.sector. */
export function resolveSector(sector?: string | null): string {
  const s = (sector ?? "C").trim();
  return s.charAt(0).toUpperCase() || "C";
}

/** Size band from org revenueBand; unknown → "all". */
export function resolveSizeBand(revenueBand?: string | null): string {
  if (!revenueBand) return "all";
  return revenueBand;
}

/** Geography from ISO country; unknown → "all". */
export function resolveGeography(country?: string | null): string {
  const c = (country ?? "").trim().toUpperCase();
  if (!c || c.length < 2) return "all";
  return c.slice(0, 2);
}

export function currentPeriodLabel(now = new Date()): string {
  return `FY${now.getFullYear()}`;
}

export function previousPeriodLabel(now = new Date()): string {
  return `FY${now.getFullYear() - 1}`;
}

/**
 * Auto-match priority: narrow → wide.
 * Prefer exact sector+size+geo, then drop geography, then size.
 */
export function peerGroupMatchOrder(input: {
  sector?: string | null;
  sizeBand?: string | null;
  geography?: string | null;
  period: string;
  metricKey?: string;
}): PeerGroupDimensions[] {
  const metricKey = input.metricKey ?? "electricity_kwh";
  const sector = resolveSector(input.sector);
  const size = resolveSizeBand(input.sizeBand);
  const geo = resolveGeography(input.geography);
  const period = input.period;

  const candidates: PeerGroupDimensions[] = [
    { sector, sizeBand: size, geography: geo, period, metricKey },
  ];

  if (geo !== "all") {
    candidates.push({ sector, sizeBand: size, geography: "all", period, metricKey });
  }
  if (size !== "all") {
    candidates.push({ sector, sizeBand: "all", geography: geo, period, metricKey });
    candidates.push({ sector, sizeBand: "all", geography: "all", period, metricKey });
  } else if (geo !== "all") {
    // size already all; ensure sector-wide all-geo appears after geo-specific
    candidates.push({ sector, sizeBand: "all", geography: "all", period, metricKey });
  }

  const seen = new Set<string>();
  const out: PeerGroupDimensions[] = [];
  for (const c of candidates) {
    const k = peerGroupKey(c);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(c);
  }
  return out;
}

/** Stable key for a cohort row — no org ids. */
export function peerGroupKey(dims: PeerGroupDimensions): string {
  return [
    resolveSector(dims.sector),
    dims.sizeBand || "all",
    dims.geography || "all",
    dims.period,
    dims.metricKey,
  ].join("|");
}
