/**
 * Pure mapping: energy-certificate ledger lines → calc `scope2Instruments`.
 *
 * Consumed by report/home/runway snapshot builders when assembling CalcContext.
 * Zero I/O. Calc never loads certificates itself.
 *
 * Factor convention:
 * - Prefer an explicit `factorKgPerKwh` when stored on the certificate.
 * - Otherwise use 0 kgCO2e/kWh for active renewable claims (REC / GO / EAC /
 *   PPA / green tariff). That is an estimated zero-emission instrument factor,
 *   not a silent inventory zero — unmatched kWh still requires `residual_mix`.
 */
import type { Scope2ContractualInstrument } from "@/lib/calc/types";

import type {
  CertificateStatus,
  CertificateType,
  CertificateVolumeSummary,
} from "./types";

/** Default when no certificate-specific factor is stored (zero-emission claim). */
export const DEFAULT_RENEWABLE_INSTRUMENT_FACTOR_KG_PER_KWH = 0;

export type CertificateInstrumentInput = {
  id: string;
  volumeKwh: number;
  status: CertificateStatus;
  certificateType: CertificateType;
  label?: string | null;
  /** Optional stored instrument factor (kgCO2e/kWh). */
  factorKgPerKwh?: number | null;
  supplier?: string | null;
};

export type MarketBasedHookSummary = {
  coveredKwh: number;
  uncoveredKwh: number | null;
  coverageRatio: number | null;
  instrumentCount: number;
  residualMixAvailable: boolean;
  /**
   * True when market-based Scope 2 can complete for known electricity:
   * residual_mix present, or active instruments fully cover load.
   */
  dualReady: boolean;
  /**
   * `estimated` when any instrument used the default zero-emission factor;
   * `measured` when every active instrument carried an explicit factor.
   */
  instrumentFactorQuality: "measured" | "estimated";
  message: string | null;
};

function instrumentLabel(cert: CertificateInstrumentInput): string {
  if (cert.label && cert.label.trim()) return cert.label.trim();
  const supplier = cert.supplier?.trim();
  if (supplier) return `${cert.certificateType} · ${supplier}`;
  return `${cert.certificateType} ${cert.id}`;
}

function resolveFactorKgPerKwh(cert: CertificateInstrumentInput): {
  factorKgPerKwh: number;
  usedDefault: boolean;
} {
  const stored = cert.factorKgPerKwh;
  if (stored !== null && stored !== undefined && Number.isFinite(stored) && stored >= 0) {
    return { factorKgPerKwh: stored, usedDefault: false };
  }
  return {
    factorKgPerKwh: DEFAULT_RENEWABLE_INSTRUMENT_FACTOR_KG_PER_KWH,
    usedDefault: true,
  };
}

/**
 * Map active certificate lines to contractual instruments for market-based Scope 2.
 * Retired / expired lines are excluded. Non-positive volumes are skipped.
 */
export function certificatesToScope2Instruments(
  certificates: CertificateInstrumentInput[],
): Scope2ContractualInstrument[] {
  const instruments: Scope2ContractualInstrument[] = [];

  for (const cert of certificates) {
    if (cert.status !== "active") continue;
    if (!(cert.volumeKwh > 0) || !Number.isFinite(cert.volumeKwh)) continue;

    const { factorKgPerKwh } = resolveFactorKgPerKwh(cert);
    instruments.push({
      kWh: cert.volumeKwh,
      factorKgPerKwh,
      factorId: cert.id,
      label: instrumentLabel(cert),
    });
  }

  return instruments;
}

/**
 * Whether any active certificate lacked an explicit factor (defaulted to 0).
 */
export function instrumentsUsedDefaultZeroFactor(
  certificates: CertificateInstrumentInput[],
): boolean {
  for (const cert of certificates) {
    if (cert.status !== "active") continue;
    if (!(cert.volumeKwh > 0) || !Number.isFinite(cert.volumeKwh)) continue;
    if (resolveFactorKgPerKwh(cert).usedDefault) return true;
  }
  return false;
}

/**
 * Ledger summary for dual Scope 2 readiness (coverage + residual_mix availability).
 */
export function buildMarketBasedHookSummary(opts: {
  volumes: Pick<
    CertificateVolumeSummary,
    "activeVolumeKwh" | "uncoveredKwh" | "coverageRatio" | "electricityKwh"
  >;
  instrumentCount: number;
  residualMixAvailable: boolean;
  usedDefaultZeroFactor: boolean;
}): MarketBasedHookSummary {
  const { volumes, instrumentCount, residualMixAvailable, usedDefaultZeroFactor } = opts;
  const coveredKwh = volumes.activeVolumeKwh;
  const electricity = volumes.electricityKwh;

  const fullyCovered =
    electricity !== null &&
    electricity > 0 &&
    instrumentCount > 0 &&
    volumes.uncoveredKwh === 0;

  const dualReady =
    electricity !== null && electricity > 0 && (residualMixAvailable || fullyCovered);

  let message: string | null = null;
  if (electricity === null) {
    message =
      "electricity_kwh missing — market-based dual reporting cannot run until load is recorded.";
  } else if (electricity <= 0) {
    message = "electricity_kwh is zero — no Scope 2 load to match.";
  } else if (!residualMixAvailable && !fullyCovered) {
    message =
      instrumentCount === 0
        ? "No active certificates and residual_mix factor missing — market-based Scope 2 is incomplete."
        : "Active certificates leave unmatched kWh and residual_mix factor is missing — market-based Scope 2 is incomplete.";
  } else if (!residualMixAvailable && fullyCovered) {
    message =
      "Load fully covered by active certificates — residual_mix not required for this period.";
  } else if (instrumentCount === 0 && residualMixAvailable) {
    message =
      "No active certificates — market-based Scope 2 will use residual_mix for 100% of electricity.";
  } else if (usedDefaultZeroFactor) {
    message =
      "Active certificates mapped with default 0 kgCO2e/kWh (no stored instrument factor) — treat as estimated.";
  }

  return {
    coveredKwh,
    uncoveredKwh: volumes.uncoveredKwh,
    coverageRatio: volumes.coverageRatio,
    instrumentCount,
    residualMixAvailable,
    dualReady,
    instrumentFactorQuality: usedDefaultZeroFactor ? "estimated" : "measured",
    message,
  };
}
