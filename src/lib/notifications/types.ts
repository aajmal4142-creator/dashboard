export const NOTIFICATION_TYPES = [
  "datapoint_approved",
  "report_ready",
  "audit_complete",
  "alert_triggered",
  "supplier_response",
  "request_escalated",
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export type NotificationResourceType =
  "datapoint" | "report" | "audit" | "alert" | "supplier" | string;

export type CreateNotificationInput = {
  organisationId: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  resourceType: NotificationResourceType;
  resourceId: string;
};

export type NotificationItem = {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  resourceType: string;
  resourceId: string;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
};

export type NotificationGroup = {
  type: NotificationType;
  label: string;
  items: NotificationItem[];
};

export type NotificationListDoc = {
  id: string;
  userId?: string | { id?: string } | null;
  organisationId?: string | { id?: string } | null;
  type?: string | null;
  title?: string | null;
  message?: string | null;
  resourceType?: string | null;
  resourceId?: string | null;
  isRead?: boolean | null;
  readAt?: string | Date | null;
  createdAt?: string | null;
};
