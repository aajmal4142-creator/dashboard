import type { Payload } from "payload";

export type AuditWriteInput = {
  organisationId: string;
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
  userAgent?: string | null;
};

/** Append-only audit event. Never throws to callers — logs on failure. */
export async function writeAuditLog(
  payload: Payload,
  input: AuditWriteInput,
): Promise<void> {
  try {
    // Payload's create overload narrows oddly when optional JSON fields are present.
    await (
      payload.create as (args: {
        collection: "audit-logs";
        data: Record<string, unknown>;
        overrideAccess: true;
      }) => Promise<unknown>
    )({
      collection: "audit-logs",
      data: {
        organisation: input.organisationId,
        ...(input.actorId ? { actor: input.actorId } : {}),
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        ...(input.before !== undefined ? { before: input.before } : {}),
        ...(input.after !== undefined ? { after: input.after } : {}),
        ...(input.ip ? { ip: input.ip } : {}),
        ...(input.userAgent ? { userAgent: input.userAgent } : {}),
      },
      overrideAccess: true,
    });
  } catch (err) {
    console.error("[audit] write failed", err);
  }
}
