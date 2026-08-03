import type { Payload, Where } from "payload";

import type { FactorRecord } from "@/lib/calc";
import type { EmissionFactor } from "@/payload-types";
import { isEmissionsStandard, type EmissionsStandard } from "@/lib/factors/standards";
import {
  validateFactorKey,
  validateFactorRegion,
  validateFactorValue,
  validateFactorYear,
} from "@/lib/factors/validate";

export type FactorAdminRow = {
  id: string;
  key: string;
  label: string;
  value: number;
  unit: string;
  scope: "1" | "2" | "3";
  source: string;
  sourceCitation: string;
  standard: string;
  publicationYear: number;
  region: string;
  status: "active" | "deactivated";
  ownership: "global" | "custom";
  validFrom: string;
  validUntil: string | null;
  attributionText: string;
};

export type CreateOrgFactorInput = {
  key: string;
  value: number;
  unit: string;
  /** Free-text citation shown in attribution; registry source is always Custom. */
  source: string;
  year: number;
  geography?: string;
  scope?: "1" | "2" | "3";
  label?: string;
  standard?: EmissionsStandard;
};

function relationId(value: unknown): string | null {
  if (typeof value === "string" && value) return value;
  if (value && typeof value === "object" && "id" in value) {
    const id = (value as { id: unknown }).id;
    return typeof id === "string" ? id : null;
  }
  return null;
}

function factorStatus(doc: EmissionFactor): "active" | "deactivated" {
  return doc.status === "deactivated" ? "deactivated" : "active";
}

export function mapFactorAdminRow(doc: EmissionFactor, orgId: string): FactorAdminRow {
  const org = relationId(doc.organisation);
  return {
    id: String(doc.id),
    key: doc.key,
    label: doc.label,
    value: doc.value,
    unit: doc.unit,
    scope: doc.scope,
    source: doc.source,
    sourceCitation: doc.attributionText,
    standard: doc.standard,
    publicationYear: doc.publicationYear,
    region: doc.region,
    status: factorStatus(doc),
    ownership: org === orgId ? "custom" : "global",
    validFrom: String(doc.validFrom),
    validUntil: doc.validUntil ? String(doc.validUntil) : null,
    attributionText: doc.attributionText,
  };
}

export function docToFactorRecord(doc: EmissionFactor): FactorRecord {
  return {
    id: String(doc.id),
    key: doc.key,
    value: doc.value,
    unit: doc.unit,
    source: doc.source,
    standard: isEmissionsStandard(doc.standard) ? doc.standard : undefined,
    publicationYear: doc.publicationYear,
    region: doc.region,
    validFrom: doc.validFrom ? String(doc.validFrom) : undefined,
    validUntil: doc.validUntil ? String(doc.validUntil) : undefined,
    uncertaintyPct:
      typeof doc.uncertaintyPct === "number" && Number.isFinite(doc.uncertaintyPct)
        ? doc.uncertaintyPct
        : undefined,
  };
}

/** Global seed rows: no organisation, and active (legacy rows without status count as active). */
export function globalActiveFactorWhere(standard?: EmissionsStandard): Where {
  const clauses: Where[] = [
    { organisation: { exists: false } },
    {
      or: [{ status: { equals: "active" } }, { status: { exists: false } }],
    },
  ];
  if (standard) {
    clauses.push({ standard: { equals: standard } });
  }
  return { and: clauses };
}

export function orgCustomFactorWhere(
  orgId: string,
  opts: { status?: "active" | "deactivated" | "all" } = {},
): Where {
  const clauses: Where[] = [{ organisation: { equals: orgId } }];
  if (opts.status === "active") {
    clauses.push({ status: { equals: "active" } });
  } else if (opts.status === "deactivated") {
    clauses.push({ status: { equals: "deactivated" } });
  }
  return { and: clauses };
}

export function parseCreateOrgFactorBody(
  body: unknown,
): { ok: true; data: CreateOrgFactorInput } | { ok: false; error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Body must be an object." };
  }
  const obj = body as Record<string, unknown>;

  const keyResult = validateFactorKey(obj.key);
  if (!keyResult.ok) return keyResult;

  let yearRaw: unknown = obj.year;
  if (typeof yearRaw === "string" && yearRaw.trim() !== "") {
    yearRaw = Number(yearRaw);
  }
  const yearResult = validateFactorYear(yearRaw);
  if (!yearResult.ok) return yearResult;

  let valueRaw: unknown = obj.value;
  if (typeof valueRaw === "string" && valueRaw.trim() !== "") {
    valueRaw = Number(valueRaw);
  }
  const valueResult = validateFactorValue(valueRaw);
  if (!valueResult.ok) return valueResult;

  if (typeof obj.unit !== "string" || !obj.unit.trim()) {
    return { ok: false, error: "unit is required." };
  }

  if (typeof obj.source !== "string" || !obj.source.trim()) {
    return {
      ok: false,
      error: "source is required (citation for this custom factor).",
    };
  }

  const regionResult = validateFactorRegion(obj.geography);
  if (!regionResult.ok) return regionResult;

  let scope: "1" | "2" | "3" = "1";
  if (obj.scope !== undefined && obj.scope !== null && obj.scope !== "") {
    if (obj.scope !== "1" && obj.scope !== "2" && obj.scope !== "3") {
      return { ok: false, error: 'scope must be "1", "2", or "3" when provided.' };
    }
    scope = obj.scope;
  }

  let standard: EmissionsStandard | undefined;
  if (obj.standard !== undefined && obj.standard !== null && obj.standard !== "") {
    if (!isEmissionsStandard(obj.standard)) {
      return { ok: false, error: "standard must be DEFRA, IPCC, or GHGProtocol2004." };
    }
    standard = obj.standard;
  }

  let label: string | undefined;
  if (obj.label !== undefined) {
    if (typeof obj.label !== "string" || !obj.label.trim()) {
      return { ok: false, error: "label must be a non-empty string when provided." };
    }
    label = obj.label.trim();
  }

  return {
    ok: true,
    data: {
      key: keyResult.key,
      value: valueResult.value,
      unit: obj.unit.trim(),
      source: obj.source.trim(),
      year: yearResult.year,
      geography: regionResult.region,
      scope,
      label,
      standard,
    },
  };
}

function humaniseKey(key: string): string {
  return key
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export async function listOrgFactorAdmin(
  payload: Payload,
  orgId: string,
  opts: { includeGlobal?: boolean; q?: string } = {},
): Promise<FactorAdminRow[]> {
  const custom = await payload.find({
    collection: "emission-factors",
    where: orgCustomFactorWhere(orgId),
    limit: 500,
    sort: "-updatedAt",
    depth: 0,
    overrideAccess: true,
  });

  const rows = custom.docs.map((doc) => mapFactorAdminRow(doc, orgId));

  if (opts.includeGlobal) {
    const global = await payload.find({
      collection: "emission-factors",
      where: globalActiveFactorWhere(),
      limit: 500,
      sort: "key",
      depth: 0,
      overrideAccess: true,
    });
    for (const doc of global.docs) {
      rows.push(mapFactorAdminRow(doc, orgId));
    }
  }

  const q = opts.q?.trim().toLowerCase();
  if (!q) return rows;

  return rows.filter((row) => {
    const hay = [
      row.key,
      row.label,
      row.unit,
      row.source,
      row.sourceCitation,
      row.region,
      String(row.publicationYear),
      row.ownership,
      row.status,
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}

export async function createOrgCustomFactor(
  payload: Payload,
  orgId: string,
  input: CreateOrgFactorInput,
  standard: EmissionsStandard,
): Promise<EmissionFactor> {
  const year = input.year;
  const region = input.geography ?? "GLOBAL";
  const citation = input.source;
  const label = input.label ?? humaniseKey(input.key);

  return payload.create({
    collection: "emission-factors",
    data: {
      organisation: orgId,
      key: input.key,
      label,
      value: input.value,
      unit: input.unit,
      scope: input.scope ?? "1",
      source: "Custom",
      standard: input.standard ?? standard,
      sourceUrl: `custom://org/${orgId}/${input.key}`,
      publicationYear: year,
      region,
      validFrom: `${year}-01-01`,
      status: "active",
      licence: "Organisation custom factor",
      attributionText: `Organisation custom emission factor. Citation: ${citation}. Not a seeded registry value — missing keys still throw in calc.`,
    },
    overrideAccess: true,
  });
}

export async function deactivateOrgCustomFactor(
  payload: Payload,
  orgId: string,
  factorId: string,
): Promise<
  { ok: true; factor: EmissionFactor } | { ok: false; status: 404 | 403; error: string }
> {
  let doc: EmissionFactor;
  try {
    doc = await payload.findByID({
      collection: "emission-factors",
      id: factorId,
      depth: 0,
      overrideAccess: true,
    });
  } catch {
    return { ok: false, status: 404, error: "Factor not found." };
  }

  if (relationId(doc.organisation) !== orgId) {
    return {
      ok: false,
      status: 403,
      error:
        "Only organisation custom factors can be deactivated. Global seeds are read-only.",
    };
  }

  if (doc.status === "deactivated") {
    return { ok: true, factor: doc };
  }

  const updated = await payload.update({
    collection: "emission-factors",
    id: factorId,
    data: {
      status: "deactivated",
      validUntil: new Date().toISOString(),
    },
    overrideAccess: true,
  });

  return { ok: true, factor: updated };
}

export async function loadOrgCustomFactorRecords(
  payload: Payload,
  orgId: string,
  standard?: EmissionsStandard,
): Promise<FactorRecord[]> {
  const where: Where = {
    and: [
      { organisation: { equals: orgId } },
      { status: { equals: "active" } },
      ...(standard ? [{ standard: { equals: standard } }] : []),
    ],
  };

  const result = await payload.find({
    collection: "emission-factors",
    where,
    limit: 500,
    depth: 0,
    overrideAccess: true,
  });

  return result.docs.map(docToFactorRecord);
}
