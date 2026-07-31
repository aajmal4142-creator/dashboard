import type { ActivityItem } from "./map";

const CSV_HEADERS = [
  "timestamp",
  "user",
  "action",
  "activity_type",
  "resource_type",
  "resource",
  "details",
] as const;

function escapeCsvCell(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function activitiesToCsv(activities: ActivityItem[]): string {
  const lines = [CSV_HEADERS.join(",")];
  for (const a of activities) {
    const row = [
      a.createdAt,
      a.actorName,
      a.action,
      a.activityType,
      a.entityType,
      a.resourceLabel,
      a.details,
    ].map((cell) => escapeCsvCell(cell));
    lines.push(row.join(","));
  }
  return lines.join("\n");
}
