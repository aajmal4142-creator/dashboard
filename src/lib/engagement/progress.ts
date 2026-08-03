/**
 * Pure campaign progress helpers — zero I/O.
 * Missing goal is never treated as zero progress.
 */

export const CAMPAIGN_GOAL_TYPES = ["participants", "tco2e"] as const;
export type CampaignGoalType = (typeof CAMPAIGN_GOAL_TYPES)[number];

export type CampaignProgressQuality = "measured" | "missing";

export type CampaignProgressInput = {
  goalType: CampaignGoalType;
  /** Target participants or tCO₂e. Null / non-finite / ≤ 0 → missing quality. */
  goalValue: number | null | undefined;
  participantCount: number;
  /**
   * Achieved tCO₂e for tco2e goals.
   * Null / non-finite → missing quality (never coerced to 0).
   */
  achievedTco2e?: number | null | undefined;
};

export type CampaignProgressResult = {
  /** 0–100 when measured; null when quality is missing. */
  percent: number | null;
  quality: CampaignProgressQuality;
  message: string | null;
  /** Current numerator used for the ratio (participants or tCO₂e). */
  current: number | null;
  /** Denominator (goal) when valid. */
  goal: number | null;
};

function finitePositive(value: number | null | undefined): number | null {
  if (value === null || value === undefined || !Number.isFinite(value) || value <= 0) {
    return null;
  }
  return value;
}

function finiteNonNeg(value: number | null | undefined): number | null {
  if (value === null || value === undefined || !Number.isFinite(value) || value < 0) {
    return null;
  }
  return value;
}

/**
 * Progress % toward a campaign goal.
 *
 * - Missing / invalid / non-positive goal → quality `missing`, percent null.
 * - Participant goals use participantCount (0 is a valid measured current).
 * - tCO₂e goals require a measured achievedTco2e; missing current → missing quality.
 */
export function campaignProgress(input: CampaignProgressInput): CampaignProgressResult {
  const goal = finitePositive(input.goalValue);

  if (goal === null) {
    return {
      percent: null,
      quality: "missing",
      message: "Campaign goal is missing or invalid. Progress is not treated as zero.",
      current: null,
      goal: null,
    };
  }

  if (input.goalType === "participants") {
    const current = finiteNonNeg(input.participantCount);
    if (current === null) {
      return {
        percent: null,
        quality: "missing",
        message: "Participant count is missing or invalid.",
        current: null,
        goal,
      };
    }
    const raw = (current / goal) * 100;
    const percent = Math.min(100, Math.round(raw * 10) / 10);
    return {
      percent,
      quality: "measured",
      message: null,
      current,
      goal,
    };
  }

  const achieved = finiteNonNeg(input.achievedTco2e);
  if (achieved === null) {
    return {
      percent: null,
      quality: "missing",
      message:
        "Achieved tCO₂e is missing. Progress toward an emissions goal is not treated as zero.",
      current: null,
      goal,
    };
  }

  const raw = (achieved / goal) * 100;
  const percent = Math.min(100, Math.round(raw * 10) / 10);
  return {
    percent,
    quality: "measured",
    message: null,
    current: achieved,
    goal,
  };
}

export function isCampaignGoalType(value: unknown): value is CampaignGoalType {
  return (
    typeof value === "string" &&
    (CAMPAIGN_GOAL_TYPES as readonly string[]).includes(value)
  );
}
