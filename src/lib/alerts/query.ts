import { isAlertMuted } from "./evaluate";
import { isAlertAction, parseAlertCondition } from "./parse";
import type {
  AlertAction,
  AlertCondition,
  AlertRuleDoc,
  AlertRuleSummary,
} from "./types";

function relId(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "id" in value) {
    return String((value as { id: string }).id);
  }
  return null;
}

function asIso(value: string | Date | null | undefined): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export function orgIdFromDoc(doc: AlertRuleDoc): string | null {
  return relId(doc.organisation);
}

export function normalizeActions(raw: unknown): AlertAction[] {
  if (!Array.isArray(raw)) return ["notify_user"];
  const out: AlertAction[] = [];
  for (const item of raw) {
    if (typeof item === "string" && isAlertAction(item) && !out.includes(item)) {
      out.push(item);
    }
  }
  return out.length > 0 ? out : ["notify_user"];
}

export function normalizeCondition(raw: unknown): AlertCondition | null {
  const parsed = parseAlertCondition(raw);
  return parsed.ok ? parsed.condition : null;
}

export function deriveRuleStatus(
  doc: {
    enabled?: boolean | null;
    muted?: boolean | null;
    mutedUntil?: string | Date | null;
    lastTriggeredAt?: string | Date | null;
  },
  now: Date = new Date(),
): AlertRuleSummary["status"] {
  if (doc.enabled === false) return "disabled";
  if (isAlertMuted(doc.muted === true, doc.mutedUntil, now)) return "muted";
  if (doc.lastTriggeredAt) return "triggered";
  return "active";
}

export function mapAlertRuleDoc(
  doc: AlertRuleDoc,
  now: Date = new Date(),
): AlertRuleSummary | null {
  const condition = normalizeCondition(doc.condition);
  if (!condition || !doc.name) return null;

  return {
    id: doc.id,
    name: doc.name,
    enabled: doc.enabled !== false,
    condition,
    actions: normalizeActions(doc.actions),
    muted: doc.muted === true,
    mutedUntil: asIso(doc.mutedUntil),
    triggeredCount: typeof doc.triggeredCount === "number" ? doc.triggeredCount : 0,
    lastTriggeredAt: asIso(doc.lastTriggeredAt),
    lastTriggeredMessage: doc.lastTriggeredMessage ?? null,
    createdAt: asIso(doc.createdAt) ?? "",
    updatedAt: asIso(doc.updatedAt) ?? "",
    status: deriveRuleStatus(doc, now),
  };
}

export function buildOrgAlertWhere(organisationId: string) {
  return { organisation: { equals: organisationId } };
}
