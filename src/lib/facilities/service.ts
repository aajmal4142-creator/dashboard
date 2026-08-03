import type { Payload, Where } from "payload";

import { FACILITIES_SLUG } from "@/collections/Facilities";
import { METERS_SLUG } from "@/collections/Meters";

import {
  buildFacilityForest,
  flattenFacilityForest,
  rollupFacilityMeters,
  wouldCreateCircularFacility,
} from "./tree";
import {
  isFacilityType,
  isMeterUtility,
  type FacilityNode,
  type FacilityRollup,
  type FacilityTreeNode,
  type FacilityType,
  type MeterRow,
  type MeterUtility,
} from "./types";

export type FacilityDto = FacilityNode & {
  meterCount: number;
  createdAt: string;
  updatedAt: string;
};

export type MeterDto = MeterRow & {
  createdAt: string;
  updatedAt: string;
};

export type FacilitiesIndex = {
  facilities: FacilityDto[];
  meters: MeterDto[];
  forest: FacilityTreeNode[];
  flat: ReturnType<typeof flattenFacilityForest>;
  rollups: FacilityRollup[];
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

export function docToFacility(doc: {
  id: string;
  name?: unknown;
  code?: unknown;
  facilityType?: unknown;
  country?: unknown;
  region?: unknown;
  address?: unknown;
  active?: unknown;
  parentFacility?: unknown;
  notes?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
}): FacilityDto {
  return {
    id: String(doc.id),
    name: String(doc.name ?? ""),
    code: String(doc.code ?? ""),
    facilityType: isFacilityType(doc.facilityType) ? doc.facilityType : "other",
    country: optionalString(doc.country)?.toUpperCase() ?? null,
    region: optionalString(doc.region),
    address: optionalString(doc.address),
    active: doc.active !== false,
    parentId: relationId(doc.parentFacility),
    notes: optionalString(doc.notes),
    meterCount: 0,
    createdAt: String(doc.createdAt ?? ""),
    updatedAt: String(doc.updatedAt ?? ""),
  };
}

export function docToMeter(doc: {
  id: string;
  facility?: unknown;
  name?: unknown;
  utility?: unknown;
  unit?: unknown;
  externalId?: unknown;
  active?: unknown;
  notes?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
}): MeterDto {
  return {
    id: String(doc.id),
    facilityId: relationId(doc.facility) ?? "",
    name: String(doc.name ?? ""),
    utility: isMeterUtility(doc.utility) ? doc.utility : "electricity",
    unit: String(doc.unit ?? ""),
    externalId: optionalString(doc.externalId),
    active: doc.active !== false,
    notes: optionalString(doc.notes),
    createdAt: String(doc.createdAt ?? ""),
    updatedAt: String(doc.updatedAt ?? ""),
  };
}

export async function listOrgFacilities(
  payload: Payload,
  organisationId: string,
): Promise<FacilityDto[]> {
  const result = await payload.find({
    collection: FACILITIES_SLUG,
    where: { organisation: { equals: organisationId } },
    depth: 0,
    limit: 500,
    sort: "name",
    overrideAccess: true,
  });
  return result.docs.map((d) => docToFacility(d));
}

export async function listOrgMeters(
  payload: Payload,
  organisationId: string,
  facilityId?: string,
): Promise<MeterDto[]> {
  const clauses: Where[] = [{ organisation: { equals: organisationId } }];
  if (facilityId) {
    clauses.push({ facility: { equals: facilityId } });
  }
  const result = await payload.find({
    collection: METERS_SLUG,
    where: { and: clauses },
    depth: 0,
    limit: 1000,
    sort: "name",
    overrideAccess: true,
  });
  return result.docs.map((d) => docToMeter(d));
}

export async function getOrgFacility(
  payload: Payload,
  organisationId: string,
  id: string,
): Promise<FacilityDto | null> {
  const doc = await payload
    .findByID({
      collection: FACILITIES_SLUG,
      id,
      depth: 0,
      overrideAccess: true,
    })
    .catch(() => null);
  if (!doc) return null;
  const orgId = relationId(doc.organisation);
  if (orgId !== organisationId) return null;
  return docToFacility(doc);
}

export async function getOrgMeter(
  payload: Payload,
  organisationId: string,
  id: string,
): Promise<MeterDto | null> {
  const doc = await payload
    .findByID({
      collection: METERS_SLUG,
      id,
      depth: 0,
      overrideAccess: true,
    })
    .catch(() => null);
  if (!doc) return null;
  const orgId = relationId(doc.organisation);
  if (orgId !== organisationId) return null;
  return docToMeter(doc);
}

export async function buildFacilitiesIndex(
  payload: Payload,
  organisationId: string,
): Promise<FacilitiesIndex> {
  const [facilities, meters] = await Promise.all([
    listOrgFacilities(payload, organisationId),
    listOrgMeters(payload, organisationId),
  ]);

  const meterCountByFacility = new Map<string, number>();
  for (const m of meters) {
    meterCountByFacility.set(
      m.facilityId,
      (meterCountByFacility.get(m.facilityId) ?? 0) + 1,
    );
  }

  const withCounts = facilities.map((f) => ({
    ...f,
    meterCount: meterCountByFacility.get(f.id) ?? 0,
  }));

  const nodes: FacilityNode[] = withCounts.map((f) => ({
    id: f.id,
    name: f.name,
    code: f.code,
    facilityType: f.facilityType,
    country: f.country,
    region: f.region,
    address: f.address,
    active: f.active,
    parentId: f.parentId,
    notes: f.notes,
  }));
  const meterRows: MeterRow[] = meters.map((m) => ({
    id: m.id,
    facilityId: m.facilityId,
    name: m.name,
    utility: m.utility,
    unit: m.unit,
    externalId: m.externalId,
    active: m.active,
    notes: m.notes,
  }));

  const forest = buildFacilityForest(nodes, meterRows);
  const flat = flattenFacilityForest(forest);
  const rollups = rollupFacilityMeters(nodes, meterRows);

  return {
    facilities: withCounts,
    meters,
    forest,
    flat,
    rollups,
  };
}

export async function assertFacilityParentOk(
  payload: Payload,
  organisationId: string,
  facilityId: string | null,
  parentId: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!parentId) return { ok: true };

  const parent = await getOrgFacility(payload, organisationId, parentId);
  if (!parent) {
    return { ok: false, error: "parentFacility must belong to this organisation" };
  }

  if (!facilityId) return { ok: true };

  const all = await listOrgFacilities(payload, organisationId);
  if (
    wouldCreateCircularFacility(
      all.map((f) => ({ id: f.id, parentId: f.parentId })),
      facilityId,
      parentId,
    )
  ) {
    return {
      ok: false,
      error: "Circular facility hierarchy rejected. A site cannot be its own ancestor.",
    };
  }
  return { ok: true };
}

export async function assertCodeUnique(
  payload: Payload,
  organisationId: string,
  code: string,
  excludeId?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const normalised = code.trim();
  const result = await payload.find({
    collection: FACILITIES_SLUG,
    where: {
      and: [
        { organisation: { equals: organisationId } },
        { code: { equals: normalised } },
      ],
    },
    depth: 0,
    limit: 5,
    overrideAccess: true,
  });
  const clash = result.docs.find((d) => String(d.id) !== excludeId);
  if (clash) {
    return {
      ok: false,
      error: `Facility code "${normalised}" already exists in this organisation`,
    };
  }
  return { ok: true };
}

export type FacilityWriteInput = {
  name: string;
  code: string;
  facilityType: FacilityType;
  country?: string | null;
  region?: string | null;
  address?: string | null;
  active?: boolean;
  parentFacilityId?: string | null;
  notes?: string | null;
};

export type MeterWriteInput = {
  facilityId: string;
  name: string;
  utility: MeterUtility;
  unit: string;
  externalId?: string | null;
  active?: boolean;
  notes?: string | null;
};

export { relationId };
