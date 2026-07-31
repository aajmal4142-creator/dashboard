import type { Payload, Where } from "payload";

import type { CustomMetricCategory, CustomMetricDoc } from "./customTypes";

type FindArgs = {
  where: Where;
  limit?: number;
  sort?: string;
  depth?: number;
};

type FindResult = {
  docs: CustomMetricDoc[];
  totalDocs: number;
};

type MutateResult = CustomMetricDoc & { id: string };

type CreateData = {
  key: string;
  label: string;
  description: string;
  unit: string;
  formula: string;
  category: CustomMetricCategory;
  enabled: boolean;
  usageCount: number;
  source: "custom";
  organisation: string;
  createdBy?: string;
  frameworkMappings?: [];
};

type UpdateData = {
  label?: string;
  description?: string;
  unit?: string;
  formula?: string;
  category?: CustomMetricCategory;
  enabled?: boolean;
  usageCount?: number;
};

/** Narrow Payload ops for derived-metric-definitions (may precede generated types). */
export async function findDerivedMetricDefs(
  payload: Payload,
  args: FindArgs,
): Promise<FindResult> {
  return (
    payload.find as (a: {
      collection: "derived-metric-definitions";
      where: Where;
      limit?: number;
      sort?: string;
      depth?: number;
      overrideAccess: true;
    }) => Promise<FindResult>
  )({
    collection: "derived-metric-definitions",
    where: args.where,
    limit: args.limit,
    sort: args.sort,
    depth: args.depth ?? 0,
    overrideAccess: true,
  });
}

export async function findDerivedMetricDefById(
  payload: Payload,
  id: string,
): Promise<MutateResult> {
  return (
    payload.findByID as (a: {
      collection: "derived-metric-definitions";
      id: string;
      depth: number;
      overrideAccess: true;
    }) => Promise<MutateResult>
  )({
    collection: "derived-metric-definitions",
    id,
    depth: 0,
    overrideAccess: true,
  });
}

export async function createDerivedMetricDef(
  payload: Payload,
  data: CreateData,
): Promise<MutateResult> {
  return (
    payload.create as (a: {
      collection: "derived-metric-definitions";
      data: CreateData;
      overrideAccess: true;
    }) => Promise<MutateResult>
  )({
    collection: "derived-metric-definitions",
    data,
    overrideAccess: true,
  });
}

export async function updateDerivedMetricDef(
  payload: Payload,
  id: string,
  data: UpdateData,
): Promise<MutateResult> {
  return (
    payload.update as (a: {
      collection: "derived-metric-definitions";
      id: string;
      data: UpdateData;
      overrideAccess: true;
    }) => Promise<MutateResult>
  )({
    collection: "derived-metric-definitions",
    id,
    data,
    overrideAccess: true,
  });
}

export async function deleteDerivedMetricDef(
  payload: Payload,
  id: string,
): Promise<void> {
  await (
    payload.delete as (a: {
      collection: "derived-metric-definitions";
      id: string;
      overrideAccess: true;
    }) => Promise<unknown>
  )({
    collection: "derived-metric-definitions",
    id,
    overrideAccess: true,
  });
}

export async function findMetricDefinitionKeys(
  payload: Payload,
): Promise<Array<{ key: string; label: string; unit: string | null }>> {
  const result = await (
    payload.find as (a: {
      collection: "metric-definitions";
      limit: number;
      depth: number;
      overrideAccess: true;
    }) => Promise<{
      docs: Array<{
        key?: string | null;
        label?: string | null;
        unit?: string | null;
      }>;
    }>
  )({
    collection: "metric-definitions",
    limit: 500,
    depth: 0,
    overrideAccess: true,
  });

  return result.docs
    .filter((d): d is { key: string; label: string; unit?: string | null } =>
      Boolean(d.key && d.label),
    )
    .map((d) => ({
      key: d.key,
      label: d.label,
      unit: d.unit ?? null,
    }));
}
