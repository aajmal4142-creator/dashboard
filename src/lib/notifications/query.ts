import type { Where } from "payload";

import { NOTIFICATION_TYPES, type NotificationType } from "./types";

export function isNotificationType(value: string): value is NotificationType {
  return (NOTIFICATION_TYPES as readonly string[]).includes(value);
}

export function buildUserOrgNotificationWhere(
  userId: string,
  organisationId: string,
  opts?: { unreadOnly?: boolean },
): Where {
  const clauses: Where[] = [
    { userId: { equals: userId } },
    { organisationId: { equals: organisationId } },
  ];
  if (opts?.unreadOnly === true) {
    clauses.push({ isRead: { equals: false } });
  }
  return { and: clauses };
}

export function buildUnreadCountWhere(userId: string, organisationId: string): Where {
  return buildUserOrgNotificationWhere(userId, organisationId, {
    unreadOnly: true,
  });
}

export function parseNotificationListParams(searchParams: URLSearchParams): {
  limit: number;
  unreadOnly: boolean;
} {
  const rawLimit = Number(searchParams.get("limit") ?? "20");
  const limit =
    Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(Math.floor(rawLimit), 50) : 20;
  const unreadRaw = searchParams.get("unreadOnly");
  const unreadOnly = unreadRaw === "true" || unreadRaw === "1";
  return { limit, unreadOnly };
}

/** Payload update payload for marking a notification read. */
export function markReadData(at: Date = new Date()): {
  isRead: true;
  readAt: string;
} {
  return {
    isRead: true,
    readAt: at.toISOString(),
  };
}

/** Payload update payload for marking all unread as read. */
export function markAllReadData(at: Date = new Date()): {
  isRead: true;
  readAt: string;
} {
  return markReadData(at);
}
