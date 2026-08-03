import { slaTone, type SlaTone } from "./sla";

export type InternalRequestDto = {
  id: string;
  title: string;
  requestStatus: string;
  reviewStatus: string;
  dueAt: string | null;
  dueDate: string | null;
  escalatedAt: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewerNotes: string | null;
  metricKeys: string[];
  evidenceIds: string[];
  sla: SlaTone;
  assignee: { id: string; email: string; name?: string } | null;
  createdBy: string | null;
};

type RelUser = {
  id?: string;
  email?: string;
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
};

type RelEvidence = { id?: string };

export type InternalRequestDoc = {
  id: string;
  title?: string | null;
  requestStatus?: string | null;
  reviewStatus?: string | null;
  dueDate?: string | null;
  escalatedAt?: string | null;
  submittedAt?: string | null;
  reviewedAt?: string | null;
  reviewerNotes?: string | null;
  metricKeys?: Array<{ key?: string | null } | null> | null;
  evidence?: Array<string | RelEvidence | null> | null;
  assignee?: string | RelUser | null;
  createdBy?: string | RelUser | null;
};

function relId(value: string | { id?: string } | null | undefined): string | null {
  if (value == null) return null;
  if (typeof value === "string") return value;
  return value.id ? String(value.id) : null;
}

function assigneeDto(
  assignee: string | RelUser | null | undefined,
): InternalRequestDto["assignee"] {
  if (assignee == null) return null;
  if (typeof assignee === "string") {
    return { id: assignee, email: "" };
  }
  if (!assignee.id) return null;
  const nameFromParts = [assignee.firstName, assignee.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();
  const name =
    (typeof assignee.name === "string" && assignee.name.trim()) ||
    nameFromParts ||
    undefined;
  return {
    id: String(assignee.id),
    email: typeof assignee.email === "string" ? assignee.email : "",
    name,
  };
}

function evidenceIds(evidence: InternalRequestDoc["evidence"]): string[] {
  if (!evidence?.length) return [];
  const ids: string[] = [];
  for (const e of evidence) {
    if (e == null) continue;
    if (typeof e === "string") {
      ids.push(e);
      continue;
    }
    if (e.id) ids.push(String(e.id));
  }
  return ids;
}

export function serializeInternalRequest(
  doc: InternalRequestDoc,
  nowMs: number = Date.now(),
): InternalRequestDto {
  const dueAt = doc.dueDate ?? null;
  const requestStatus = doc.requestStatus ?? "not_sent";
  const reviewStatus = doc.reviewStatus ?? "pending";
  return {
    id: String(doc.id),
    title: doc.title ?? "",
    requestStatus,
    reviewStatus,
    dueAt,
    dueDate: dueAt,
    escalatedAt: doc.escalatedAt ?? null,
    submittedAt: doc.submittedAt ?? null,
    reviewedAt: doc.reviewedAt ?? null,
    reviewerNotes: doc.reviewerNotes ?? null,
    metricKeys: (doc.metricKeys ?? [])
      .map((m) => (m && typeof m.key === "string" ? m.key : ""))
      .filter(Boolean),
    evidenceIds: evidenceIds(doc.evidence),
    sla: slaTone(
      {
        dueAt,
        requestStatus,
        reviewStatus,
        escalatedAt: doc.escalatedAt,
      },
      nowMs,
    ),
    assignee: assigneeDto(doc.assignee),
    createdBy: relId(doc.createdBy),
  };
}
