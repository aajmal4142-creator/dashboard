/** Attestation honesty — never claim certified without evidence. */
export type AttestationStatus = "not_attested" | "in_progress" | "attested";

export type TrustAttestation = {
  id: string;
  /** Display name of the framework / report */
  name: string;
  status: AttestationStatus;
  /** Short honesty note shown on the Trust Center */
  note: string;
};

export type SecurityControl = {
  id: string;
  title: string;
  summary: string;
};

export type Subprocessor = {
  id: string;
  name: string;
  purpose: string;
  /** Categories of customer / personal data involved */
  dataCategories: string;
  /** Primary processing region(s) */
  region: string;
  website?: string;
};

/** Org-internal control checklist status (append-only events). */
export type TrustControlStatus =
  "not_started" | "in_progress" | "implemented" | "not_applicable";

export type TrustChecklistControl = {
  id: string;
  title: string;
  category: string;
  description: string;
};

export type ChecklistItemState = {
  controlId: string;
  status: TrustControlStatus;
};

export type ChecklistProgress = {
  total: number;
  implemented: number;
  inProgress: number;
  notStarted: number;
  notApplicable: number;
  /**
   * Fraction of applicable controls that are implemented (0–1).
   * `not_applicable` is excluded from the denominator.
   * When no applicable controls remain, percent is 1.
   */
  percentComplete: number;
  quality: "empty" | "partial" | "complete";
};

export type TrustControlEventInput = {
  controlId: string;
  status: TrustControlStatus;
  note?: string | null;
  createdAt: string;
};
