import type { Payload, Where } from "payload";

import { FACILITIES_SLUG } from "@/collections/Facilities";
import { REDUCTION_PROJECTS_SLUG } from "@/collections/ReductionProjects";

import { summariseReductionProjects } from "./reductionAggregate";
import {
  isReductionProjectStatus,
  type ReductionProjectStatus,
  type ReductionProjectSummary,
} from "./reductionTypes";

export type ReductionProjectDto = {
  id: string;
  title: string;
  status: ReductionProjectStatus;
  plannedReductionTco2e: number;
  actualReductionTco2e: number | null;
  owner: string;
  startDate: string | null;
  endDate: string | null;
  facilityId: string | null;
  facilityName: string | null;
  metricKey: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FacilityOption = {
  id: string;
  name: string;
  code: string;
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

function optionalDate(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  return value.trim().slice(0, 10);
}

function optionalNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  return n;
}

export function docToReductionProject(doc: {
  id: string;
  title?: unknown;
  status?: unknown;
  plannedReductionTco2e?: unknown;
  actualReductionTco2e?: unknown;
  owner?: unknown;
  startDate?: unknown;
  endDate?: unknown;
  facility?: unknown;
  metricKey?: unknown;
  notes?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
}): ReductionProjectDto {
  const facilityId = relationId(doc.facility);
  let facilityName: string | null = null;
  if (
    doc.facility &&
    typeof doc.facility === "object" &&
    doc.facility !== null &&
    "name" in doc.facility
  ) {
    facilityName = optionalString((doc.facility as { name?: unknown }).name);
  }

  return {
    id: String(doc.id),
    title: String(doc.title ?? ""),
    status: isReductionProjectStatus(doc.status) ? doc.status : "planned",
    plannedReductionTco2e: optionalNumber(doc.plannedReductionTco2e) ?? 0,
    actualReductionTco2e: optionalNumber(doc.actualReductionTco2e),
    owner: String(doc.owner ?? ""),
    startDate: optionalDate(doc.startDate),
    endDate: optionalDate(doc.endDate),
    facilityId,
    facilityName,
    metricKey: optionalString(doc.metricKey),
    notes: optionalString(doc.notes),
    createdAt: String(doc.createdAt ?? ""),
    updatedAt: String(doc.updatedAt ?? ""),
  };
}

export async function listOrgReductionProjects(
  payload: Payload,
  organisationId: string,
  opts?: { status?: ReductionProjectStatus },
): Promise<ReductionProjectDto[]> {
  const clauses: Where[] = [{ organisation: { equals: organisationId } }];
  if (opts?.status) {
    clauses.push({ status: { equals: opts.status } });
  }
  const result = await payload.find({
    collection: REDUCTION_PROJECTS_SLUG,
    where: { and: clauses },
    depth: 1,
    limit: 500,
    sort: "-updatedAt",
    overrideAccess: true,
  });
  return result.docs.map((d) => docToReductionProject(d));
}

export async function getOrgReductionProject(
  payload: Payload,
  organisationId: string,
  id: string,
): Promise<ReductionProjectDto | null> {
  const doc = await payload
    .findByID({
      collection: REDUCTION_PROJECTS_SLUG,
      id,
      depth: 1,
      overrideAccess: true,
    })
    .catch(() => null);
  if (!doc) return null;
  const orgId = relationId(doc.organisation);
  if (orgId !== organisationId) return null;
  return docToReductionProject(doc);
}

export async function listOrgFacilityOptions(
  payload: Payload,
  organisationId: string,
): Promise<FacilityOption[]> {
  const result = await payload.find({
    collection: FACILITIES_SLUG,
    where: {
      and: [{ organisation: { equals: organisationId } }, { active: { equals: true } }],
    },
    depth: 0,
    limit: 500,
    sort: "name",
    overrideAccess: true,
  });
  return result.docs.map((d) => ({
    id: String(d.id),
    name: String(d.name ?? ""),
    code: String(d.code ?? ""),
  }));
}

export async function assertFacilityInOrg(
  payload: Payload,
  organisationId: string,
  facilityId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const doc = await payload
    .findByID({
      collection: FACILITIES_SLUG,
      id: facilityId,
      depth: 0,
      overrideAccess: true,
    })
    .catch(() => null);
  if (!doc) {
    return {
      ok: false,
      error: "facilityId must reference a facility in this organisation",
    };
  }
  const orgId = relationId(doc.organisation);
  if (orgId !== organisationId) {
    return {
      ok: false,
      error: "facilityId must reference a facility in this organisation",
    };
  }
  return { ok: true };
}

export function buildReductionSummary(
  projects: ReductionProjectDto[],
): ReductionProjectSummary {
  return summariseReductionProjects(
    projects.map((p) => ({
      status: p.status,
      plannedReductionTco2e: p.plannedReductionTco2e,
      actualReductionTco2e: p.actualReductionTco2e,
    })),
  );
}

export { optionalDate, optionalNumber, optionalString, relationId };
