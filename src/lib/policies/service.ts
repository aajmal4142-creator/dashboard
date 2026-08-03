import type { Payload, Where } from "payload";

import { POLICIES_SLUG } from "@/collections/Policies";

import {
  isPolicyCategory,
  isPolicyStatus,
  type PolicyCategory,
  type PolicyRecord,
  type PolicyStatus,
} from "./types";

export type PolicyWriteInput = {
  title: string;
  category: PolicyCategory;
  status: PolicyStatus;
  version: string;
  owner: string;
  effectiveDate: string;
  documentId?: string | null;
  documentUrl?: string | null;
  notes?: string | null;
};

function relationId(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "id" in value) {
    return String((value as { id: string }).id);
  }
  return null;
}

function optionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t ? t : null;
}

function dateOnly(value: unknown): string {
  if (typeof value !== "string" || !value) return "";
  return value.slice(0, 10);
}

export function docToPolicy(doc: {
  id: string;
  title?: unknown;
  category?: unknown;
  status?: unknown;
  version?: unknown;
  owner?: unknown;
  effectiveDate?: unknown;
  document?: unknown;
  documentUrl?: unknown;
  notes?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
}): PolicyRecord {
  return {
    id: String(doc.id),
    title: String(doc.title ?? ""),
    category: isPolicyCategory(doc.category) ? doc.category : "other",
    status: isPolicyStatus(doc.status) ? doc.status : "draft",
    version: String(doc.version ?? ""),
    owner: String(doc.owner ?? ""),
    effectiveDate: dateOnly(doc.effectiveDate),
    documentId: relationId(doc.document),
    documentUrl: optionalString(doc.documentUrl),
    notes: optionalString(doc.notes),
    createdAt: String(doc.createdAt ?? ""),
    updatedAt: String(doc.updatedAt ?? ""),
  };
}

export async function listOrgPolicies(
  payload: Payload,
  organisationId: string,
  opts?: { category?: PolicyCategory; status?: PolicyStatus },
): Promise<PolicyRecord[]> {
  const and: Where[] = [{ organisation: { equals: organisationId } }];
  if (opts?.category) {
    and.push({ category: { equals: opts.category } });
  }
  if (opts?.status) {
    and.push({ status: { equals: opts.status } });
  }

  const result = await payload.find({
    collection: POLICIES_SLUG,
    where: { and },
    limit: 500,
    sort: "-effectiveDate",
    depth: 0,
    overrideAccess: true,
  });

  return result.docs.map((d) => docToPolicy(d));
}

export async function getOrgPolicy(
  payload: Payload,
  organisationId: string,
  id: string,
): Promise<PolicyRecord | null> {
  const doc = await payload
    .findByID({
      collection: POLICIES_SLUG,
      id,
      depth: 0,
      overrideAccess: true,
    })
    .catch(() => null);
  if (!doc) return null;
  const orgId = relationId(doc.organisation);
  if (orgId !== organisationId) return null;
  return docToPolicy(doc);
}

/** ISO date (YYYY-MM-DD) or reject. */
export function parseEffectiveDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  const d = new Date(`${t}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return null;
  if (d.toISOString().slice(0, 10) !== t) return null;
  return t;
}

export function parseOptionalUrl(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string") return undefined;
  const t = value.trim();
  if (!t) return null;
  try {
    const u = new URL(t);
    if (u.protocol !== "http:" && u.protocol !== "https:") return undefined;
    return t;
  } catch {
    return undefined;
  }
}
