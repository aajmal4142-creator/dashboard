import type { IssbQuestion } from "./types";

/**
 * ISSB questionnaire — S1 general + S2 climate (extends TCFD).
 * Placeholders pending counsel; contribution structure only.
 */
export const ISSB_QUESTIONS: IssbQuestion[] = [
  {
    id: "s1-gov",
    standard: "S1",
    label: "Governance (general)",
    prompt:
      "Describe the governance processes, controls, and procedures used to monitor and manage sustainability-related risks and opportunities.",
    required: true,
  },
  {
    id: "s1-strategy",
    standard: "S1",
    label: "Strategy (general)",
    prompt:
      "Describe the approach to identifying sustainability-related risks and opportunities that could reasonably be expected to affect prospects.",
    required: true,
  },
  {
    id: "s1-risk",
    standard: "S1",
    label: "Risk management (general)",
    prompt:
      "Describe the processes to identify, assess, prioritise, and monitor sustainability-related risks and opportunities.",
    required: true,
  },
  {
    id: "s1-metrics",
    standard: "S1",
    label: "Metrics & targets (general)",
    prompt:
      "Disclose metrics and targets used to understand performance on sustainability-related risks and opportunities.",
    autofillKey: "materiality",
    required: true,
  },
  {
    id: "s1-materiality",
    standard: "S1",
    label: "Materiality judgement",
    prompt:
      "Describe how materiality was judged for sustainability-related disclosures (quantitative and qualitative).",
    autofillKey: "materiality",
    required: true,
  },
  {
    id: "s2-gov",
    standard: "S2",
    tcfdPillar: "governance",
    tcfdQuestionId: "gov-board",
    label: "Climate governance",
    prompt:
      "Describe the board’s oversight of climate-related risks and opportunities (ISSB S2 / TCFD Governance).",
    required: true,
  },
  {
    id: "s2-strategy",
    standard: "S2",
    tcfdPillar: "strategy",
    tcfdQuestionId: "str-risks",
    label: "Climate strategy",
    prompt:
      "Describe climate-related risks and opportunities and their effects on strategy and financial planning (ISSB S2 / TCFD Strategy).",
    required: true,
  },
  {
    id: "s2-scenarios",
    standard: "S2",
    tcfdPillar: "strategy",
    tcfdQuestionId: "str-scenarios",
    label: "Climate resilience / scenarios",
    prompt:
      "Describe climate resilience, including scenario analysis (ISSB S2 extends TCFD Strategy).",
    required: true,
  },
  {
    id: "s2-risk",
    standard: "S2",
    tcfdPillar: "risk_management",
    tcfdQuestionId: "risk-process",
    label: "Climate risk management",
    prompt:
      "Describe processes for identifying, assessing, and managing climate-related risks (ISSB S2 / TCFD Risk Management).",
    required: true,
  },
  {
    id: "s2-ghg",
    standard: "S2",
    tcfdPillar: "metrics_targets",
    tcfdQuestionId: "met-ghg",
    label: "GHG emissions",
    prompt:
      "Disclose absolute gross Scope 1, Scope 2, and Scope 3 greenhouse gas emissions (ISSB S2 / TCFD Metrics).",
    autofillKey: "emissions",
    required: true,
    metricKeys: [
      "diesel_litres",
      "petrol_litres",
      "natural_gas_m3",
      "electricity_kwh",
      "electricity_renewable_pct",
      "supplier_spend_total",
      "business_travel_km",
    ],
  },
  {
    id: "s2-targets",
    standard: "S2",
    tcfdPillar: "metrics_targets",
    tcfdQuestionId: "met-targets",
    label: "Climate-related targets",
    prompt:
      "Disclose climate-related targets and progress (ISSB S2 / TCFD Metrics & Targets).",
    required: true,
  },
];

export function issbQuestionsByStandard(
  standard: IssbQuestion["standard"],
): IssbQuestion[] {
  return ISSB_QUESTIONS.filter((q) => q.standard === standard);
}
