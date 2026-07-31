import { Assemble } from "@/components/motion";

import { RunwayRealtimeClient } from "./RunwayRealtimeClient";
import type { RunwayViewProps } from "./types";

/**
 * Runway home — server shell; live KPI updates via SSE (see RunwayRealtimeClient).
 * Transport: authenticated SSE at `/api/ws/dashboard` with REST polling fallback.
 */
export function RunwayView(props: RunwayViewProps) {
  return (
    <Assemble layer="structure" className="min-h-full bg-canvas">
      <Assemble layer="data">
        <RunwayRealtimeClient {...props} />
      </Assemble>
    </Assemble>
  );
}
