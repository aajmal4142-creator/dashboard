/**
 * ISO 14064 compliance service — Payload I/O + progress helpers.
 */

import type { Payload } from "payload";

import { ISO_14064_COMPLIANCE_SLUG } from "@/collections/ISO14064Compliance";
import {
  assertItemCompletionAllowed,
  calculateIso14064Progress,
  type Iso14064ChecklistStatus,
  type Iso14064ItemStatus,
  type Iso14064ProgressResult,
} from "@/lib/compliance/iso14064Progress";
import {
  buildSeededSections,
  ISO_14064_CHECKLIST_COUNT,
  type Iso14064AutoLinkHint,
  type Iso14064Part,
} from "@/lib/compliance/iso14064Seed";
import { sendTransactionalEmail } from "@/lib/email/send";

export type Iso14064SectionRow = {
  id: string;
  itemKey: string;
  sectionNumber: string;
  part: Iso14064Part;
  requirement: string;
  description: string | null;
  status: Iso14064ItemStatus;
  evidenceIds: string[];
  notes: string | null;
  completedAt: string | null;
  autoLinkHint: Iso14064AutoLinkHint;
};

export type Iso14064ChecklistDto = {
  id: string;
  organisationId: string;
  status: Iso14064ChecklistStatus;
  sections: Iso14064SectionRow[];
  part1: Iso14064SectionRow[];
  part2: Iso14064SectionRow[];
  verifierAssigned: {
    id: string;
    email: string;
    name: string;
  } | null;
  assurancePartnerId: string | null;
  lastReviewDate: string | null;
  nextReviewDate: string | null;
  complianceScore: number;
  progress: Iso14064ProgressResult;
  verifierNoticeSentAt: string | null;
};

function relationId(value: unknown): string | null {
  if (typeof value === "string" && value.length > 0) return value;
  if (
    value &&
    typeof value === "object" &&
    "id" in value &&
    typeof (value as { id: unknown }).id === "string"
  ) {
    return (value as { id: string }).id;
  }
  return null;
}

function asItemStatus(value: unknown): Iso14064ItemStatus {
  if (
    value === "not_started" ||
    value === "in_progress" ||
    value === "completed" ||
    value === "na"
  ) {
    return value;
  }
  return "not_started";
}

function asPart(value: unknown): Iso14064Part {
  return value === "part2" ? "part2" : "part1";
}

function asAutoLinkHint(value: unknown): Iso14064AutoLinkHint {
  if (
    value === "csrd_report" ||
    value === "datapoints" ||
    value === "audit_logs" ||
    value === "emission_factors"
  ) {
    return value;
  }
  return "none";
}

function evidenceIdsFromField(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const entry of value) {
    const id = relationId(entry);
    if (id) out.push(id);
  }
  return out;
}

function mapSection(raw: Record<string, unknown>): Iso14064SectionRow {
  return {
    id: typeof raw.id === "string" ? raw.id : "",
    itemKey: typeof raw.itemKey === "string" ? raw.itemKey : "",
    sectionNumber: typeof raw.sectionNumber === "string" ? raw.sectionNumber : "",
    part: asPart(raw.part),
    requirement: typeof raw.requirement === "string" ? raw.requirement : "",
    description: typeof raw.description === "string" ? raw.description : null,
    status: asItemStatus(raw.status),
    evidenceIds: evidenceIdsFromField(raw.evidenceIds),
    notes: typeof raw.notes === "string" ? raw.notes : null,
    completedAt: typeof raw.completedAt === "string" ? raw.completedAt : null,
    autoLinkHint: asAutoLinkHint(raw.autoLinkHint),
  };
}

function progressFromSections(sections: Iso14064SectionRow[]): Iso14064ProgressResult {
  return calculateIso14064Progress(
    sections.map((s) => ({
      status: s.status,
      evidenceCount: s.evidenceIds.length,
    })),
  );
}

function mapVerifier(value: unknown): Iso14064ChecklistDto["verifierAssigned"] {
  if (!value || typeof value !== "object") {
    const id = relationId(value);
    if (!id) return null;
    return { id, email: "", name: "" };
  }
  const obj = value as {
    id?: string;
    email?: string;
    firstName?: string | null;
    lastName?: string | null;
  };
  if (!obj.id) return null;
  const name = [obj.firstName, obj.lastName].filter(Boolean).join(" ").trim();
  return {
    id: obj.id,
    email: typeof obj.email === "string" ? obj.email : "",
    name,
  };
}

export function docToIso14064Checklist(
  doc: Record<string, unknown>,
): Iso14064ChecklistDto {
  const rawSections = Array.isArray(doc.sections) ? doc.sections : [];
  const sections = rawSections
    .filter((row): row is Record<string, unknown> =>
      Boolean(row && typeof row === "object"),
    )
    .map(mapSection);

  const progress = progressFromSections(sections);
  const organisationId = relationId(doc.organisation) ?? "";

  return {
    id: String(doc.id ?? ""),
    organisationId,
    status: progress.checklistStatus,
    sections,
    part1: sections.filter((s) => s.part === "part1"),
    part2: sections.filter((s) => s.part === "part2"),
    verifierAssigned: mapVerifier(doc.verifierAssigned),
    assurancePartnerId: relationId(doc.assurancePartner),
    lastReviewDate: typeof doc.lastReviewDate === "string" ? doc.lastReviewDate : null,
    nextReviewDate: typeof doc.nextReviewDate === "string" ? doc.nextReviewDate : null,
    complianceScore: progress.percentComplete,
    progress,
    verifierNoticeSentAt:
      typeof doc.verifierNoticeSentAt === "string" ? doc.verifierNoticeSentAt : null,
  };
}

export async function findOrgIso14064(
  payload: Payload,
  organisationId: string,
): Promise<Iso14064ChecklistDto | null> {
  const found = await payload.find({
    collection: ISO_14064_COMPLIANCE_SLUG,
    where: { organisation: { equals: organisationId } },
    limit: 1,
    depth: 1,
    overrideAccess: true,
  });
  const doc = found.docs[0];
  if (!doc) return null;
  return docToIso14064Checklist(doc as unknown as Record<string, unknown>);
}

export async function getOrgIso14064ById(
  payload: Payload,
  organisationId: string,
  id: string,
): Promise<Iso14064ChecklistDto | null> {
  try {
    const doc = await payload.findByID({
      collection: ISO_14064_COMPLIANCE_SLUG,
      id,
      depth: 1,
      overrideAccess: true,
    });
    const orgId = relationId((doc as { organisation?: unknown }).organisation);
    if (orgId !== organisationId) return null;
    return docToIso14064Checklist(doc as unknown as Record<string, unknown>);
  } catch {
    return null;
  }
}

export async function createOrgIso14064(
  payload: Payload,
  organisationId: string,
): Promise<Iso14064ChecklistDto> {
  const existing = await findOrgIso14064(payload, organisationId);
  if (existing) {
    throw new Error("ISO 14064 checklist already exists for this organisation");
  }

  const sections = buildSeededSections();
  if (sections.length !== ISO_14064_CHECKLIST_COUNT) {
    throw new Error(
      `Seed expected ${ISO_14064_CHECKLIST_COUNT} items, got ${sections.length}`,
    );
  }

  const nextYear = new Date();
  nextYear.setFullYear(nextYear.getFullYear() + 1);

  const created = await payload.create({
    collection: ISO_14064_COMPLIANCE_SLUG,
    data: {
      organisation: organisationId,
      status: "not_started",
      sections,
      complianceScore: 0,
      nextReviewDate: nextYear.toISOString(),
    },
    overrideAccess: true,
  });

  return docToIso14064Checklist(created as unknown as Record<string, unknown>);
}

export async function updateIso14064Item(args: {
  payload: Payload;
  organisationId: string;
  checklistId: string;
  itemId: string;
  status?: Iso14064ItemStatus;
  evidenceIds?: string[];
  notes?: string | null;
}): Promise<Iso14064ChecklistDto> {
  const checklist = await getOrgIso14064ById(
    args.payload,
    args.organisationId,
    args.checklistId,
  );
  if (!checklist) {
    throw new Error("Checklist not found");
  }

  const idx = checklist.sections.findIndex(
    (s) => s.id === args.itemId || s.itemKey === args.itemId,
  );
  if (idx < 0) {
    throw new Error("Checklist item not found");
  }

  const current = checklist.sections[idx]!;
  const nextEvidence =
    args.evidenceIds !== undefined ? args.evidenceIds : current.evidenceIds;

  if (args.evidenceIds !== undefined) {
    const unique = [...new Set(args.evidenceIds.filter(Boolean))];
    for (const evidenceId of unique) {
      const ev = await args.payload.findByID({
        collection: "evidence",
        id: evidenceId,
        overrideAccess: true,
      });
      const orgId = relationId((ev as { organisation?: unknown }).organisation);
      if (orgId !== args.organisationId) {
        throw new Error("Evidence not found for this organisation");
      }
    }
  }

  const nextStatus = args.status ?? current.status;
  assertItemCompletionAllowed({
    nextStatus,
    evidenceCount: nextEvidence.length,
  });

  const nextSections = checklist.sections.map((row, i) => {
    if (i !== idx) {
      return {
        itemKey: row.itemKey,
        sectionNumber: row.sectionNumber,
        part: row.part,
        requirement: row.requirement,
        description: row.description ?? undefined,
        status: row.status,
        evidenceIds: row.evidenceIds,
        notes: row.notes ?? undefined,
        completedAt: row.completedAt ?? undefined,
        autoLinkHint: row.autoLinkHint,
      };
    }
    const completedAt =
      nextStatus === "completed"
        ? new Date().toISOString()
        : nextStatus === "na"
          ? undefined
          : undefined;
    return {
      itemKey: row.itemKey,
      sectionNumber: row.sectionNumber,
      part: row.part,
      requirement: row.requirement,
      description: row.description ?? undefined,
      status: nextStatus,
      evidenceIds: nextEvidence,
      notes:
        args.notes !== undefined ? (args.notes ?? undefined) : (row.notes ?? undefined),
      completedAt:
        nextStatus === "completed"
          ? completedAt
          : nextStatus === "not_started" || nextStatus === "in_progress"
            ? undefined
            : (row.completedAt ?? undefined),
      autoLinkHint: row.autoLinkHint,
    };
  });

  const progress = calculateIso14064Progress(
    nextSections.map((s) => ({
      status: s.status,
      evidenceCount: (s.evidenceIds ?? []).length,
    })),
  );

  const updated = await args.payload.update({
    collection: ISO_14064_COMPLIANCE_SLUG,
    id: args.checklistId,
    data: {
      sections: nextSections,
      status: progress.checklistStatus,
      complianceScore: progress.percentComplete,
      lastReviewDate: nextStatus === "completed" ? new Date().toISOString() : undefined,
    },
    overrideAccess: true,
  });

  return docToIso14064Checklist(updated as unknown as Record<string, unknown>);
}

export async function assignIso14064Verifier(args: {
  payload: Payload;
  organisationId: string;
  checklistId: string;
  verifierUserId: string;
  assurancePartnerId?: string | null;
  orgName: string;
  sendNotice?: boolean;
}): Promise<Iso14064ChecklistDto> {
  const checklist = await getOrgIso14064ById(
    args.payload,
    args.organisationId,
    args.checklistId,
  );
  if (!checklist) {
    throw new Error("Checklist not found");
  }

  const memberships = await args.payload.find({
    collection: "memberships",
    where: {
      and: [
        { organisation: { equals: args.organisationId } },
        { user: { equals: args.verifierUserId } },
        { status: { equals: "active" } },
      ],
    },
    limit: 1,
    overrideAccess: true,
  });
  if (!memberships.docs[0]) {
    throw new Error("Verifier must be an active member of this organisation");
  }

  if (args.assurancePartnerId) {
    await args.payload.findByID({
      collection: "assurance-partners",
      id: args.assurancePartnerId,
      overrideAccess: true,
    });
  }

  const user = await args.payload.findByID({
    collection: "users",
    id: args.verifierUserId,
    overrideAccess: true,
  });

  let noticeSentAt: string | null = checklist.verifierNoticeSentAt;
  if (args.sendNotice !== false && user.email) {
    const verifierName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
    const greeting = verifierName ? `Hi ${verifierName},` : "Hi,";
    await sendTransactionalEmail({
      to: user.email,
      subject: `ISO 14064 verification assignment — ${args.orgName}`,
      html: `<p>${greeting}</p>
<p>You have been assigned as verifier for the ISO 14064 compliance checklist for <strong>${args.orgName}</strong>.</p>
<p>Open ClearESG → Compliance → ISO 14064 to review progress and evidence.</p>`,
      text: `${greeting}\n\nYou have been assigned as verifier for the ISO 14064 compliance checklist for ${args.orgName}. Open ClearESG → Compliance → ISO 14064 to review progress and evidence.`,
    });
    noticeSentAt = new Date().toISOString();
  }

  const updated = await args.payload.update({
    collection: ISO_14064_COMPLIANCE_SLUG,
    id: args.checklistId,
    data: {
      verifierAssigned: args.verifierUserId,
      assurancePartner: args.assurancePartnerId || null,
      verifierNoticeSentAt: noticeSentAt ?? undefined,
      status: checklist.status === "not_started" ? "in_progress" : checklist.status,
    },
    depth: 1,
    overrideAccess: true,
  });

  return docToIso14064Checklist(updated as unknown as Record<string, unknown>);
}

export async function listOrgEvidenceOptions(
  payload: Payload,
  organisationId: string,
): Promise<Array<{ id: string; filename: string; uploadedAt: string | null }>> {
  const found = await payload.find({
    collection: "evidence",
    where: { organisation: { equals: organisationId } },
    limit: 100,
    sort: "-uploadedAt",
    overrideAccess: true,
  });
  return found.docs.map((doc) => ({
    id: doc.id,
    filename: typeof doc.filename === "string" ? doc.filename : doc.id,
    uploadedAt: typeof doc.uploadedAt === "string" ? doc.uploadedAt : null,
  }));
}

export { ISO_14064_CHECKLIST_COUNT } from "@/lib/compliance/iso14064Seed";
