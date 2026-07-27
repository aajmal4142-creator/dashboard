/**
 * lib/calc/scores.ts — BUILD_PLAN §5.
 *
 * The four outer formulas are implemented exactly as written in the plan:
 *
 *   E = clamp(0, 100,  100 − max(0, carbonPerEmployee − 1) × 12 + renewablePct × 0.15)
 *   S = clamp(0, 100,  min(55, diversityPct / 40 × 55) + max(0, 35 − injuryRate × 8) + trainingBonus)
 *   G = clamp(0, 100,  boardIndependencePct × 0.5 + policyToggleScore)
 *   Overall = round((E + S + G) / 3)
 *   Band: ≥70 strong | 45–69 moderate | <45 early
 *
 * The plan names four intermediate ratios (`diversityPct`, `injuryRate`, `trainingBonus`,
 * `policyToggleScore`) without defining them beyond their name. Those definitions are made
 * once, here, and documented at each call site — they are the only assumption this file
 * takes; the clamp expressions above are untouched.
 */
import type { BreakdownItem } from "./types";

export function clamp(min: number, max: number, value: number): number {
  return Math.min(max, Math.max(min, value));
}

function round2(value: number): number {
  const rounded = Math.round(value * 100) / 100;
  return rounded === 0 ? 0 : rounded; // normalise -0 so golden fixtures compare cleanly
}

export interface ScoreResult {
  score: number;
  breakdown: BreakdownItem[];
}

export interface EScoreInputs {
  /** Total tCO2e (scope 1 + 2 + 3) divided by headcount. */
  carbonPerEmployeeTco2e: number;
  renewablePct: number;
}

export function computeEScore(inputs: EScoreInputs): ScoreResult {
  const penalty = Math.max(0, inputs.carbonPerEmployeeTco2e - 1) * 12;
  const bonus = inputs.renewablePct * 0.15;
  const score = clamp(0, 100, 100 - penalty + bonus);

  return {
    score,
    breakdown: [
      {
        component: "e_carbon_intensity",
        contribution: round2(-penalty),
        explanation: `Carbon intensity of ${round2(inputs.carbonPerEmployeeTco2e)} tCO2e per employee reduced the E score by ${round2(penalty)} points.`,
      },
      {
        component: "e_renewable_share",
        contribution: round2(bonus),
        explanation: `Renewable electricity share of ${round2(inputs.renewablePct)}% added ${round2(bonus)} points to the E score.`,
      },
    ],
  };
}

export interface SScoreInputs {
  /** employees_women / employees_total × 100 */
  diversityPct: number;
  /** injuries_recordable × 200,000 / hours_worked_total — the standard OSHA-style TRIR basis. */
  injuryRate: number;
  /** training_hours_total / employees_total */
  trainingHoursPerEmployee: number;
}

/** 1 score point per 4 hours of training per employee, capped at 10 — the plan's `trainingBonus`. */
function trainingBonus(trainingHoursPerEmployee: number): number {
  return clamp(0, 10, trainingHoursPerEmployee / 4);
}

export function computeSScore(inputs: SScoreInputs): ScoreResult {
  const diversityTerm = Math.min(55, (inputs.diversityPct / 40) * 55);
  const injuryTerm = Math.max(0, 35 - inputs.injuryRate * 8);
  const training = trainingBonus(inputs.trainingHoursPerEmployee);
  const score = clamp(0, 100, diversityTerm + injuryTerm + training);

  return {
    score,
    breakdown: [
      {
        component: "s_diversity",
        contribution: round2(diversityTerm),
        explanation: `Workforce diversity of ${round2(inputs.diversityPct)}% contributed ${round2(diversityTerm)} points to the S score.`,
      },
      {
        component: "s_injury_rate",
        contribution: round2(injuryTerm),
        explanation: `Injury rate of ${round2(inputs.injuryRate)} per 200,000 hours worked contributed ${round2(injuryTerm)} points to the S score.`,
      },
      {
        component: "s_training",
        contribution: round2(training),
        explanation: `Training of ${round2(inputs.trainingHoursPerEmployee)} hours per employee added ${round2(training)} points to the S score.`,
      },
    ],
  };
}

export interface GScoreInputs {
  /** board_independent / board_size × 100 */
  boardIndependencePct: number;
  /** Count (0–3) of anti-corruption / whistleblower / data-privacy policies in force. */
  policiesTrue: number;
}

const POLICY_COUNT = 3;
const POLICY_MAX_POINTS = 50;

/** Each of the three governance policy toggles is worth an equal share of the 50 points left after board independence. */
function policyToggleScore(policiesTrue: number): number {
  return policiesTrue * (POLICY_MAX_POINTS / POLICY_COUNT);
}

export function computeGScore(inputs: GScoreInputs): ScoreResult {
  const boardTerm = inputs.boardIndependencePct * 0.5;
  const policyTerm = policyToggleScore(inputs.policiesTrue);
  const score = clamp(0, 100, boardTerm + policyTerm);

  return {
    score,
    breakdown: [
      {
        component: "g_board_independence",
        contribution: round2(boardTerm),
        explanation: `Board independence of ${round2(inputs.boardIndependencePct)}% contributed ${round2(boardTerm)} points to the G score.`,
      },
      {
        component: "g_policies",
        contribution: round2(policyTerm),
        explanation: `${inputs.policiesTrue} of ${POLICY_COUNT} governance policies in force contributed ${round2(policyTerm)} points to the G score.`,
      },
    ],
  };
}

export function computeOverall(e: number, s: number, g: number): number {
  return Math.round((e + s + g) / 3);
}

export type Band = "strong" | "moderate" | "early";

export function bandOf(overall: number): Band {
  if (overall >= 70) return "strong";
  if (overall >= 45) return "moderate";
  return "early";
}
