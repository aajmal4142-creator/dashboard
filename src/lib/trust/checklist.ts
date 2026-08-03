import type {
  ChecklistItemState,
  ChecklistProgress,
  TrustChecklistControl,
  TrustControlEventInput,
  TrustControlStatus,
} from "./types";

/** Catalog of internal controls tracked on the Trust Center checklist. */
export const TRUST_CHECKLIST_CONTROLS: TrustChecklistControl[] = [
  {
    id: "mfa_admin",
    title: "Admin MFA",
    category: "Access",
    description: "Organisation admins enroll multi-factor authentication via Clerk.",
  },
  {
    id: "membership_review",
    title: "Membership review",
    category: "Access",
    description: "Quarterly review of Membership roles; stale accounts removed.",
  },
  {
    id: "secret_rotation",
    title: "Secret rotation",
    category: "Secrets",
    description: "PAYLOAD_SECRET and integration secrets rotated on a defined cadence.",
  },
  {
    id: "backup_restore",
    title: "Backup restore drill",
    category: "Resilience",
    description: "Documented Atlas backup restore tested within the last 12 months.",
  },
  {
    id: "vendor_review",
    title: "Subprocessor review",
    category: "Vendors",
    description: "Annual review of the static subprocessor list against live vendors.",
  },
  {
    id: "access_logging",
    title: "Privileged access logging",
    category: "Monitoring",
    description: "Admin actions that mutate tenancy or billing leave audit evidence.",
  },
  {
    id: "incident_runbook",
    title: "Incident runbook",
    category: "Response",
    description: "Written incident response steps exist and owners are named.",
  },
  {
    id: "data_export_delete",
    title: "Export / deletion path",
    category: "Privacy",
    description: "Documented path to export or delete organisation data on request.",
  },
];

const STATUS_SET = new Set<TrustControlStatus>([
  "not_started",
  "in_progress",
  "implemented",
  "not_applicable",
]);

export function isTrustControlStatus(value: unknown): value is TrustControlStatus {
  return typeof value === "string" && STATUS_SET.has(value as TrustControlStatus);
}

export function isKnownControlId(controlId: string): boolean {
  return TRUST_CHECKLIST_CONTROLS.some((c) => c.id === controlId);
}

/**
 * Collapse append-only events into the latest status per catalog control.
 * Unknown control ids in events are ignored. Catalog controls with no event
 * default to `not_started`.
 */
export function resolveLatestStatuses(
  catalog: TrustChecklistControl[],
  events: TrustControlEventInput[],
): ChecklistItemState[] {
  const sorted = [...events].sort((a, b) => {
    const ta = Date.parse(a.createdAt);
    const tb = Date.parse(b.createdAt);
    if (Number.isNaN(ta) && Number.isNaN(tb)) return 0;
    if (Number.isNaN(ta)) return -1;
    if (Number.isNaN(tb)) return 1;
    return ta - tb;
  });

  const latest = new Map<string, TrustControlStatus>();
  for (const event of sorted) {
    if (!isKnownControlId(event.controlId)) continue;
    if (!isTrustControlStatus(event.status)) continue;
    latest.set(event.controlId, event.status);
  }

  return catalog.map((control) => ({
    controlId: control.id,
    status: latest.get(control.id) ?? "not_started",
  }));
}

/**
 * Pure checklist progress helper — Vitest-covered, zero I/O.
 */
export function computeChecklistProgress(items: ChecklistItemState[]): ChecklistProgress {
  let implemented = 0;
  let inProgress = 0;
  let notStarted = 0;
  let notApplicable = 0;

  for (const item of items) {
    switch (item.status) {
      case "implemented":
        implemented += 1;
        break;
      case "in_progress":
        inProgress += 1;
        break;
      case "not_applicable":
        notApplicable += 1;
        break;
      case "not_started":
      default:
        notStarted += 1;
        break;
    }
  }

  const total = items.length;
  const applicable = total - notApplicable;
  const percentComplete =
    applicable <= 0 ? 1 : Math.min(1, Math.max(0, implemented / applicable));

  let quality: ChecklistProgress["quality"] = "empty";
  if (total === 0) {
    quality = "empty";
  } else if (applicable > 0 && implemented === applicable) {
    quality = "complete";
  } else if (implemented > 0 || inProgress > 0) {
    quality = "partial";
  } else if (applicable === 0 && notApplicable === total) {
    quality = "complete";
  } else {
    quality = "empty";
  }

  return {
    total,
    implemented,
    inProgress,
    notStarted,
    notApplicable,
    percentComplete,
    quality,
  };
}
