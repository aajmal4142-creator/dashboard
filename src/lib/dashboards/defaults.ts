import type { MembershipRole } from "@/lib/access/membership";

import { sizePreset } from "./normalize";
import type { DashboardWidget, TimeRange, WidgetType } from "./types";

function widget(
  id: string,
  type: WidgetType,
  title: string,
  metric: string,
  timeRange: TimeRange,
  preset: "small" | "medium" | "large",
  x: number,
  y: number,
): DashboardWidget {
  return {
    id,
    type,
    title,
    position: { x, y },
    size: sizePreset(preset),
    config: { metric, timeRange, filters: {} },
  };
}

/**
 * Role-scoped starter layouts. Viewers get a read overview;
 * contributors get work queues; admins/owners get the full board.
 */
export function defaultWidgetsForRole(role: MembershipRole): DashboardWidget[] {
  if (role === "viewer") {
    return [
      widget("v_scope1", "metric", "Scope 1 total", "scope1_total", "3m", "small", 0, 0),
      widget("v_scope2", "metric", "Scope 2 total", "scope2_total", "3m", "small", 3, 0),
      widget(
        "v_trend",
        "chart",
        "Emissions trend",
        "emissions_trend",
        "1y",
        "large",
        0,
        1,
      ),
    ];
  }

  if (role === "contributor") {
    return [
      widget(
        "c_pending",
        "list",
        "Pending approvals",
        "pending_approvals",
        "1m",
        "medium",
        0,
        0,
      ),
      widget(
        "c_datapoints",
        "table",
        "Recent datapoints",
        "recent_datapoints",
        "1m",
        "medium",
        6,
        0,
      ),
      widget("c_scope1", "metric", "Scope 1 total", "scope1_total", "3m", "small", 0, 1),
      widget("c_scope3", "metric", "Scope 3 total", "scope3_total", "3m", "small", 3, 1),
    ];
  }

  // owner | admin
  return [
    widget("a_scope1", "metric", "Scope 1 total", "scope1_total", "3m", "small", 0, 0),
    widget("a_scope2", "metric", "Scope 2 total", "scope2_total", "3m", "small", 3, 0),
    widget("a_intensity", "metric", "Intensity", "scope2_intensity", "3m", "small", 6, 0),
    widget(
      "a_chart",
      "chart",
      "Emissions by scope",
      "emissions_by_scope",
      "6m",
      "medium",
      0,
      1,
    ),
    widget(
      "a_suppliers",
      "table",
      "Top suppliers",
      "top_suppliers",
      "3m",
      "medium",
      6,
      1,
    ),
    widget("a_alerts", "list", "Alerts today", "alerts_today", "1m", "medium", 0, 2),
  ];
}

export function defaultLayoutNameForRole(role: MembershipRole): string {
  if (role === "viewer") return "Overview";
  if (role === "contributor") return "Operations view";
  return "Executive view";
}
