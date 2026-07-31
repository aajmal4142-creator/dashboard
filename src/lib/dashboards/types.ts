export const WIDGET_TYPES = ["chart", "metric", "table", "list"] as const;
export type WidgetType = (typeof WIDGET_TYPES)[number];

export const TIME_RANGES = ["1m", "3m", "6m", "1y"] as const;
export type TimeRange = (typeof TIME_RANGES)[number];

export const GRID_COLUMNS = 12;
export const MAX_WIDGETS = 24;
export const MIN_WIDGET_W = 3;
export const MAX_WIDGET_W = 12;
export const MIN_WIDGET_H = 2;
export const MAX_WIDGET_H = 8;

export type WidgetPosition = {
  x: number;
  y: number;
};

export type WidgetSize = {
  w: number;
  h: number;
};

export type WidgetConfig = {
  metric: string;
  timeRange: TimeRange;
  filters: Record<string, string | number | boolean | null>;
};

export type DashboardWidget = {
  id: string;
  type: WidgetType;
  title: string;
  position: WidgetPosition;
  size: WidgetSize;
  config: WidgetConfig;
};

export type DashboardLayoutSummary = {
  id: string;
  name: string;
  isDefault: boolean;
  widgets: DashboardWidget[];
  createdAt: string;
  updatedAt: string;
};

export type DashboardLayoutDoc = {
  id: string;
  userId?: string | { id?: string } | null;
  organisationId?: string | { id?: string } | null;
  name?: string | null;
  isDefault?: boolean | null;
  widgets?: unknown;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type CreateDashboardInput = {
  name: string;
  widgets: DashboardWidget[];
  isDefault?: boolean;
};

export type UpdateDashboardInput = {
  name?: string;
  widgets?: DashboardWidget[];
  isDefault?: boolean;
};
