import { frameworkLabel } from "@/lib/ui/displayLabels";

/** Format tCO₂e for print — never dump float noise. */
export function formatTco2e(value: number): string {
  if (!Number.isFinite(value)) return "—";
  if (value === 0) return "0.00";
  const abs = Math.abs(value);
  if (abs < 0.001) return value.toFixed(6);
  if (abs < 0.01) return value.toFixed(4);
  if (abs < 1) return value.toFixed(3);
  if (abs < 100) return value.toFixed(2);
  return value.toLocaleString("en-GB", { maximumFractionDigits: 1 });
}

export function formatScore(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return String(Math.round(value));
}

export function formatPct(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return `${Math.round(value)}%`;
}

export function formatPublishedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function reportFrameworkLabel(code: string): string {
  return frameworkLabel(code);
}

export function bandLabel(band: string): string {
  if (band === "strong") return "Strong";
  if (band === "moderate") return "Moderate";
  if (band === "early") return "Early stage";
  return band;
}

/** Short topic name for ESRS codes when no richer map exists. */
export function topicLabel(code: string): string {
  const map: Record<string, string> = {
    E1: "Climate change",
    E2: "Pollution",
    E3: "Water and marine resources",
    E4: "Biodiversity and ecosystems",
    E5: "Resource use and circular economy",
    S1: "Own workforce",
    S2: "Workers in the value chain",
    S3: "Affected communities",
    S4: "Consumers and end-users",
    G1: "Business conduct",
  };
  return map[code] ?? code;
}
