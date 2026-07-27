import Link from "next/link";

import { METRICS_HREF, METRICS_LABEL } from "@/lib/metrics";
import { cn } from "@/lib/utils";

import { GoLink } from "./GoLink";
import { StatusBadge, statusFromApproval } from "./StatusBadge";
import type { RunwayAction } from "./types";

type RunwayActionsProps = {
  actions: RunwayAction[];
  approvalByMetric: Record<string, string>;
};

export function RunwayActions({ actions, approvalByMetric }: RunwayActionsProps) {
  const rows = actions.slice(0, 5);

  return (
    <section className="mt-6">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-ink">
          Next actions
        </h2>
        <Link
          href={METRICS_HREF}
          className="text-[12px] font-medium text-accent hover:underline"
        >
          All {METRICS_LABEL.toLowerCase()}
        </Link>
      </div>

      <div className="overflow-hidden rounded-[6px] border border-rule bg-surface-1">
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-rule bg-surface-1">
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                  Need
                </th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                  Status
                </th>
                <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((action) => {
                const status = statusFromApproval(
                  action.metricKey ? approvalByMetric[action.metricKey] : undefined,
                );
                return (
                  <tr
                    key={action.href + action.label}
                    className={cn(
                      "border-b border-rule bg-surface-1 last:border-b-0",
                      "hover:bg-accent-quiet",
                    )}
                  >
                    <td className="max-w-[22rem] px-4 py-3 align-middle text-ink-muted">
                      {action.need}
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <StatusBadge label={status.label} tone={status.tone} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right align-middle">
                      <GoLink href={action.href}>{action.label}</GoLink>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
