import { InkReveal } from "@/components/motion";
import { METRICS_HREF } from "@/lib/metrics";
import { cn } from "@/lib/utils";

import { GoLink } from "./GoLink";
import type { RunwayAnomaly } from "./types";

type RunwayAnomaliesProps = {
  anomalies: RunwayAnomaly[];
};

export function RunwayAnomalies({ anomalies }: RunwayAnomaliesProps) {
  if (anomalies.length === 0) return null;

  return (
    <InkReveal delay={0.2} className="mt-6">
      <p className="label-caps text-amber">Review unusual metrics</p>
      <div className="mt-4 overflow-hidden rounded-[6px] border border-rule bg-surface-1">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-rule-strong bg-surface-1">
                <th className="label-caps px-3 py-2.5 text-left">Metric</th>
                <th className="label-caps px-3 py-2.5 text-left">Reason</th>
                <th className="label-caps px-3 py-2.5 text-right"> </th>
              </tr>
            </thead>
            <tbody>
              {anomalies.slice(0, 4).map((anomaly) => (
                <tr
                  key={anomaly.metricKey + anomaly.reason}
                  className={cn(
                    "border-b border-rule bg-surface-1 last:border-b-0",
                    "hover:bg-accent-quiet",
                  )}
                >
                  <td className="px-3 py-3 align-top font-data text-sm text-amber">
                    {anomaly.metricKey}
                  </td>
                  <td className="max-w-[28rem] px-3 py-3 align-top text-xs text-ink-muted">
                    {anomaly.reason}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right align-top">
                    <GoLink href={`${METRICS_HREF}#${anomaly.metricKey}`}>Review</GoLink>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </InkReveal>
  );
}
