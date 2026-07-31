import type { Payload } from "payload";

import type { CreateNotificationInput } from "./types";

type CreateResult = { id: string };

/**
 * Server-only writer. Never throws to callers — logs on failure so mutations
 * (approve / publish / audit) are not blocked by notification I/O.
 */
export async function createNotification(
  payload: Payload,
  input: CreateNotificationInput,
): Promise<string | null> {
  try {
    const created = await (
      payload.create as (args: {
        collection: "notifications";
        data: Record<string, unknown>;
        overrideAccess: true;
      }) => Promise<CreateResult>
    )({
      collection: "notifications",
      data: {
        userId: input.userId,
        organisationId: input.organisationId,
        type: input.type,
        title: input.title,
        message: input.message,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        isRead: false,
      },
      overrideAccess: true,
    });
    return created.id;
  } catch (err) {
    console.error("[notifications] create failed", err);
    return null;
  }
}

export type NotifyOrgMembersInput = Omit<CreateNotificationInput, "userId"> & {
  /** Skip these user ids (e.g. the actor who triggered the event). */
  excludeUserIds?: string[];
};

/**
 * Fan-out one notification per active membership in the organisation.
 * Returns count of successfully created rows.
 */
export async function notifyOrganisationMembers(
  payload: Payload,
  input: NotifyOrgMembersInput,
): Promise<number> {
  try {
    const memberships = await payload.find({
      collection: "memberships",
      where: {
        and: [
          { organisation: { equals: input.organisationId } },
          { status: { equals: "active" } },
        ],
      },
      limit: 500,
      depth: 0,
      overrideAccess: true,
    });

    const exclude = new Set(input.excludeUserIds ?? []);
    const userIds: string[] = [];
    for (const m of memberships.docs) {
      const uid =
        typeof m.user === "string"
          ? m.user
          : m.user && typeof m.user === "object" && "id" in m.user
            ? String((m.user as { id: string }).id)
            : null;
      if (!uid || exclude.has(uid)) continue;
      if (!userIds.includes(uid)) userIds.push(uid);
    }

    let created = 0;
    for (const userId of userIds) {
      const id = await createNotification(payload, {
        organisationId: input.organisationId,
        userId,
        type: input.type,
        title: input.title,
        message: input.message,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
      });
      if (id) created += 1;
    }
    return created;
  } catch (err) {
    console.error("[notifications] org fan-out failed", err);
    return 0;
  }
}
