/**
 * Sector starting positions for the materiality workshop (Phase 3 Track B).
 *
 * These are **starting suggestions**, not determinations. Counsel should review
 * before treating any score as authoritative. NACE letter = first character of
 * organisations.sector (stored as NACE code text).
 */
import { ESRS_TOPICS } from "./topics";

export type TopicOrigin = "suggested" | "adjusted";

export type TopicStartingScores = {
  esrsTopic: string;
  impactSeverity: number;
  impactScope: number;
  impactIrremediability: number;
  financialMagnitude: number;
  financialLikelihood: number;
  rationale: string;
};

/** Honesty line shown in the workshop UI. */
export const SECTOR_DEFAULTS_DISCLAIMER =
  "Starting positions are sector heuristics for workshop pace — not a materiality determination. Adjust anything that does not match your operations.";

type AxisPreset = {
  impact: [number, number, number];
  financial: [number, number];
  note: string;
};

/** Sparse presets by NACE letter; missing topics fall back to neutral 2s. */
const BY_LETTER: Record<string, Partial<Record<string, AxisPreset>>> = {
  C: {
    // Manufacturing
    E1: {
      impact: [4, 4, 3],
      financial: [4, 4],
      note: "Manufacturing — energy and process emissions typically material.",
    },
    E2: {
      impact: [3, 3, 3],
      financial: [3, 3],
      note: "Process emissions / substances of concern often material.",
    },
    E5: {
      impact: [3, 3, 2],
      financial: [3, 3],
      note: "Material flows and waste commonly in scope.",
    },
    S1: {
      impact: [3, 3, 3],
      financial: [3, 3],
      note: "Own workforce H&S typically material in manufacturing.",
    },
    G1: {
      impact: [2, 2, 2],
      financial: [3, 3],
      note: "Conduct / payment practices — review for your jurisdictions.",
    },
  },
  G: {
    // Wholesale / retail trade
    E1: {
      impact: [3, 3, 2],
      financial: [3, 3],
      note: "Retail — Scope 2 sites and logistics often material.",
    },
    S2: {
      impact: [3, 4, 3],
      financial: [3, 3],
      note: "Value-chain labour conditions often elevated.",
    },
    S4: {
      impact: [3, 3, 2],
      financial: [3, 3],
      note: "Consumers / product responsibility often material.",
    },
    G1: {
      impact: [2, 2, 2],
      financial: [3, 3],
      note: "Business conduct — review for your jurisdictions.",
    },
  },
  H: {
    // Transport
    E1: {
      impact: [4, 4, 3],
      financial: [4, 4],
      note: "Transport — fleet fuels and logistics almost always material.",
    },
    S1: {
      impact: [3, 3, 3],
      financial: [3, 3],
      note: "Own workforce safety typically material.",
    },
  },
  I: {
    // Accommodation / food
    E1: {
      impact: [3, 3, 2],
      financial: [3, 3],
      note: "Hospitality — sites energy and purchased goods often material.",
    },
    S1: {
      impact: [3, 3, 2],
      financial: [3, 3],
      note: "Own workforce typically material.",
    },
  },
  J: {
    // Information / communication
    E1: {
      impact: [2, 2, 2],
      financial: [3, 3],
      note: "ICT — energy for data/offices; confirm cloud share.",
    },
    S1: {
      impact: [2, 2, 2],
      financial: [2, 3],
      note: "Own workforce — review working conditions.",
    },
    G1: {
      impact: [2, 2, 2],
      financial: [3, 3],
      note: "Business conduct / data ethics — review.",
    },
  },
};

const NEUTRAL: AxisPreset = {
  impact: [2, 2, 2],
  financial: [2, 2],
  note: "Neutral starting point — adjust to your facts.",
};

export function naceLetter(sector: string): string {
  const t = sector.trim().toUpperCase();
  const m = t.match(/[A-Z]/);
  return m?.[0] ?? "C";
}

export function sectorDefaults(sector: string): TopicStartingScores[] {
  const letter = naceLetter(sector);
  const table = BY_LETTER[letter] ?? {};
  return ESRS_TOPICS.map((t) => {
    const preset = table[t.id] ?? NEUTRAL;
    return {
      esrsTopic: t.id,
      impactSeverity: preset.impact[0],
      impactScope: preset.impact[1],
      impactIrremediability: preset.impact[2],
      financialMagnitude: preset.financial[0],
      financialLikelihood: preset.financial[1],
      rationale: preset.note,
    };
  });
}

export function topicOriginAgainstDefault(
  current: TopicStartingScores,
  baseline: TopicStartingScores,
): TopicOrigin {
  const keys: (keyof TopicStartingScores)[] = [
    "impactSeverity",
    "impactScope",
    "impactIrremediability",
    "financialMagnitude",
    "financialLikelihood",
    "rationale",
  ];
  for (const k of keys) {
    if (current[k] !== baseline[k]) return "adjusted";
  }
  return "suggested";
}
