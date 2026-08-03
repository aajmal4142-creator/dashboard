import type { Payload } from "payload";

import {
  TRUST_CHECKLIST_CONTROLS,
  computeChecklistProgress,
  resolveLatestStatuses,
  type ChecklistItemState,
  type ChecklistProgress,
  type TrustChecklistControl,
} from "@/lib/trust";
import { findTrustControlEvents } from "@/lib/trust/store";

export type TrustChecklistSnapshot = {
  controls: TrustChecklistControl[];
  items: ChecklistItemState[];
  progress: ChecklistProgress;
  eventCount: number;
};

function orgIdOf(doc: { organisation: string | { id: string } }): string {
  return typeof doc.organisation === "string" ? doc.organisation : doc.organisation.id;
}

/** Load org checklist snapshot (overrideAccess — caller must Membership-gate). */
export async function loadTrustChecklistSnapshot(
  payload: Payload,
  organisationId: string,
): Promise<TrustChecklistSnapshot> {
  const result = await findTrustControlEvents(payload, {
    where: { organisation: { equals: organisationId } },
    limit: 500,
    sort: "createdAt",
  });

  const events = result.docs
    .filter((d) => orgIdOf(d) === organisationId)
    .map((d) => ({
      controlId: d.controlId,
      status: d.status,
      note: d.note ?? null,
      createdAt: d.createdAt,
    }));

  const items = resolveLatestStatuses(TRUST_CHECKLIST_CONTROLS, events);
  const progress = computeChecklistProgress(items);

  return {
    controls: TRUST_CHECKLIST_CONTROLS,
    items,
    progress,
    eventCount: events.length,
  };
}
