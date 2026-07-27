export type ClientRiskRow = {
  id: string;
  name: string;
  slug: string;
  sector: string;
  country: string;
  plan: string;
  daysToFiling: number | null;
  datapointsCollected: number;
  datapointsRequired: number;
  overallScore: number | null;
  risk: "critical" | "at_risk" | "on_track" | "unknown";
};

export function riskOf(
  daysToFiling: number | null,
  collected: number,
  required: number,
): ClientRiskRow["risk"] {
  if (daysToFiling === null) return "unknown";
  const remaining = Math.max(0, required - collected);
  const velocity = collected > 0 ? collected / 30 : 0.15;
  const daysNeeded = velocity > 0 ? Math.ceil(remaining / velocity) : 999;
  if (daysToFiling < 14) return "critical";
  if (daysNeeded > daysToFiling) return "at_risk";
  return "on_track";
}

export function sortByDeadlineRisk(rows: ClientRiskRow[]): ClientRiskRow[] {
  const rank = { critical: 0, at_risk: 1, unknown: 2, on_track: 3 };
  return [...rows].sort((a, b) => {
    const rd = rank[a.risk] - rank[b.risk];
    if (rd !== 0) return rd;
    const da = a.daysToFiling ?? 9999;
    const db = b.daysToFiling ?? 9999;
    return da - db;
  });
}
