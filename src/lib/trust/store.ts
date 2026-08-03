import type { Payload, Where } from "payload";

import { TRUST_CONTROL_EVENTS_SLUG } from "@/collections/TrustControlEvents";
import type { TrustControlStatus } from "@/lib/trust/types";

export type TrustControlEventDoc = {
  id: string;
  organisation: string | { id: string };
  controlId: string;
  status: TrustControlStatus;
  note?: string | null;
  actor?: string | { id: string } | null;
  createdAt: string;
  updatedAt: string;
};

type FindArgs = {
  where: Where;
  limit?: number;
  sort?: string;
  depth?: number;
};

type FindResult = {
  docs: TrustControlEventDoc[];
  totalDocs: number;
};

export type CreateTrustControlEventData = {
  organisation: string;
  controlId: string;
  status: TrustControlStatus;
  note?: string | null;
  actor?: string | null;
};

/** Narrow Payload ops for trust-control-events (may precede generated types). */
export async function findTrustControlEvents(
  payload: Payload,
  args: FindArgs,
): Promise<FindResult> {
  return (
    payload.find as (a: {
      collection: typeof TRUST_CONTROL_EVENTS_SLUG;
      where: Where;
      limit?: number;
      sort?: string;
      depth?: number;
      overrideAccess: true;
    }) => Promise<FindResult>
  )({
    collection: TRUST_CONTROL_EVENTS_SLUG,
    where: args.where,
    limit: args.limit,
    sort: args.sort,
    depth: args.depth ?? 0,
    overrideAccess: true,
  });
}

export async function createTrustControlEvent(
  payload: Payload,
  data: CreateTrustControlEventData,
): Promise<TrustControlEventDoc & { id: string }> {
  return (
    payload.create as (a: {
      collection: typeof TRUST_CONTROL_EVENTS_SLUG;
      data: CreateTrustControlEventData;
      overrideAccess: true;
    }) => Promise<TrustControlEventDoc & { id: string }>
  )({
    collection: TRUST_CONTROL_EVENTS_SLUG,
    data,
    overrideAccess: true,
  });
}
