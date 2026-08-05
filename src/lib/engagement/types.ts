import {
  CAMPAIGN_GOAL_TYPES,
  type CampaignGoalType,
  type CampaignProgressQuality,
  type CampaignProgressResult,
} from "./progress";

export const CAMPAIGN_STATUSES = ["draft", "active", "completed", "cancelled"] as const;

export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = {
  draft: "Draft",
  active: "Active",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const CAMPAIGN_GOAL_TYPE_LABELS: Record<CampaignGoalType, string> = {
  participants: "Participants",
  tco2e: "tCO₂e avoided",
};

export const SURVEY_MODES = ["none", "commute"] as const;

export type SurveyMode = (typeof SURVEY_MODES)[number];

export const SURVEY_MODE_LABELS: Record<SurveyMode, string> = {
  none: "No public survey",
  commute: "Commute survey (days/km)",
};

export type EngagementCampaignDto = {
  id: string;
  title: string;
  status: CampaignStatus;
  startDate: string | null;
  endDate: string | null;
  goalType: CampaignGoalType;
  goalValue: number | null;
  participantCount: number;
  achievedTco2e: number | null;
  linkCommuteChallenge: boolean;
  description: string | null;
  publicToken: string | null;
  surveyMode: SurveyMode;
  surveyResponseCount: number;
  progress: CampaignProgressResult;
  updatedAt: string | null;
  createdAt: string | null;
};

export function isCampaignStatus(value: unknown): value is CampaignStatus {
  return (
    typeof value === "string" && (CAMPAIGN_STATUSES as readonly string[]).includes(value)
  );
}

export function isSurveyMode(value: unknown): value is SurveyMode {
  return typeof value === "string" && (SURVEY_MODES as readonly string[]).includes(value);
}

export {
  CAMPAIGN_GOAL_TYPES,
  type CampaignGoalType,
  type CampaignProgressQuality,
  type CampaignProgressResult,
};
