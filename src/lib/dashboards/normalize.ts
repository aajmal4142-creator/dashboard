import {
  GRID_COLUMNS,
  MAX_WIDGET_H,
  MAX_WIDGET_W,
  MAX_WIDGETS,
  MIN_WIDGET_H,
  MIN_WIDGET_W,
  TIME_RANGES,
  WIDGET_TYPES,
  type DashboardWidget,
  type TimeRange,
  type WidgetConfig,
  type WidgetType,
} from "./types";

export function isWidgetType(value: string): value is WidgetType {
  return (WIDGET_TYPES as readonly string[]).includes(value);
}

export function isTimeRange(value: string): value is TimeRange {
  return (TIME_RANGES as readonly string[]).includes(value);
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function normalizeFilters(
  value: unknown,
): Record<string, string | number | boolean | null> {
  const raw = asRecord(value);
  if (!raw) return {};
  const out: Record<string, string | number | boolean | null> = {};
  for (const [key, v] of Object.entries(raw)) {
    if (
      typeof v === "string" ||
      typeof v === "number" ||
      typeof v === "boolean" ||
      v === null
    ) {
      out[key] = v;
    }
  }
  return out;
}

function normalizeConfig(value: unknown): WidgetConfig {
  const raw = asRecord(value) ?? {};
  const metric =
    typeof raw.metric === "string" && raw.metric.trim()
      ? raw.metric.trim()
      : "scope1_total";
  const timeRangeRaw = typeof raw.timeRange === "string" ? raw.timeRange : "3m";
  const timeRange = isTimeRange(timeRangeRaw) ? timeRangeRaw : "3m";
  return {
    metric,
    timeRange,
    filters: normalizeFilters(raw.filters),
  };
}

function ensureWidgetId(rawId: unknown, index: number): string {
  if (typeof rawId === "string" && rawId.trim()) return rawId.trim();
  return `widget_${index + 1}`;
}

/**
 * Normalize one raw widget. Returns null when type/title cannot be recovered.
 */
export function normalizeWidget(value: unknown, index: number): DashboardWidget | null {
  const raw = asRecord(value);
  if (!raw) return null;

  const typeRaw = typeof raw.type === "string" ? raw.type : "";
  if (!isWidgetType(typeRaw)) return null;

  const title =
    typeof raw.title === "string" && raw.title.trim() ? raw.title.trim() : null;
  if (!title) return null;

  const positionRaw = asRecord(raw.position) ?? {};
  const sizeRaw = asRecord(raw.size) ?? {};

  const w = clampInt(sizeRaw.w, MIN_WIDGET_W, MAX_WIDGET_W, 6);
  const h = clampInt(sizeRaw.h, MIN_WIDGET_H, MAX_WIDGET_H, 3);
  const x = clampInt(positionRaw.x, 0, GRID_COLUMNS - w, 0);
  const y = clampInt(positionRaw.y, 0, 99, index);

  return {
    id: ensureWidgetId(raw.id, index),
    type: typeRaw,
    title,
    position: { x, y },
    size: { w, h },
    config: normalizeConfig(raw.config),
  };
}

/**
 * Deduplicate ids, clamp grid coords, sort by row then column, cap count.
 */
export function normalizeWidgets(value: unknown): DashboardWidget[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const widgets: DashboardWidget[] = [];

  for (let i = 0; i < value.length; i += 1) {
    if (widgets.length >= MAX_WIDGETS) break;
    const widget = normalizeWidget(value[i], i);
    if (!widget) continue;

    let id = widget.id;
    if (seen.has(id)) {
      id = `${id}_${i + 1}`;
    }
    seen.add(id);
    widgets.push({ ...widget, id });
  }

  return sortWidgets(widgets);
}

export function sortWidgets(widgets: DashboardWidget[]): DashboardWidget[] {
  return [...widgets].sort((a, b) => {
    if (a.position.y !== b.position.y) return a.position.y - b.position.y;
    if (a.position.x !== b.position.x) return a.position.x - b.position.x;
    return a.id.localeCompare(b.id);
  });
}

/**
 * Swap a widget with its neighbour in display order (up = earlier, down = later).
 * Reassigns y so the new order is stable.
 */
export function moveWidget(
  widgets: DashboardWidget[],
  widgetId: string,
  direction: "up" | "down",
): DashboardWidget[] {
  const ordered = sortWidgets(widgets);
  const index = ordered.findIndex((w) => w.id === widgetId);
  if (index < 0) return ordered;

  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= ordered.length) return ordered;

  const next = [...ordered];
  const a = next[index];
  const b = next[target];
  if (!a || !b) return ordered;
  next[index] = b;
  next[target] = a;

  return next.map((w, i) => ({
    ...w,
    position: { ...w.position, y: i },
  }));
}

export function removeWidget(
  widgets: DashboardWidget[],
  widgetId: string,
): DashboardWidget[] {
  return sortWidgets(widgets.filter((w) => w.id !== widgetId)).map((w, i) => ({
    ...w,
    position: { ...w.position, y: i },
  }));
}

export function appendWidget(
  widgets: DashboardWidget[],
  widget: DashboardWidget,
): DashboardWidget[] {
  if (widgets.length >= MAX_WIDGETS) return sortWidgets(widgets);
  const ordered = sortWidgets(widgets);
  const maxY = ordered.reduce((m, w) => Math.max(m, w.position.y), -1);
  const normalized = normalizeWidget(
    {
      ...widget,
      id: widget.id || `widget_${Date.now()}`,
      position: {
        x: clampInt(widget.position.x, 0, GRID_COLUMNS - MIN_WIDGET_W, 0),
        y: maxY + 1,
      },
    },
    ordered.length,
  );
  if (!normalized) return ordered;
  return sortWidgets([...ordered, normalized]);
}

/** Size presets for the 12-column editorial grid. */
export function sizePreset(preset: "small" | "medium" | "large"): {
  w: number;
  h: number;
} {
  if (preset === "small") return { w: 3, h: 3 };
  if (preset === "large") return { w: 12, h: 6 };
  return { w: 6, h: 4 };
}
