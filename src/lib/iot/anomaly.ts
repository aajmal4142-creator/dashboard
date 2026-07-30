import type { AnomalyResult } from "./types";

const MIN_SAMPLES = 5;
const SIGMA_MULTIPLIER = 3;
const BASELINE_MULTIPLIER = 3;

/**
 * Flag anomalies when value is ≈3σ from mean OR ≈3× the baseline (mean).
 * Returns insufficient_data when fewer than 5 prior samples.
 */
export function detectIotAnomaly(value: number, priorValues: number[]): AnomalyResult {
  const samples = priorValues.filter((v) => typeof v === "number" && Number.isFinite(v));
  if (samples.length < MIN_SAMPLES) {
    return {
      isAnomaly: false,
      reason: null,
      mean: null,
      stdDev: null,
      baseline: null,
      method: "insufficient_data",
    };
  }

  const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
  const variance = samples.reduce((acc, v) => acc + (v - mean) ** 2, 0) / samples.length;
  const stdDev = Math.sqrt(variance);
  const baseline = mean;

  if (stdDev > 0 && Math.abs(value - mean) > SIGMA_MULTIPLIER * stdDev) {
    return {
      isAnomaly: true,
      reason: `Value ${value} is beyond ${SIGMA_MULTIPLIER}σ of mean ${mean.toFixed(4)} (σ=${stdDev.toFixed(4)})`,
      mean,
      stdDev,
      baseline,
      method: "three_sigma",
    };
  }

  if (baseline !== 0 && Math.abs(value) > BASELINE_MULTIPLIER * Math.abs(baseline)) {
    return {
      isAnomaly: true,
      reason: `Value ${value} exceeds ${BASELINE_MULTIPLIER}× baseline ${baseline.toFixed(4)}`,
      mean,
      stdDev,
      baseline,
      method: "three_x_baseline",
    };
  }

  // Also flag near-zero baseline spikes (value large while baseline ~0)
  if (
    Math.abs(baseline) < 1e-9 &&
    Math.abs(value) > 0 &&
    samples.every((v) => Math.abs(v) < 1e-9) === false
  ) {
    // no-op: handled by sigma when stdDev > 0
  }

  return {
    isAnomaly: false,
    reason: null,
    mean,
    stdDev,
    baseline,
    method: null,
  };
}
