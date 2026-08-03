import { isNotificationType } from "./query";
import type {
  NotificationGroup,
  NotificationItem,
  NotificationListDoc,
  NotificationType,
} from "./types";

const TYPE_LABELS: Record<NotificationType, string> = {
  datapoint_approved: "Datapoint approved",
  report_ready: "Report ready",
  audit_complete: "Audit complete",
  alert_triggered: "Alerts",
  supplier_response: "Supplier responses",
  request_escalated: "Request escalations",
};

export function notificationTypeLabel(type: NotificationType): string {
  return TYPE_LABELS[type];
}

export function mapNotificationDoc(doc: NotificationListDoc): NotificationItem | null {
  if (!doc.id || typeof doc.type !== "string" || !isNotificationType(doc.type)) {
    return null;
  }
  const title = typeof doc.title === "string" ? doc.title.trim() : "";
  const message = typeof doc.message === "string" ? doc.message.trim() : "";
  if (!title || !message) return null;

  const readAt =
    doc.readAt == null
      ? null
      : typeof doc.readAt === "string"
        ? doc.readAt
        : doc.readAt instanceof Date
          ? doc.readAt.toISOString()
          : String(doc.readAt);

  return {
    id: String(doc.id),
    type: doc.type,
    title,
    message,
    resourceType: typeof doc.resourceType === "string" ? doc.resourceType : "unknown",
    resourceId: typeof doc.resourceId === "string" ? doc.resourceId : "",
    isRead: doc.isRead === true,
    readAt,
    createdAt:
      typeof doc.createdAt === "string" ? doc.createdAt : new Date(0).toISOString(),
  };
}

/** Group notifications by type, preserving first-seen type order then item order. */
export function groupNotificationsByType(items: NotificationItem[]): NotificationGroup[] {
  const order: NotificationType[] = [];
  const buckets = new Map<NotificationType, NotificationItem[]>();

  for (const item of items) {
    if (!buckets.has(item.type)) {
      buckets.set(item.type, []);
      order.push(item.type);
    }
    buckets.get(item.type)!.push(item);
  }

  return order.map((type) => ({
    type,
    label: notificationTypeLabel(type),
    items: buckets.get(type) ?? [],
  }));
}
