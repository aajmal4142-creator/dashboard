/**
 * Pure energy-certificate types and aggregation contracts.
 * Zero I/O. No Next/Payload imports.
 *
 * Active volume supports market-based Scope 2 coverage checks.
 * Retirement / expiry remove volume from the active inventory.
 *
 * Instruments for calculate(): see `toScope2Instruments.ts` →
 * `CalcContext.scope2Instruments` (wired in service / report / runway builders).
 */

export type CertificateType = "REC" | "GO" | "EAC" | "PPA" | "green_tariff";

export type CertificateStatus = "active" | "retired" | "expired";

export type CertificateQuality = "measured" | "missing";

export type CertificateVolumeInput = {
  volumeKwh: number | null;
  status: CertificateStatus;
  certificateType: CertificateType;
};

export type CertificateVolumeByType = Record<CertificateType, number>;

export type CertificateVolumeSummary = {
  lineCount: number;
  totalVolumeKwh: number;
  activeVolumeKwh: number;
  retiredVolumeKwh: number;
  expiredVolumeKwh: number;
  byType: CertificateVolumeByType;
  byTypeActive: CertificateVolumeByType;
  electricityKwh: number | null;
  /** max(0, electricity − active) when electricity is known; otherwise null. */
  uncoveredKwh: number | null;
  /** active / electricity when electricity > 0; otherwise null. */
  coverageRatio: number | null;
  quality: CertificateQuality;
  message: string | null;
};

export type CertificateImportRow = {
  rowNumber: number;
  label: string | null;
  certificateType: CertificateType;
  volumeKwh: number;
  vintageYear: number;
  region: string;
  country: string | null;
  status: CertificateStatus;
  /** Reporting period id or label resolved by the import route. */
  periodRef: string;
  supplier: string | null;
  notes: string | null;
};

export type CertificateImportValidationError = {
  rowNumber: number;
  field: string;
  value: unknown;
  error: string;
};

export type CertificateImportParseResult = {
  valid: boolean;
  rows: CertificateImportRow[];
  errors: CertificateImportValidationError[];
};
