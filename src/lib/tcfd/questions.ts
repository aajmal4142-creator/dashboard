import type { TcfdQuestion } from "./types";

/**
 * TCFD questionnaire — four pillars.
 * Citations are structural hooks for counsel; not legal determinations.
 */
export const TCFD_QUESTIONS: TcfdQuestion[] = [
  {
    id: "gov-board",
    pillar: "governance",
    label: "Board oversight",
    prompt: "Describe the board’s oversight of climate-related risks and opportunities.",
    required: true,
  },
  {
    id: "gov-management",
    pillar: "governance",
    label: "Management role",
    prompt:
      "Describe management’s role in assessing and managing climate-related risks and opportunities.",
    required: true,
  },
  {
    id: "gov-incentives",
    pillar: "governance",
    label: "Incentives",
    prompt:
      "Describe whether climate-related performance is linked to remuneration or incentives.",
    required: false,
  },
  {
    id: "str-risks",
    pillar: "strategy",
    label: "Climate risks & opportunities",
    prompt:
      "Describe the climate-related risks and opportunities the organisation has identified over the short, medium, and long term.",
    required: true,
  },
  {
    id: "str-impact",
    pillar: "strategy",
    label: "Business & financial impact",
    prompt:
      "Describe the impact of climate-related risks and opportunities on the organisation’s businesses, strategy, and financial planning.",
    required: true,
  },
  {
    id: "str-scenarios",
    pillar: "strategy",
    label: "Scenario analysis",
    prompt:
      "Describe the resilience of the organisation’s strategy, taking into consideration different climate-related scenarios (including a 2°C or lower scenario).",
    autofillKey: "scenarios",
    required: true,
  },
  {
    id: "risk-process",
    pillar: "risk_management",
    label: "Identification process",
    prompt:
      "Describe the organisation’s processes for identifying and assessing climate-related risks.",
    required: true,
  },
  {
    id: "risk-manage",
    pillar: "risk_management",
    label: "Management process",
    prompt: "Describe the organisation’s processes for managing climate-related risks.",
    required: true,
  },
  {
    id: "risk-integrate",
    pillar: "risk_management",
    label: "Integration",
    prompt:
      "Describe how processes for identifying, assessing, and managing climate-related risks are integrated into the organisation’s overall risk management.",
    required: true,
  },
  {
    id: "met-ghg",
    pillar: "metrics_targets",
    label: "GHG emissions",
    prompt:
      "Disclose Scope 1, Scope 2, and, if appropriate, Scope 3 greenhouse gas emissions and the related risks.",
    autofillKey: "emissions",
    required: true,
  },
  {
    id: "met-targets",
    pillar: "metrics_targets",
    label: "Targets",
    prompt:
      "Describe the targets used to manage climate-related risks and opportunities and performance against targets.",
    autofillKey: "scenarios",
    required: true,
  },
  {
    id: "met-quality",
    pillar: "metrics_targets",
    label: "Data quality",
    prompt:
      "Describe data quality, estimation methods, and known gaps in the climate metrics disclosed.",
    autofillKey: "quality",
    required: false,
  },
];

export function questionsByPillar(pillar: TcfdQuestion["pillar"]): TcfdQuestion[] {
  return TCFD_QUESTIONS.filter((q) => q.pillar === pillar);
}

export function questionById(id: string): TcfdQuestion | undefined {
  return TCFD_QUESTIONS.find((q) => q.id === id);
}
