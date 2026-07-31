import type { Where } from "payload";

import { normalizeWidgets } from "./normalize";
import type {
  CreateDashboardInput,
  DashboardLayoutSummary,
  DashboardLayoutDoc,
  DashboardWidget,
  UpdateDashboardInput,
} from "./types";

export function buildUserOrgLayoutWhere(userId: string, organisationId: string): Where {
  return {
    and: [{ userId: { equals: userId } }, { organisationId: { equals: organisationId } }],
  };
}

export function buildDefaultLayoutWhere(userId: string, organisationId: string): Where {
  return {
    and: [
      { userId: { equals: userId } },
      { organisationId: { equals: organisationId } },
      { isDefault: { equals: true } },
    ],
  };
}

function relId(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "id" in value) {
    const id = (value as { id?: unknown }).id;
    return typeof id === "string" ? id : null;
  }
  return null;
}

export function mapLayoutDoc(doc: DashboardLayoutDoc): DashboardLayoutSummary | null {
  if (!doc.id || typeof doc.name !== "string" || !doc.name.trim()) {
    return null;
  }
  return {
    id: doc.id,
    name: doc.name.trim(),
    isDefault: doc.isDefault === true,
    widgets: normalizeWidgets(doc.widgets),
    createdAt: typeof doc.createdAt === "string" ? doc.createdAt : "",
    updatedAt: typeof doc.updatedAt === "string" ? doc.updatedAt : "",
  };
}

export function ownershipMatches(
  doc: DashboardLayoutDoc,
  userId: string,
  organisationId: string,
): boolean {
  return relId(doc.userId) === userId && relId(doc.organisationId) === organisationId;
}

function parseName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 80) return null;
  return trimmed;
}

/** Parse POST body for creating a layout. */
export function parseCreateBody(
  body: unknown,
): { ok: true; data: CreateDashboardInput } | { ok: false; error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Body must be a JSON object." };
  }
  const raw = body as Record<string, unknown>;
  const name = parseName(raw.name);
  if (!name) {
    return { ok: false, error: "name is required (1–80 characters)." };
  }

  const widgets: DashboardWidget[] = Array.isArray(raw.widgets)
    ? normalizeWidgets(raw.widgets)
    : [];

  return {
    ok: true,
    data: {
      name,
      widgets,
      isDefault: raw.isDefault === true,
    },
  };
}

/** Parse PATCH body for updating a layout. */
export function parseUpdateBody(
  body: unknown,
): { ok: true; data: UpdateDashboardInput } | { ok: false; error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Body must be a JSON object." };
  }
  const raw = body as Record<string, unknown>;
  const data: UpdateDashboardInput = {};

  if ("name" in raw) {
    const name = parseName(raw.name);
    if (!name) {
      return { ok: false, error: "name must be 1–80 characters." };
    }
    data.name = name;
  }

  if ("widgets" in raw) {
    if (!Array.isArray(raw.widgets)) {
      return { ok: false, error: "widgets must be an array." };
    }
    data.widgets = normalizeWidgets(raw.widgets);
  }

  if ("isDefault" in raw) {
    if (typeof raw.isDefault !== "boolean") {
      return { ok: false, error: "isDefault must be a boolean." };
    }
    data.isDefault = raw.isDefault;
  }

  if (
    data.name === undefined &&
    data.widgets === undefined &&
    data.isDefault === undefined
  ) {
    return {
      ok: false,
      error: "Provide name, widgets, and/or isDefault to update.",
    };
  }

  return { ok: true, data };
}

export function newWidgetDraft(
  type: DashboardWidget["type"],
  title: string,
  metric: string,
): DashboardWidget {
  return {
    id: `widget_${Date.now()}`,
    type,
    title,
    position: { x: 0, y: 0 },
    size:
      type === "metric"
        ? { w: 3, h: 3 }
        : type === "chart"
          ? { w: 12, h: 6 }
          : { w: 6, h: 4 },
    config: { metric, timeRange: "3m", filters: {} },
  };
}
