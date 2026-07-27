/** Human-facing labels for dashboard enums and codes. Never invent zeros; unknown → readable fallback. */

const FRAMEWORK_LABELS: Record<string, string> = {
  CSRD_SIMPLIFIED: "CSRD (simplified)",
  CSRD_SET1: "CSRD Set 1",
  BRSR: "BRSR",
  VSME: "VSME",
  GRI: "GRI",
  CUSTOM: "Custom",
};

const SUBSCRIPTION_STATUS_LABELS: Record<string, string> = {
  none: "No subscription",
  active: "Active",
  past_due: "Past due",
  canceled: "Canceled",
  cancelled: "Canceled",
};

const REQUEST_STATUS_LABELS: Record<string, string> = {
  not_sent: "Not sent",
  sent: "Sent",
  opened: "Opened",
  submitted: "Submitted",
};

const QUALITY_LABELS: Record<string, string> = {
  measured: "Measured",
  mea: "Measured",
  calculated: "Calculated",
  cal: "Calculated",
  estimated: "Estimated",
  est: "Estimated",
  missing: "Missing",
  mis: "Missing",
};

const EVIDENCE_LABELS: Record<string, string> = {
  bare: "No evidence",
  none: "No evidence",
  evidenced: "Has evidence",
  attached: "Has evidence",
  document: "Document attached",
};

/** NACE section letters + onboarding codes used in-app. */
const SECTOR_LABELS: Record<string, string> = {
  A: "Agriculture, forestry and fishing",
  B: "Mining and quarrying",
  C: "Manufacturing",
  C25: "Manufacturing",
  D: "Electricity, gas, steam and air conditioning",
  E: "Water supply and waste",
  F: "Construction",
  G: "Wholesale and retail trade",
  G46: "Wholesale",
  H: "Transportation and storage",
  H49: "Transport",
  I: "Accommodation and food service",
  J: "Information and communication",
  J62: "IT / Services",
  K: "Financial and insurance",
  L: "Real estate",
  M: "Professional, scientific and technical",
  M70: "Consulting",
  N: "Administrative and support services",
  O: "Public administration",
  P: "Education",
  Q: "Human health and social work",
  R: "Arts, entertainment and recreation",
  S: "Other service activities",
  T: "Households as employers",
  U: "Extraterritorial organisations",
};

const AUDIT_ACTION_LABELS: Record<string, string> = {
  "report.publish": "Published report",
  "internal_request.create": "Created request",
  "datapoint.assign": "Assigned datapoint",
  "datapoint.approved": "Approved datapoint",
  "datapoint.rejected": "Rejected datapoint",
  "datapoint.pending": "Set datapoint pending",
  "datapoint.approval_reset": "Reset datapoint approval",
  "consultant.client_invite": "Invited client",
};

function titleCaseSegment(segment: string): string {
  return segment
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

export function frameworkLabel(code: string): string {
  const key = code.trim();
  return FRAMEWORK_LABELS[key] ?? key.replace(/_/g, " ");
}

export function subscriptionStatusLabel(status: string | null | undefined): string {
  if (status == null || status === "") return SUBSCRIPTION_STATUS_LABELS.none;
  return SUBSCRIPTION_STATUS_LABELS[status] ?? titleCaseSegment(status);
}

export function requestStatusLabel(status: string): string {
  return REQUEST_STATUS_LABELS[status] ?? titleCaseSegment(status);
}

export function auditActionLabel(action: string): string {
  const known = AUDIT_ACTION_LABELS[action];
  if (known) return known;
  const parts = action.split(".");
  const last = parts[parts.length - 1] ?? action;
  const verb = titleCaseSegment(last);
  if (parts.length >= 2) {
    const entity = titleCaseSegment(parts[0] ?? "");
    return `${verb} ${entity}`.trim();
  }
  return verb || action;
}

export function qualityLabel(q: string): string {
  const key = q.trim().toLowerCase();
  return QUALITY_LABELS[key] ?? titleCaseSegment(q);
}

export function evidenceLabel(level: string): string {
  const key = level.trim().toLowerCase();
  return EVIDENCE_LABELS[key] ?? titleCaseSegment(level);
}

export function sectorLabel(code: string): string {
  const raw = code.trim();
  if (!raw) return "Sector unknown";
  if (SECTOR_LABELS[raw]) return SECTOR_LABELS[raw];
  const upper = raw.toUpperCase();
  if (SECTOR_LABELS[upper]) return SECTOR_LABELS[upper];
  const prefix = upper.charAt(0);
  if (SECTOR_LABELS[prefix]) return SECTOR_LABELS[prefix];
  return `Sector ${raw}`;
}

/** Short relative time for audit rows; falls back to locale date. */
export function shortRelativeTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const diffMs = Date.now() - d.getTime();
  const sec = Math.round(diffMs / 1000);
  if (sec < 60) return "Just now";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 48) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 14) return `${day}d ago`;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
