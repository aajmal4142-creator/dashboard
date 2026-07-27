/**
 * The 12 golden input → output cases required by BUILD_PLAN §5. These must never drift:
 * if a formula change alters an expected value here, that's a deliberate, reviewed change,
 * not an accident. Expected values were generated once from a known-good run of
 * `calculate()` against FACTORS_FIXTURE and then frozen here as literals.
 */
import type { CalcInput, CalcResult, DatapointValue, Quality } from "../types";
import { FACTORS_FIXTURE } from "./factors.fixture";

function dp(value: number | null, quality: Quality = "measured"): DatapointValue {
  return { value, quality };
}

const MISSING = dp(null, "missing");

export interface CalcFixture {
  name: string;
  description: string;
  input: CalcInput;
  expected: CalcResult;
}

export const CALC_FACTORS = FACTORS_FIXTURE;

export const CALC_FIXTURES: CalcFixture[] = [
  {
    name: "manufacturer-normal",
    description:
      "A typical SME manufacturer with full, mostly measured data across E/S/G.",
    input: {
      context: { region: "GB", year: 2024 },
      metrics: {
        electricity_kwh: dp(150_000),
        electricity_renewable_pct: dp(20),
        diesel_litres: dp(5_000),
        natural_gas_m3: dp(3_000),
        petrol_litres: dp(800),
        employees_total: dp(120),
        employees_women: dp(42),
        injuries_recordable: dp(2),
        hours_worked_total: dp(216_000),
        training_hours_total: dp(960),
        board_size: dp(6),
        board_independent: dp(3),
        policy_anti_corruption: dp(1),
        policy_whistleblower: dp(1),
        policy_data_privacy: dp(0),
        supplier_spend_total: dp(500_000),
        business_travel_km: dp(40_000),
      },
    },
    expected: {
      scores: {
        overall: 72,
        e: 86.67836700000001,
        s: 70.31018518518519,
        g: 58.333333333333336,
      },
      emissions: {
        scope1: { value: 20.36633, unit: "tCO2e", quality: "calculated" },
        scope2: {
          value: 31.05,
          unit: "tCO2e",
          quality: "calculated",
          factorId: "f-grid-gb-2024",
        },
        scope3: { value: 231.8, unit: "tCO2e", quality: "calculated" },
        total: { value: 283.21633, unit: "tCO2e", quality: "calculated" },
      },
      dataQualityPct: 100,
      factorsUsed: [
        {
          factorId: "f-diesel-gb-2024",
          key: "diesel",
          value: 2.51233,
          source: "DEFRA",
          year: 2024,
        },
        {
          factorId: "f-gas-gb-2024",
          key: "natural_gas",
          value: 2.04572,
          source: "DEFRA",
          year: 2024,
        },
        {
          factorId: "f-petrol-gb-2024",
          key: "petrol",
          value: 2.0844,
          source: "DEFRA",
          year: 2024,
        },
        {
          factorId: "f-grid-gb-2024",
          key: "grid_electricity",
          value: 0.207,
          source: "DEFRA",
          year: 2024,
        },
        {
          factorId: "f-spend-gb-2024",
          key: "spend_purchased_goods",
          value: 0.45,
          source: "DEFRA",
          year: 2024,
        },
        {
          factorId: "f-travel-gb-2024",
          key: "business_travel_avg",
          value: 0.17,
          source: "DEFRA",
          year: 2024,
        },
      ],
      breakdown: [
        {
          component: "scope1_diesel",
          contribution: 12.56,
          explanation: "Diesel contributed 12.56 tCO2e (61.68% of Scope 1).",
        },
        {
          component: "scope1_natural_gas",
          contribution: 6.14,
          explanation: "Natural gas contributed 6.14 tCO2e (30.13% of Scope 1).",
        },
        {
          component: "scope1_petrol",
          contribution: 1.67,
          explanation: "Petrol contributed 1.67 tCO2e (8.19% of Scope 1).",
        },
        {
          component: "scope2_electricity",
          contribution: 31.05,
          explanation: "Grid electricity contributed 31.05 tCO2e (100% of Scope 2).",
        },
        {
          component: "scope3_supplier_spend",
          contribution: 225,
          explanation: "Supplier spend contributed 225 tCO2e (97.07% of Scope 3).",
        },
        {
          component: "scope3_business_travel",
          contribution: 6.8,
          explanation: "Business travel contributed 6.8 tCO2e (2.93% of Scope 3).",
        },
        {
          component: "e_carbon_intensity",
          contribution: -16.32,
          explanation:
            "Carbon intensity of 2.36 tCO2e per employee reduced the E score by 16.32 points.",
        },
        {
          component: "e_renewable_share",
          contribution: 3,
          explanation:
            "Renewable electricity share of 20% added 3 points to the E score.",
        },
        {
          component: "s_diversity",
          contribution: 48.13,
          explanation:
            "Workforce diversity of 35% contributed 48.13 points to the S score.",
        },
        {
          component: "s_injury_rate",
          contribution: 20.19,
          explanation:
            "Injury rate of 1.85 per 200,000 hours worked contributed 20.19 points to the S score.",
        },
        {
          component: "s_training",
          contribution: 2,
          explanation: "Training of 8 hours per employee added 2 points to the S score.",
        },
        {
          component: "g_board_independence",
          contribution: 25,
          explanation: "Board independence of 50% contributed 25 points to the G score.",
        },
        {
          component: "g_policies",
          contribution: 33.33,
          explanation:
            "2 of 3 governance policies in force contributed 33.33 points to the G score.",
        },
      ],
      band: "strong",
    },
  },
  {
    name: "services-normal",
    description: "A services SME with no vehicle fleet and a strong renewable share.",
    input: {
      context: { region: "GB", year: 2024 },
      metrics: {
        electricity_kwh: dp(20_000),
        electricity_renewable_pct: dp(60),
        diesel_litres: dp(0),
        natural_gas_m3: dp(500),
        petrol_litres: dp(0),
        employees_total: dp(45),
        employees_women: dp(30),
        injuries_recordable: dp(0),
        hours_worked_total: dp(81_000),
        training_hours_total: dp(300),
        board_size: dp(4),
        board_independent: dp(4),
        policy_anti_corruption: dp(1),
        policy_whistleblower: dp(1),
        policy_data_privacy: dp(1),
        supplier_spend_total: dp(80_000),
        business_travel_km: dp(15_000),
      },
    },
    expected: {
      scores: { overall: 97, e: 100, s: 91.66666666666667, g: 100 },
      emissions: {
        scope1: { value: 1.02286, unit: "tCO2e", quality: "calculated" },
        scope2: {
          value: 4.14,
          unit: "tCO2e",
          quality: "calculated",
          factorId: "f-grid-gb-2024",
        },
        scope3: { value: 38.55, unit: "tCO2e", quality: "calculated" },
        total: { value: 43.71286, unit: "tCO2e", quality: "calculated" },
      },
      dataQualityPct: 100,
      factorsUsed: [
        {
          factorId: "f-diesel-gb-2024",
          key: "diesel",
          value: 2.51233,
          source: "DEFRA",
          year: 2024,
        },
        {
          factorId: "f-gas-gb-2024",
          key: "natural_gas",
          value: 2.04572,
          source: "DEFRA",
          year: 2024,
        },
        {
          factorId: "f-petrol-gb-2024",
          key: "petrol",
          value: 2.0844,
          source: "DEFRA",
          year: 2024,
        },
        {
          factorId: "f-grid-gb-2024",
          key: "grid_electricity",
          value: 0.207,
          source: "DEFRA",
          year: 2024,
        },
        {
          factorId: "f-spend-gb-2024",
          key: "spend_purchased_goods",
          value: 0.45,
          source: "DEFRA",
          year: 2024,
        },
        {
          factorId: "f-travel-gb-2024",
          key: "business_travel_avg",
          value: 0.17,
          source: "DEFRA",
          year: 2024,
        },
      ],
      breakdown: [
        {
          component: "scope1_diesel",
          contribution: 0,
          explanation: "Diesel contributed 0 tCO2e (0% of Scope 1).",
        },
        {
          component: "scope1_natural_gas",
          contribution: 1.02,
          explanation: "Natural gas contributed 1.02 tCO2e (100% of Scope 1).",
        },
        {
          component: "scope1_petrol",
          contribution: 0,
          explanation: "Petrol contributed 0 tCO2e (0% of Scope 1).",
        },
        {
          component: "scope2_electricity",
          contribution: 4.14,
          explanation: "Grid electricity contributed 4.14 tCO2e (100% of Scope 2).",
        },
        {
          component: "scope3_supplier_spend",
          contribution: 36,
          explanation: "Supplier spend contributed 36 tCO2e (93.39% of Scope 3).",
        },
        {
          component: "scope3_business_travel",
          contribution: 2.55,
          explanation: "Business travel contributed 2.55 tCO2e (6.61% of Scope 3).",
        },
        {
          component: "e_carbon_intensity",
          contribution: 0,
          explanation:
            "Carbon intensity of 0.97 tCO2e per employee reduced the E score by 0 points.",
        },
        {
          component: "e_renewable_share",
          contribution: 9,
          explanation:
            "Renewable electricity share of 60% added 9 points to the E score.",
        },
        {
          component: "s_diversity",
          contribution: 55,
          explanation:
            "Workforce diversity of 66.67% contributed 55 points to the S score.",
        },
        {
          component: "s_injury_rate",
          contribution: 35,
          explanation:
            "Injury rate of 0 per 200,000 hours worked contributed 35 points to the S score.",
        },
        {
          component: "s_training",
          contribution: 1.67,
          explanation:
            "Training of 6.67 hours per employee added 1.67 points to the S score.",
        },
        {
          component: "g_board_independence",
          contribution: 50,
          explanation: "Board independence of 100% contributed 50 points to the G score.",
        },
        {
          component: "g_policies",
          contribution: 50,
          explanation:
            "3 of 3 governance policies in force contributed 50 points to the G score.",
        },
      ],
      band: "strong",
    },
  },
  {
    name: "zero-employees",
    description:
      "A dormant shell organisation with employees_total = 0 — division guards.",
    input: {
      context: { region: "GB", year: 2024 },
      metrics: {
        electricity_kwh: dp(5_000),
        electricity_renewable_pct: dp(100),
        diesel_litres: dp(0),
        natural_gas_m3: dp(0),
        petrol_litres: MISSING,
        employees_total: dp(0),
        employees_women: dp(0),
        injuries_recordable: dp(0),
        hours_worked_total: dp(0),
        training_hours_total: dp(0),
        board_size: dp(3),
        board_independent: dp(1),
        policy_anti_corruption: dp(0),
        policy_whistleblower: dp(0),
        policy_data_privacy: dp(0),
        supplier_spend_total: dp(10_000),
        business_travel_km: dp(0),
      },
    },
    expected: {
      scores: { overall: 51, e: 100, s: 35, g: 16.666666666666664 },
      emissions: {
        scope1: { value: 0, unit: "tCO2e", quality: "calculated" },
        scope2: {
          value: 1.035,
          unit: "tCO2e",
          quality: "calculated",
          factorId: "f-grid-gb-2024",
        },
        scope3: { value: 4.5, unit: "tCO2e", quality: "calculated" },
        total: { value: 5.535, unit: "tCO2e", quality: "calculated" },
      },
      dataQualityPct: 94,
      factorsUsed: [
        {
          factorId: "f-diesel-gb-2024",
          key: "diesel",
          value: 2.51233,
          source: "DEFRA",
          year: 2024,
        },
        {
          factorId: "f-gas-gb-2024",
          key: "natural_gas",
          value: 2.04572,
          source: "DEFRA",
          year: 2024,
        },
        {
          factorId: "f-grid-gb-2024",
          key: "grid_electricity",
          value: 0.207,
          source: "DEFRA",
          year: 2024,
        },
        {
          factorId: "f-spend-gb-2024",
          key: "spend_purchased_goods",
          value: 0.45,
          source: "DEFRA",
          year: 2024,
        },
        {
          factorId: "f-travel-gb-2024",
          key: "business_travel_avg",
          value: 0.17,
          source: "DEFRA",
          year: 2024,
        },
      ],
      breakdown: [
        {
          component: "scope1_diesel",
          contribution: 0,
          explanation: "Diesel contributed 0 tCO2e (0% of Scope 1).",
        },
        {
          component: "scope1_natural_gas",
          contribution: 0,
          explanation: "Natural gas contributed 0 tCO2e (0% of Scope 1).",
        },
        {
          component: "scope2_electricity",
          contribution: 1.03,
          explanation: "Grid electricity contributed 1.03 tCO2e (100% of Scope 2).",
        },
        {
          component: "scope3_supplier_spend",
          contribution: 4.5,
          explanation: "Supplier spend contributed 4.5 tCO2e (100% of Scope 3).",
        },
        {
          component: "scope3_business_travel",
          contribution: 0,
          explanation: "Business travel contributed 0 tCO2e (0% of Scope 3).",
        },
        {
          component: "e_carbon_intensity",
          contribution: 0,
          explanation:
            "Carbon intensity of 0 tCO2e per employee reduced the E score by 0 points.",
        },
        {
          component: "e_renewable_share",
          contribution: 15,
          explanation:
            "Renewable electricity share of 100% added 15 points to the E score.",
        },
        {
          component: "s_diversity",
          contribution: 0,
          explanation: "Workforce diversity of 0% contributed 0 points to the S score.",
        },
        {
          component: "s_injury_rate",
          contribution: 35,
          explanation:
            "Injury rate of 0 per 200,000 hours worked contributed 35 points to the S score.",
        },
        {
          component: "s_training",
          contribution: 0,
          explanation: "Training of 0 hours per employee added 0 points to the S score.",
        },
        {
          component: "g_board_independence",
          contribution: 16.67,
          explanation:
            "Board independence of 33.33% contributed 16.67 points to the G score.",
        },
        {
          component: "g_policies",
          contribution: 0,
          explanation:
            "0 of 3 governance policies in force contributed 0 points to the G score.",
        },
      ],
      band: "moderate",
    },
  },
  {
    name: "missing-everything",
    description:
      "Every metric present but unentered (quality: missing) — the honesty floor.",
    input: {
      context: { region: "GB", year: 2024 },
      metrics: {
        electricity_kwh: MISSING,
        electricity_renewable_pct: MISSING,
        diesel_litres: MISSING,
        natural_gas_m3: MISSING,
        petrol_litres: MISSING,
        employees_total: MISSING,
        employees_women: MISSING,
        injuries_recordable: MISSING,
        hours_worked_total: MISSING,
        training_hours_total: MISSING,
        board_size: MISSING,
        board_independent: MISSING,
        policy_anti_corruption: MISSING,
        policy_whistleblower: MISSING,
        policy_data_privacy: MISSING,
        supplier_spend_total: MISSING,
        business_travel_km: MISSING,
      },
    },
    expected: {
      scores: { overall: 45, e: 100, s: 35, g: 0 },
      emissions: {
        scope1: { value: 0, unit: "tCO2e", quality: "missing" },
        scope2: { value: 0, unit: "tCO2e", quality: "missing" },
        scope3: { value: 0, unit: "tCO2e", quality: "missing" },
        total: { value: 0, unit: "tCO2e", quality: "missing" },
      },
      dataQualityPct: 0,
      factorsUsed: [],
      breakdown: [
        {
          component: "e_carbon_intensity",
          contribution: 0,
          explanation:
            "Carbon intensity of 0 tCO2e per employee reduced the E score by 0 points.",
        },
        {
          component: "e_renewable_share",
          contribution: 0,
          explanation: "Renewable electricity share of 0% added 0 points to the E score.",
        },
        {
          component: "s_diversity",
          contribution: 0,
          explanation: "Workforce diversity of 0% contributed 0 points to the S score.",
        },
        {
          component: "s_injury_rate",
          contribution: 35,
          explanation:
            "Injury rate of 0 per 200,000 hours worked contributed 35 points to the S score.",
        },
        {
          component: "s_training",
          contribution: 0,
          explanation: "Training of 0 hours per employee added 0 points to the S score.",
        },
        {
          component: "g_board_independence",
          contribution: 0,
          explanation: "Board independence of 0% contributed 0 points to the G score.",
        },
        {
          component: "g_policies",
          contribution: 0,
          explanation:
            "0 of 3 governance policies in force contributed 0 points to the G score.",
        },
      ],
      band: "moderate",
    },
  },
  {
    name: "hundred-percent-renewable",
    description: "No fossil Scope 1 at all; 100% renewable electricity.",
    input: {
      context: { region: "GB", year: 2024 },
      metrics: {
        electricity_kwh: dp(200_000),
        electricity_renewable_pct: dp(100),
        diesel_litres: MISSING,
        natural_gas_m3: MISSING,
        petrol_litres: MISSING,
        employees_total: dp(50),
        employees_women: dp(25),
        injuries_recordable: dp(0),
        hours_worked_total: dp(90_000),
        training_hours_total: dp(500),
        board_size: dp(5),
        board_independent: dp(5),
        policy_anti_corruption: dp(1),
        policy_whistleblower: dp(1),
        policy_data_privacy: dp(1),
        supplier_spend_total: dp(0),
        business_travel_km: dp(2_000),
      },
    },
    expected: {
      scores: { overall: 98, e: 100, s: 92.5, g: 100 },
      emissions: {
        scope1: { value: 0, unit: "tCO2e", quality: "missing" },
        scope2: {
          value: 41.4,
          unit: "tCO2e",
          quality: "calculated",
          factorId: "f-grid-gb-2024",
        },
        scope3: { value: 0.34, unit: "tCO2e", quality: "calculated" },
        total: { value: 41.74, unit: "tCO2e", quality: "calculated" },
      },
      dataQualityPct: 82,
      factorsUsed: [
        {
          factorId: "f-grid-gb-2024",
          key: "grid_electricity",
          value: 0.207,
          source: "DEFRA",
          year: 2024,
        },
        {
          factorId: "f-spend-gb-2024",
          key: "spend_purchased_goods",
          value: 0.45,
          source: "DEFRA",
          year: 2024,
        },
        {
          factorId: "f-travel-gb-2024",
          key: "business_travel_avg",
          value: 0.17,
          source: "DEFRA",
          year: 2024,
        },
      ],
      breakdown: [
        {
          component: "scope2_electricity",
          contribution: 41.4,
          explanation: "Grid electricity contributed 41.4 tCO2e (100% of Scope 2).",
        },
        {
          component: "scope3_supplier_spend",
          contribution: 0,
          explanation: "Supplier spend contributed 0 tCO2e (0% of Scope 3).",
        },
        {
          component: "scope3_business_travel",
          contribution: 0.34,
          explanation: "Business travel contributed 0.34 tCO2e (100% of Scope 3).",
        },
        {
          component: "e_carbon_intensity",
          contribution: 0,
          explanation:
            "Carbon intensity of 0.83 tCO2e per employee reduced the E score by 0 points.",
        },
        {
          component: "e_renewable_share",
          contribution: 15,
          explanation:
            "Renewable electricity share of 100% added 15 points to the E score.",
        },
        {
          component: "s_diversity",
          contribution: 55,
          explanation: "Workforce diversity of 50% contributed 55 points to the S score.",
        },
        {
          component: "s_injury_rate",
          contribution: 35,
          explanation:
            "Injury rate of 0 per 200,000 hours worked contributed 35 points to the S score.",
        },
        {
          component: "s_training",
          contribution: 2.5,
          explanation:
            "Training of 10 hours per employee added 2.5 points to the S score.",
        },
        {
          component: "g_board_independence",
          contribution: 50,
          explanation: "Board independence of 100% contributed 50 points to the G score.",
        },
        {
          component: "g_policies",
          contribution: 50,
          explanation:
            "3 of 3 governance policies in force contributed 50 points to the G score.",
        },
      ],
      band: "strong",
    },
  },
  {
    name: "extreme-high-emissions",
    description:
      "Outlier: tiny headcount against huge diesel/gas volumes — clamps hit at 0.",
    input: {
      context: { region: "GB", year: 2024 },
      metrics: {
        electricity_kwh: dp(50_000),
        electricity_renewable_pct: dp(0),
        diesel_litres: dp(500_000),
        natural_gas_m3: dp(200_000),
        petrol_litres: MISSING,
        employees_total: dp(10),
        employees_women: dp(2),
        injuries_recordable: dp(5),
        hours_worked_total: dp(18_000),
        training_hours_total: dp(0),
        board_size: dp(2),
        board_independent: dp(0),
        policy_anti_corruption: dp(0),
        policy_whistleblower: dp(0),
        policy_data_privacy: dp(0),
        supplier_spend_total: dp(1_000_000),
        business_travel_km: MISSING,
      },
    },
    expected: {
      scores: { overall: 9, e: 0, s: 27.5, g: 0 },
      emissions: {
        scope1: { value: 1665.309, unit: "tCO2e", quality: "calculated" },
        scope2: {
          value: 10.35,
          unit: "tCO2e",
          quality: "calculated",
          factorId: "f-grid-gb-2024",
        },
        scope3: {
          value: 450,
          unit: "tCO2e",
          quality: "calculated",
          factorId: "f-spend-gb-2024",
        },
        total: { value: 2125.6589999999997, unit: "tCO2e", quality: "calculated" },
      },
      dataQualityPct: 88,
      factorsUsed: [
        {
          factorId: "f-diesel-gb-2024",
          key: "diesel",
          value: 2.51233,
          source: "DEFRA",
          year: 2024,
        },
        {
          factorId: "f-gas-gb-2024",
          key: "natural_gas",
          value: 2.04572,
          source: "DEFRA",
          year: 2024,
        },
        {
          factorId: "f-grid-gb-2024",
          key: "grid_electricity",
          value: 0.207,
          source: "DEFRA",
          year: 2024,
        },
        {
          factorId: "f-spend-gb-2024",
          key: "spend_purchased_goods",
          value: 0.45,
          source: "DEFRA",
          year: 2024,
        },
      ],
      breakdown: [
        {
          component: "scope1_diesel",
          contribution: 1256.17,
          explanation: "Diesel contributed 1256.17 tCO2e (75.43% of Scope 1).",
        },
        {
          component: "scope1_natural_gas",
          contribution: 409.14,
          explanation: "Natural gas contributed 409.14 tCO2e (24.57% of Scope 1).",
        },
        {
          component: "scope2_electricity",
          contribution: 10.35,
          explanation: "Grid electricity contributed 10.35 tCO2e (100% of Scope 2).",
        },
        {
          component: "scope3_supplier_spend",
          contribution: 450,
          explanation: "Supplier spend contributed 450 tCO2e (100% of Scope 3).",
        },
        {
          component: "e_carbon_intensity",
          contribution: -2538.79,
          explanation:
            "Carbon intensity of 212.57 tCO2e per employee reduced the E score by 2538.79 points.",
        },
        {
          component: "e_renewable_share",
          contribution: 0,
          explanation: "Renewable electricity share of 0% added 0 points to the E score.",
        },
        {
          component: "s_diversity",
          contribution: 27.5,
          explanation:
            "Workforce diversity of 20% contributed 27.5 points to the S score.",
        },
        {
          component: "s_injury_rate",
          contribution: 0,
          explanation:
            "Injury rate of 55.56 per 200,000 hours worked contributed 0 points to the S score.",
        },
        {
          component: "s_training",
          contribution: 0,
          explanation: "Training of 0 hours per employee added 0 points to the S score.",
        },
        {
          component: "g_board_independence",
          contribution: 0,
          explanation: "Board independence of 0% contributed 0 points to the G score.",
        },
        {
          component: "g_policies",
          contribution: 0,
          explanation:
            "0 of 3 governance policies in force contributed 0 points to the G score.",
        },
      ],
      band: "early",
    },
  },
  {
    name: "extreme-large-org",
    description: "Outlier: very large headcount keeps carbon-per-employee near zero.",
    input: {
      context: { region: "GB", year: 2024 },
      metrics: {
        electricity_kwh: dp(1_000_000),
        electricity_renewable_pct: dp(30),
        diesel_litres: dp(2_000),
        natural_gas_m3: dp(1_000),
        petrol_litres: dp(0),
        employees_total: dp(5_000),
        employees_women: dp(2_500),
        injuries_recordable: dp(1),
        hours_worked_total: dp(9_000_000),
        training_hours_total: dp(50_000),
        board_size: dp(10),
        board_independent: dp(7),
        policy_anti_corruption: dp(1),
        policy_whistleblower: dp(1),
        policy_data_privacy: dp(0),
        supplier_spend_total: MISSING,
        business_travel_km: dp(300_000),
      },
    },
    expected: {
      scores: { overall: 87, e: 100, s: 92.32222222222222, g: 68.33333333333334 },
      emissions: {
        scope1: { value: 7.07038, unit: "tCO2e", quality: "calculated" },
        scope2: {
          value: 207,
          unit: "tCO2e",
          quality: "calculated",
          factorId: "f-grid-gb-2024",
        },
        scope3: {
          value: 51.00000000000001,
          unit: "tCO2e",
          quality: "calculated",
          factorId: "f-travel-gb-2024",
        },
        total: { value: 265.07038, unit: "tCO2e", quality: "calculated" },
      },
      dataQualityPct: 94,
      factorsUsed: [
        {
          factorId: "f-diesel-gb-2024",
          key: "diesel",
          value: 2.51233,
          source: "DEFRA",
          year: 2024,
        },
        {
          factorId: "f-gas-gb-2024",
          key: "natural_gas",
          value: 2.04572,
          source: "DEFRA",
          year: 2024,
        },
        {
          factorId: "f-petrol-gb-2024",
          key: "petrol",
          value: 2.0844,
          source: "DEFRA",
          year: 2024,
        },
        {
          factorId: "f-grid-gb-2024",
          key: "grid_electricity",
          value: 0.207,
          source: "DEFRA",
          year: 2024,
        },
        {
          factorId: "f-travel-gb-2024",
          key: "business_travel_avg",
          value: 0.17,
          source: "DEFRA",
          year: 2024,
        },
      ],
      breakdown: [
        {
          component: "scope1_diesel",
          contribution: 5.02,
          explanation: "Diesel contributed 5.02 tCO2e (71.07% of Scope 1).",
        },
        {
          component: "scope1_natural_gas",
          contribution: 2.05,
          explanation: "Natural gas contributed 2.05 tCO2e (28.93% of Scope 1).",
        },
        {
          component: "scope1_petrol",
          contribution: 0,
          explanation: "Petrol contributed 0 tCO2e (0% of Scope 1).",
        },
        {
          component: "scope2_electricity",
          contribution: 207,
          explanation: "Grid electricity contributed 207 tCO2e (100% of Scope 2).",
        },
        {
          component: "scope3_business_travel",
          contribution: 51,
          explanation: "Business travel contributed 51 tCO2e (100% of Scope 3).",
        },
        {
          component: "e_carbon_intensity",
          contribution: 0,
          explanation:
            "Carbon intensity of 0.05 tCO2e per employee reduced the E score by 0 points.",
        },
        {
          component: "e_renewable_share",
          contribution: 4.5,
          explanation:
            "Renewable electricity share of 30% added 4.5 points to the E score.",
        },
        {
          component: "s_diversity",
          contribution: 55,
          explanation: "Workforce diversity of 50% contributed 55 points to the S score.",
        },
        {
          component: "s_injury_rate",
          contribution: 34.82,
          explanation:
            "Injury rate of 0.02 per 200,000 hours worked contributed 34.82 points to the S score.",
        },
        {
          component: "s_training",
          contribution: 2.5,
          explanation:
            "Training of 10 hours per employee added 2.5 points to the S score.",
        },
        {
          component: "g_board_independence",
          contribution: 35,
          explanation: "Board independence of 70% contributed 35 points to the G score.",
        },
        {
          component: "g_policies",
          contribution: 33.33,
          explanation:
            "2 of 3 governance policies in force contributed 33.33 points to the G score.",
        },
      ],
      band: "strong",
    },
  },
  {
    name: "perfect-governance",
    description:
      "Fully independent board + all three policies in force — G clamps at exactly 100.",
    input: {
      context: { region: "GB", year: 2024 },
      metrics: {
        electricity_kwh: dp(10_000),
        electricity_renewable_pct: dp(50),
        diesel_litres: dp(100),
        natural_gas_m3: dp(50),
        petrol_litres: dp(0),
        employees_total: dp(20),
        employees_women: dp(10),
        injuries_recordable: dp(0),
        hours_worked_total: dp(36_000),
        training_hours_total: dp(200),
        board_size: dp(4),
        board_independent: dp(4),
        policy_anti_corruption: dp(1),
        policy_whistleblower: dp(1),
        policy_data_privacy: dp(1),
        supplier_spend_total: dp(5_000),
        business_travel_km: dp(1_000),
      },
    },
    expected: {
      scores: { overall: 98, e: 100, s: 92.5, g: 100 },
      emissions: {
        scope1: { value: 0.353519, unit: "tCO2e", quality: "calculated" },
        scope2: {
          value: 2.07,
          unit: "tCO2e",
          quality: "calculated",
          factorId: "f-grid-gb-2024",
        },
        scope3: { value: 2.42, unit: "tCO2e", quality: "calculated" },
        total: { value: 4.843519, unit: "tCO2e", quality: "calculated" },
      },
      dataQualityPct: 100,
      factorsUsed: [
        {
          factorId: "f-diesel-gb-2024",
          key: "diesel",
          value: 2.51233,
          source: "DEFRA",
          year: 2024,
        },
        {
          factorId: "f-gas-gb-2024",
          key: "natural_gas",
          value: 2.04572,
          source: "DEFRA",
          year: 2024,
        },
        {
          factorId: "f-petrol-gb-2024",
          key: "petrol",
          value: 2.0844,
          source: "DEFRA",
          year: 2024,
        },
        {
          factorId: "f-grid-gb-2024",
          key: "grid_electricity",
          value: 0.207,
          source: "DEFRA",
          year: 2024,
        },
        {
          factorId: "f-spend-gb-2024",
          key: "spend_purchased_goods",
          value: 0.45,
          source: "DEFRA",
          year: 2024,
        },
        {
          factorId: "f-travel-gb-2024",
          key: "business_travel_avg",
          value: 0.17,
          source: "DEFRA",
          year: 2024,
        },
      ],
      breakdown: [
        {
          component: "scope1_diesel",
          contribution: 0.25,
          explanation: "Diesel contributed 0.25 tCO2e (71.07% of Scope 1).",
        },
        {
          component: "scope1_natural_gas",
          contribution: 0.1,
          explanation: "Natural gas contributed 0.1 tCO2e (28.93% of Scope 1).",
        },
        {
          component: "scope1_petrol",
          contribution: 0,
          explanation: "Petrol contributed 0 tCO2e (0% of Scope 1).",
        },
        {
          component: "scope2_electricity",
          contribution: 2.07,
          explanation: "Grid electricity contributed 2.07 tCO2e (100% of Scope 2).",
        },
        {
          component: "scope3_supplier_spend",
          contribution: 2.25,
          explanation: "Supplier spend contributed 2.25 tCO2e (92.98% of Scope 3).",
        },
        {
          component: "scope3_business_travel",
          contribution: 0.17,
          explanation: "Business travel contributed 0.17 tCO2e (7.02% of Scope 3).",
        },
        {
          component: "e_carbon_intensity",
          contribution: 0,
          explanation:
            "Carbon intensity of 0.24 tCO2e per employee reduced the E score by 0 points.",
        },
        {
          component: "e_renewable_share",
          contribution: 7.5,
          explanation:
            "Renewable electricity share of 50% added 7.5 points to the E score.",
        },
        {
          component: "s_diversity",
          contribution: 55,
          explanation: "Workforce diversity of 50% contributed 55 points to the S score.",
        },
        {
          component: "s_injury_rate",
          contribution: 35,
          explanation:
            "Injury rate of 0 per 200,000 hours worked contributed 35 points to the S score.",
        },
        {
          component: "s_training",
          contribution: 2.5,
          explanation:
            "Training of 10 hours per employee added 2.5 points to the S score.",
        },
        {
          component: "g_board_independence",
          contribution: 50,
          explanation: "Board independence of 100% contributed 50 points to the G score.",
        },
        {
          component: "g_policies",
          contribution: 50,
          explanation:
            "3 of 3 governance policies in force contributed 50 points to the G score.",
        },
      ],
      band: "strong",
    },
  },
  {
    name: "zero-governance",
    description: "No independent directors, no policies in force — G is exactly 0.",
    input: {
      context: { region: "GB", year: 2024 },
      metrics: {
        electricity_kwh: dp(10_000),
        electricity_renewable_pct: dp(50),
        diesel_litres: dp(100),
        natural_gas_m3: dp(50),
        petrol_litres: MISSING,
        employees_total: dp(20),
        employees_women: dp(10),
        injuries_recordable: dp(0),
        hours_worked_total: dp(36_000),
        training_hours_total: dp(200),
        board_size: dp(5),
        board_independent: dp(0),
        policy_anti_corruption: dp(0),
        policy_whistleblower: dp(0),
        policy_data_privacy: dp(0),
        supplier_spend_total: dp(5_000),
        business_travel_km: dp(1_000),
      },
    },
    expected: {
      scores: { overall: 64, e: 100, s: 92.5, g: 0 },
      emissions: {
        scope1: { value: 0.353519, unit: "tCO2e", quality: "calculated" },
        scope2: {
          value: 2.07,
          unit: "tCO2e",
          quality: "calculated",
          factorId: "f-grid-gb-2024",
        },
        scope3: { value: 2.42, unit: "tCO2e", quality: "calculated" },
        total: { value: 4.843519, unit: "tCO2e", quality: "calculated" },
      },
      dataQualityPct: 94,
      factorsUsed: [
        {
          factorId: "f-diesel-gb-2024",
          key: "diesel",
          value: 2.51233,
          source: "DEFRA",
          year: 2024,
        },
        {
          factorId: "f-gas-gb-2024",
          key: "natural_gas",
          value: 2.04572,
          source: "DEFRA",
          year: 2024,
        },
        {
          factorId: "f-grid-gb-2024",
          key: "grid_electricity",
          value: 0.207,
          source: "DEFRA",
          year: 2024,
        },
        {
          factorId: "f-spend-gb-2024",
          key: "spend_purchased_goods",
          value: 0.45,
          source: "DEFRA",
          year: 2024,
        },
        {
          factorId: "f-travel-gb-2024",
          key: "business_travel_avg",
          value: 0.17,
          source: "DEFRA",
          year: 2024,
        },
      ],
      breakdown: [
        {
          component: "scope1_diesel",
          contribution: 0.25,
          explanation: "Diesel contributed 0.25 tCO2e (71.07% of Scope 1).",
        },
        {
          component: "scope1_natural_gas",
          contribution: 0.1,
          explanation: "Natural gas contributed 0.1 tCO2e (28.93% of Scope 1).",
        },
        {
          component: "scope2_electricity",
          contribution: 2.07,
          explanation: "Grid electricity contributed 2.07 tCO2e (100% of Scope 2).",
        },
        {
          component: "scope3_supplier_spend",
          contribution: 2.25,
          explanation: "Supplier spend contributed 2.25 tCO2e (92.98% of Scope 3).",
        },
        {
          component: "scope3_business_travel",
          contribution: 0.17,
          explanation: "Business travel contributed 0.17 tCO2e (7.02% of Scope 3).",
        },
        {
          component: "e_carbon_intensity",
          contribution: 0,
          explanation:
            "Carbon intensity of 0.24 tCO2e per employee reduced the E score by 0 points.",
        },
        {
          component: "e_renewable_share",
          contribution: 7.5,
          explanation:
            "Renewable electricity share of 50% added 7.5 points to the E score.",
        },
        {
          component: "s_diversity",
          contribution: 55,
          explanation: "Workforce diversity of 50% contributed 55 points to the S score.",
        },
        {
          component: "s_injury_rate",
          contribution: 35,
          explanation:
            "Injury rate of 0 per 200,000 hours worked contributed 35 points to the S score.",
        },
        {
          component: "s_training",
          contribution: 2.5,
          explanation:
            "Training of 10 hours per employee added 2.5 points to the S score.",
        },
        {
          component: "g_board_independence",
          contribution: 0,
          explanation: "Board independence of 0% contributed 0 points to the G score.",
        },
        {
          component: "g_policies",
          contribution: 0,
          explanation:
            "0 of 3 governance policies in force contributed 0 points to the G score.",
        },
      ],
      band: "moderate",
    },
  },
  {
    name: "partial-data-quality",
    description: "A realistic mix of measured, estimated, and missing datapoints.",
    input: {
      context: { region: "GB", year: 2024 },
      metrics: {
        electricity_kwh: dp(30_000, "estimated"),
        electricity_renewable_pct: MISSING,
        diesel_litres: dp(1_000),
        natural_gas_m3: MISSING,
        petrol_litres: dp(200, "estimated"),
        employees_total: dp(60),
        employees_women: MISSING,
        injuries_recordable: dp(0),
        hours_worked_total: dp(108_000),
        training_hours_total: MISSING,
        board_size: dp(5),
        board_independent: dp(3, "estimated"),
        policy_anti_corruption: dp(1),
        policy_whistleblower: MISSING,
        policy_data_privacy: dp(0),
        supplier_spend_total: dp(200_000),
        business_travel_km: MISSING,
      },
    },
    expected: {
      scores: { overall: 58, e: 92.172158, s: 35, g: 46.66666666666667 },
      emissions: {
        scope1: { value: 2.92921, unit: "tCO2e", quality: "calculated" },
        scope2: {
          value: 6.21,
          unit: "tCO2e",
          quality: "calculated",
          factorId: "f-grid-gb-2024",
        },
        scope3: {
          value: 90,
          unit: "tCO2e",
          quality: "calculated",
          factorId: "f-spend-gb-2024",
        },
        total: { value: 99.13921, unit: "tCO2e", quality: "calculated" },
      },
      dataQualityPct: 65,
      factorsUsed: [
        {
          factorId: "f-diesel-gb-2024",
          key: "diesel",
          value: 2.51233,
          source: "DEFRA",
          year: 2024,
        },
        {
          factorId: "f-petrol-gb-2024",
          key: "petrol",
          value: 2.0844,
          source: "DEFRA",
          year: 2024,
        },
        {
          factorId: "f-grid-gb-2024",
          key: "grid_electricity",
          value: 0.207,
          source: "DEFRA",
          year: 2024,
        },
        {
          factorId: "f-spend-gb-2024",
          key: "spend_purchased_goods",
          value: 0.45,
          source: "DEFRA",
          year: 2024,
        },
      ],
      breakdown: [
        {
          component: "scope1_diesel",
          contribution: 2.51,
          explanation: "Diesel contributed 2.51 tCO2e (85.77% of Scope 1).",
        },
        {
          component: "scope1_petrol",
          contribution: 0.42,
          explanation: "Petrol contributed 0.42 tCO2e (14.23% of Scope 1).",
        },
        {
          component: "scope2_electricity",
          contribution: 6.21,
          explanation: "Grid electricity contributed 6.21 tCO2e (100% of Scope 2).",
        },
        {
          component: "scope3_supplier_spend",
          contribution: 90,
          explanation: "Supplier spend contributed 90 tCO2e (100% of Scope 3).",
        },
        {
          component: "e_carbon_intensity",
          contribution: -7.83,
          explanation:
            "Carbon intensity of 1.65 tCO2e per employee reduced the E score by 7.83 points.",
        },
        {
          component: "e_renewable_share",
          contribution: 0,
          explanation: "Renewable electricity share of 0% added 0 points to the E score.",
        },
        {
          component: "s_diversity",
          contribution: 0,
          explanation: "Workforce diversity of 0% contributed 0 points to the S score.",
        },
        {
          component: "s_injury_rate",
          contribution: 35,
          explanation:
            "Injury rate of 0 per 200,000 hours worked contributed 35 points to the S score.",
        },
        {
          component: "s_training",
          contribution: 0,
          explanation: "Training of 0 hours per employee added 0 points to the S score.",
        },
        {
          component: "g_board_independence",
          contribution: 30,
          explanation: "Board independence of 60% contributed 30 points to the G score.",
        },
        {
          component: "g_policies",
          contribution: 16.67,
          explanation:
            "1 of 3 governance policies in force contributed 16.67 points to the G score.",
        },
      ],
      band: "moderate",
    },
  },
  {
    name: "high-injury-rate",
    description: "Injury rate high enough to clamp the S injury term to 0.",
    input: {
      context: { region: "GB", year: 2024 },
      metrics: {
        electricity_kwh: dp(40_000),
        electricity_renewable_pct: dp(10),
        diesel_litres: dp(1_000),
        natural_gas_m3: dp(500),
        petrol_litres: dp(100),
        employees_total: dp(80),
        employees_women: dp(40),
        injuries_recordable: dp(50),
        hours_worked_total: dp(200_000),
        training_hours_total: dp(1_600),
        board_size: dp(6),
        board_independent: dp(2),
        policy_anti_corruption: dp(1),
        policy_whistleblower: dp(0),
        policy_data_privacy: dp(0),
        supplier_spend_total: MISSING,
        business_travel_km: dp(5_000),
      },
    },
    expected: {
      scores: { overall: 64, e: 100, s: 60, g: 33.33333333333333 },
      emissions: {
        scope1: { value: 3.74363, unit: "tCO2e", quality: "calculated" },
        scope2: {
          value: 8.28,
          unit: "tCO2e",
          quality: "calculated",
          factorId: "f-grid-gb-2024",
        },
        scope3: {
          value: 0.8500000000000001,
          unit: "tCO2e",
          quality: "calculated",
          factorId: "f-travel-gb-2024",
        },
        total: { value: 12.873629999999999, unit: "tCO2e", quality: "calculated" },
      },
      dataQualityPct: 94,
      factorsUsed: [
        {
          factorId: "f-diesel-gb-2024",
          key: "diesel",
          value: 2.51233,
          source: "DEFRA",
          year: 2024,
        },
        {
          factorId: "f-gas-gb-2024",
          key: "natural_gas",
          value: 2.04572,
          source: "DEFRA",
          year: 2024,
        },
        {
          factorId: "f-petrol-gb-2024",
          key: "petrol",
          value: 2.0844,
          source: "DEFRA",
          year: 2024,
        },
        {
          factorId: "f-grid-gb-2024",
          key: "grid_electricity",
          value: 0.207,
          source: "DEFRA",
          year: 2024,
        },
        {
          factorId: "f-travel-gb-2024",
          key: "business_travel_avg",
          value: 0.17,
          source: "DEFRA",
          year: 2024,
        },
      ],
      breakdown: [
        {
          component: "scope1_diesel",
          contribution: 2.51,
          explanation: "Diesel contributed 2.51 tCO2e (67.11% of Scope 1).",
        },
        {
          component: "scope1_natural_gas",
          contribution: 1.02,
          explanation: "Natural gas contributed 1.02 tCO2e (27.32% of Scope 1).",
        },
        {
          component: "scope1_petrol",
          contribution: 0.21,
          explanation: "Petrol contributed 0.21 tCO2e (5.57% of Scope 1).",
        },
        {
          component: "scope2_electricity",
          contribution: 8.28,
          explanation: "Grid electricity contributed 8.28 tCO2e (100% of Scope 2).",
        },
        {
          component: "scope3_business_travel",
          contribution: 0.85,
          explanation: "Business travel contributed 0.85 tCO2e (100% of Scope 3).",
        },
        {
          component: "e_carbon_intensity",
          contribution: 0,
          explanation:
            "Carbon intensity of 0.16 tCO2e per employee reduced the E score by 0 points.",
        },
        {
          component: "e_renewable_share",
          contribution: 1.5,
          explanation:
            "Renewable electricity share of 10% added 1.5 points to the E score.",
        },
        {
          component: "s_diversity",
          contribution: 55,
          explanation: "Workforce diversity of 50% contributed 55 points to the S score.",
        },
        {
          component: "s_injury_rate",
          contribution: 0,
          explanation:
            "Injury rate of 50 per 200,000 hours worked contributed 0 points to the S score.",
        },
        {
          component: "s_training",
          contribution: 5,
          explanation: "Training of 20 hours per employee added 5 points to the S score.",
        },
        {
          component: "g_board_independence",
          contribution: 16.67,
          explanation:
            "Board independence of 33.33% contributed 16.67 points to the G score.",
        },
        {
          component: "g_policies",
          contribution: 16.67,
          explanation:
            "1 of 3 governance policies in force contributed 16.67 points to the G score.",
        },
      ],
      band: "moderate",
    },
  },
  {
    name: "petrol-only-scope1",
    description: "Only petrol present in Scope 1 — diesel and gas both missing.",
    input: {
      context: { region: "GB", year: 2024 },
      metrics: {
        electricity_kwh: dp(60_000),
        electricity_renewable_pct: dp(25),
        diesel_litres: MISSING,
        natural_gas_m3: MISSING,
        petrol_litres: dp(1_200),
        employees_total: dp(35),
        employees_women: dp(14),
        injuries_recordable: dp(1),
        hours_worked_total: dp(63_000),
        training_hours_total: dp(400),
        board_size: dp(5),
        board_independent: dp(2),
        policy_anti_corruption: dp(0),
        policy_whistleblower: dp(1),
        policy_data_privacy: dp(1),
        supplier_spend_total: dp(90_000),
        business_travel_km: dp(8_000),
      },
    },
    expected: {
      scores: {
        overall: 72,
        e: 96.28213257142858,
        s: 67.46031746031747,
        g: 53.333333333333336,
      },
      emissions: {
        scope1: {
          value: 2.5012800000000004,
          unit: "tCO2e",
          quality: "calculated",
          factorId: "f-petrol-gb-2024",
        },
        scope2: {
          value: 12.42,
          unit: "tCO2e",
          quality: "calculated",
          factorId: "f-grid-gb-2024",
        },
        scope3: { value: 41.86, unit: "tCO2e", quality: "calculated" },
        total: { value: 56.781279999999995, unit: "tCO2e", quality: "calculated" },
      },
      dataQualityPct: 88,
      factorsUsed: [
        {
          factorId: "f-petrol-gb-2024",
          key: "petrol",
          value: 2.0844,
          source: "DEFRA",
          year: 2024,
        },
        {
          factorId: "f-grid-gb-2024",
          key: "grid_electricity",
          value: 0.207,
          source: "DEFRA",
          year: 2024,
        },
        {
          factorId: "f-spend-gb-2024",
          key: "spend_purchased_goods",
          value: 0.45,
          source: "DEFRA",
          year: 2024,
        },
        {
          factorId: "f-travel-gb-2024",
          key: "business_travel_avg",
          value: 0.17,
          source: "DEFRA",
          year: 2024,
        },
      ],
      breakdown: [
        {
          component: "scope1_petrol",
          contribution: 2.5,
          explanation: "Petrol contributed 2.5 tCO2e (100% of Scope 1).",
        },
        {
          component: "scope2_electricity",
          contribution: 12.42,
          explanation: "Grid electricity contributed 12.42 tCO2e (100% of Scope 2).",
        },
        {
          component: "scope3_supplier_spend",
          contribution: 40.5,
          explanation: "Supplier spend contributed 40.5 tCO2e (96.75% of Scope 3).",
        },
        {
          component: "scope3_business_travel",
          contribution: 1.36,
          explanation: "Business travel contributed 1.36 tCO2e (3.25% of Scope 3).",
        },
        {
          component: "e_carbon_intensity",
          contribution: -7.47,
          explanation:
            "Carbon intensity of 1.62 tCO2e per employee reduced the E score by 7.47 points.",
        },
        {
          component: "e_renewable_share",
          contribution: 3.75,
          explanation:
            "Renewable electricity share of 25% added 3.75 points to the E score.",
        },
        {
          component: "s_diversity",
          contribution: 55,
          explanation: "Workforce diversity of 40% contributed 55 points to the S score.",
        },
        {
          component: "s_injury_rate",
          contribution: 9.6,
          explanation:
            "Injury rate of 3.17 per 200,000 hours worked contributed 9.6 points to the S score.",
        },
        {
          component: "s_training",
          contribution: 2.86,
          explanation:
            "Training of 11.43 hours per employee added 2.86 points to the S score.",
        },
        {
          component: "g_board_independence",
          contribution: 20,
          explanation: "Board independence of 40% contributed 20 points to the G score.",
        },
        {
          component: "g_policies",
          contribution: 33.33,
          explanation:
            "2 of 3 governance policies in force contributed 33.33 points to the G score.",
        },
      ],
      band: "strong",
    },
  },
];
