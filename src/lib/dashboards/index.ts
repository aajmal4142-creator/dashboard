export { defaultLayoutNameForRole, defaultWidgetsForRole } from "./defaults";
export {
  appendWidget,
  isTimeRange,
  isWidgetType,
  moveWidget,
  normalizeWidget,
  normalizeWidgets,
  removeWidget,
  sizePreset,
  sortWidgets,
} from "./normalize";
export {
  buildDefaultLayoutWhere,
  buildUserOrgLayoutWhere,
  mapLayoutDoc,
  newWidgetDraft,
  ownershipMatches,
  parseCreateBody,
  parseUpdateBody,
} from "./query";
export type {
  CreateDashboardInput,
  DashboardLayoutDoc,
  DashboardLayoutSummary,
  DashboardWidget,
  TimeRange,
  UpdateDashboardInput,
  WidgetConfig,
  WidgetType,
} from "./types";
export { GRID_COLUMNS, MAX_WIDGETS, TIME_RANGES, WIDGET_TYPES } from "./types";
/** Client-safe widget payload types only — do not re-export resolveWidgetData (Payload/server). */
export type {
  WidgetChartPayload,
  WidgetDataPayload,
  WidgetMetricPayload,
  WidgetTableOrListPayload,
  WidgetTableRow,
} from "./widgetDataTypes";
