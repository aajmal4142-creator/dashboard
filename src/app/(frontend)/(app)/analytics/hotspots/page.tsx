import { PageFrame } from "@/components/shell/PageFrame";

import { HotspotsClient } from "./HotspotsClient";

export default function AnalyticsHotspotsPage() {
  return (
    <PageFrame
      eyebrow="Analytics"
      title="Emissions hotspots"
      help="Drill into which facilities, suppliers, categories, or metric keys drive share of period total or change versus a baseline. Aggregations over existing datapoints only — missing values are excluded, never filled with zeros."
    >
      <HotspotsClient />
    </PageFrame>
  );
}
