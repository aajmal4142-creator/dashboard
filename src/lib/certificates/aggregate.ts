import type {
  CertificateQuality,
  CertificateStatus,
  CertificateType,
  CertificateVolumeByType,
  CertificateVolumeInput,
  CertificateVolumeSummary,
} from "./types";

const EMPTY_BY_TYPE: CertificateVolumeByType = {
  REC: 0,
  GO: 0,
  EAC: 0,
  PPA: 0,
  green_tariff: 0,
};

function emptyByType(): CertificateVolumeByType {
  return { ...EMPTY_BY_TYPE };
}

function safeVolume(value: number | null | undefined): number {
  if (value === null || value === undefined || !Number.isFinite(value) || value < 0) {
    return 0;
  }
  return value;
}

/**
 * Aggregate certificate inventory volumes for UI / market-based coverage.
 *
 * - Totals include every line with a finite non-negative volume.
 * - Active volume is the inventory available for market-based Scope 2 claims.
 * - When `electricityKwh` is null/missing, coverage fields stay null (quality missing
 *   for the coverage comparison only — inventory totals remain measured).
 *
 * Market-based Scope 2 instruments: `certificatesToScope2Instruments` in
 * `toScope2Instruments.ts`. Keep location-based Scope 2 in lib/calc untouched.
 */
export function summariseCertificateVolumes(opts: {
  certificates: CertificateVolumeInput[];
  electricityKwh?: number | null;
}): CertificateVolumeSummary {
  const { certificates } = opts;
  const electricityRaw = opts.electricityKwh;
  const electricityKwh =
    electricityRaw === null ||
    electricityRaw === undefined ||
    !Number.isFinite(electricityRaw) ||
    electricityRaw < 0
      ? null
      : electricityRaw;

  const byType = emptyByType();
  const byTypeActive = emptyByType();
  let totalVolumeKwh = 0;
  let activeVolumeKwh = 0;
  let retiredVolumeKwh = 0;
  let expiredVolumeKwh = 0;

  for (const cert of certificates) {
    const vol = safeVolume(cert.volumeKwh);
    totalVolumeKwh += vol;
    byType[cert.certificateType] = (byType[cert.certificateType] ?? 0) + vol;

    if (cert.status === "active") {
      activeVolumeKwh += vol;
      byTypeActive[cert.certificateType] =
        (byTypeActive[cert.certificateType] ?? 0) + vol;
    } else if (cert.status === "retired") {
      retiredVolumeKwh += vol;
    } else if (cert.status === "expired") {
      expiredVolumeKwh += vol;
    }
  }

  let uncoveredKwh: number | null = null;
  let coverageRatio: number | null = null;
  let quality: CertificateQuality = "measured";
  let message: string | null = null;

  if (electricityKwh === null) {
    quality = certificates.length === 0 ? "missing" : "measured";
    message =
      certificates.length === 0
        ? "No certificates and no electricity_kwh datapoint for coverage comparison."
        : "electricity_kwh missing for this period — coverage ratio unavailable.";
  } else {
    uncoveredKwh = Math.max(0, electricityKwh - activeVolumeKwh);
    coverageRatio = electricityKwh > 0 ? activeVolumeKwh / electricityKwh : null;
    if (certificates.length === 0 && electricityKwh > 0) {
      message = "No active certificates against recorded electricity consumption.";
    } else if (activeVolumeKwh > electricityKwh && electricityKwh > 0) {
      message =
        "Active certificate volume exceeds electricity_kwh — review vintage and period matching.";
    }
  }

  return {
    lineCount: certificates.length,
    totalVolumeKwh,
    activeVolumeKwh,
    retiredVolumeKwh,
    expiredVolumeKwh,
    byType,
    byTypeActive,
    electricityKwh,
    uncoveredKwh,
    coverageRatio,
    quality,
    message,
  };
}

export function isCertificateType(value: unknown): value is CertificateType {
  return (
    value === "REC" ||
    value === "GO" ||
    value === "EAC" ||
    value === "PPA" ||
    value === "green_tariff"
  );
}

export function isCertificateStatus(value: unknown): value is CertificateStatus {
  return value === "active" || value === "retired" || value === "expired";
}
