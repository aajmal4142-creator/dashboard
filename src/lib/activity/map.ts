import { auditActionLabel } from "@/lib/ui/displayLabels";

/** Actor resolved from an audit-log relationship (populated or not). */
export type ActivityActorInput =
  | null
  | undefined
  | string
  | {
      id?: string | null;
      email?: string | null;
      firstName?: string | null;
      lastName?: string | null;
    };

export type ActivityAuditInput = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  createdAt: string;
  actor?: ActivityActorInput;
  before?: unknown;
  after?: unknown;
};

export type ActivityItem = {
  id: string;
  action: string;
  activityType: string;
  entityType: string;
  entityId: string;
  createdAt: string;
  actorName: string;
  actorId: string | null;
  resourceLabel: string;
  resourceTypeLabel: string;
  displayName: string;
  details: string;
};

const RESOURCE_TYPE_LABELS: Record<string, string> = {
  datapoints: "Datapoint",
  reports: "Report",
  suppliers: "Supplier",
  evidence: "Evidence",
  organisations: "Organisation",
  "internal-data-requests": "Internal request",
  "materiality-assessments": "Materiality assessment",
  "compliance-assessment": "Compliance assessment",
  "compliance-obligations": "Obligation",
  "accounting-connections": "Accounting connection",
  "database-connections": "Database connection",
  "iot-devices": "IoT device",
  "iot-gateways": "IoT gateway",
  "bi-api-keys": "BI API key",
  "webhook-registrations": "Webhook",
  "email-data-collection-forms": "Email import form",
  "issb-disclosure": "ISSB disclosure",
  "report-template": "Report template",
};

const NAME_KEYS = [
  "name",
  "title",
  "label",
  "metricKey",
  "framework",
  "displayName",
  "supplierName",
  "filename",
] as const;

function titleCaseSegment(segment: string): string {
  return segment
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function pickName(record: Record<string, unknown> | null): string | null {
  if (!record) return null;
  for (const key of NAME_KEYS) {
    const v = record[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

/** Convert audit action `datapoint.created` → activity type `datapoint_created`. */
export function activityTypeFromAction(action: string): string {
  return action.trim().replace(/\./g, "_");
}

/** Convert filter type `datapoint_created` → audit action `datapoint.created`. */
export function actionFromActivityType(type: string): string {
  const trimmed = type.trim();
  if (trimmed.includes(".")) return trimmed;
  return trimmed.replace(/_/g, ".");
}

export function resourceTypeLabel(entityType: string): string {
  const key = entityType.trim();
  if (!key) return "Resource";
  if (RESOURCE_TYPE_LABELS[key]) return RESOURCE_TYPE_LABELS[key];
  return titleCaseSegment(key.replace(/-/g, " "));
}

/**
 * Friendly actor label.
 * Missing / unpopulated actor id → "Deleted User"; no actor → "System".
 */
export function actorDisplayName(actor: ActivityActorInput): string {
  if (actor == null) return "System";
  if (typeof actor === "string") {
    return actor.trim() ? "Deleted User" : "System";
  }
  const first = typeof actor.firstName === "string" ? actor.firstName.trim() : "";
  const last = typeof actor.lastName === "string" ? actor.lastName.trim() : "";
  const full = [first, last].filter(Boolean).join(" ");
  if (full) return full;
  if (typeof actor.email === "string" && actor.email.trim()) {
    return actor.email.trim();
  }
  if (actor.id) return "Deleted User";
  return "Deleted User";
}

export function actorIdOf(actor: ActivityActorInput): string | null {
  if (actor == null) return null;
  if (typeof actor === "string") return actor.trim() || null;
  if (typeof actor.id === "string" && actor.id.trim()) return actor.id;
  return null;
}

/**
 * Graceful resource label: prefer name fields on before/after, else type + short id.
 */
export function resourceDisplayLabel(
  entityType: string,
  entityId: string,
  before?: unknown,
  after?: unknown,
): string {
  const typeLabel = resourceTypeLabel(entityType);
  const named = pickName(asRecord(after)) ?? pickName(asRecord(before)) ?? null;
  if (named) return named;

  const id = entityId.trim();
  if (!id || id === "unknown" || id === "null") {
    return typeLabel;
  }
  if (id.length <= 12) return `${typeLabel} ${id}`;
  return `${typeLabel} ${id.slice(0, 8)}…`;
}

function formatScalar(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "boolean") return value ? "true" : "false";
  return null;
}

function valueDetail(before: unknown, after: unknown): string | null {
  const b = asRecord(before);
  const a = asRecord(after);
  const beforeVal = formatScalar(b?.value);
  const afterVal = formatScalar(a?.value);
  if (beforeVal != null && afterVal != null && beforeVal !== afterVal) {
    const unit = formatScalar(a?.unit) ?? formatScalar(b?.unit) ?? null;
    const suffix = unit ? ` ${unit}` : "";
    return `from ${beforeVal}${suffix} to ${afterVal}${suffix}`;
  }
  if (afterVal != null && beforeVal == null) {
    const unit = formatScalar(a?.unit);
    return unit ? `${afterVal} ${unit}` : afterVal;
  }
  const status =
    formatScalar(a?.status) ??
    formatScalar(a?.approvalState) ??
    formatScalar(a?.changeType);
  return status;
}

/**
 * Human sentence: who + action + resource (+ optional value change).
 */
export function activityDisplayName(input: {
  actorName: string;
  action: string;
  resourceLabel: string;
  before?: unknown;
  after?: unknown;
}): string {
  const verbPhrase = auditActionLabel(input.action);
  const detail = valueDetail(input.before, input.after);
  const quoted =
    input.resourceLabel.includes(" ") || input.resourceLabel.length > 16
      ? `'${input.resourceLabel}'`
      : input.resourceLabel;
  const base = `${input.actorName} — ${verbPhrase}: ${quoted}`;
  return detail ? `${base} (${detail})` : base;
}

export function activityDetails(before?: unknown, after?: unknown): string {
  const detail = valueDetail(before, after);
  if (detail) return detail;
  const a = asRecord(after);
  if (!a) return "";
  const bits: string[] = [];
  for (const key of [
    "status",
    "approvalState",
    "changeType",
    "reason",
    "framework",
  ] as const) {
    const v = formatScalar(a[key]);
    if (v) bits.push(`${key}: ${v}`);
  }
  return bits.join("; ");
}

/** Map one audit-log document to a user-facing activity item. */
export function mapAuditLogToActivity(log: ActivityAuditInput): ActivityItem {
  const actorName = actorDisplayName(log.actor);
  const resourceLabel = resourceDisplayLabel(
    log.entityType,
    log.entityId,
    log.before,
    log.after,
  );
  return {
    id: log.id,
    action: log.action,
    activityType: activityTypeFromAction(log.action),
    entityType: log.entityType,
    entityId: log.entityId,
    createdAt: log.createdAt,
    actorName,
    actorId: actorIdOf(log.actor),
    resourceLabel,
    resourceTypeLabel: resourceTypeLabel(log.entityType),
    displayName: activityDisplayName({
      actorName,
      action: log.action,
      resourceLabel,
      before: log.before,
      after: log.after,
    }),
    details: activityDetails(log.before, log.after),
  };
}
