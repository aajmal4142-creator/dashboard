import Link from "next/link";
import { redirect } from "next/navigation";
import { getPayload } from "payload";

import {
  EmptyState,
  PageCard,
  PageFrame,
  StatusLine,
} from "@/components/shell/PageFrame";
import { Metric } from "@/components/ui/metric";
import { getCurrentContext } from "@/lib/auth";
import {
  createUsageTracker,
  getRealTimeOverageProjection,
  getUsageMeters,
} from "@/lib/billing";
import config from "@/payload.config";

export const metadata = {
  title: "Usage | ClearESG",
};

export default async function UsagePage() {
  const ctx = await getCurrentContext();
  if (!ctx.user || !ctx.activeOrg) redirect("/login");

  const payload = await getPayload({ config });
  const org = await payload.findByID({
    collection: "organisations",
    id: ctx.activeOrg.id,
    depth: 0,
    overrideAccess: true,
  });

  const meters = await getUsageMeters(ctx.activeOrg.id, org.plan);
  const tracker = createUsageTracker(payload);

  let monthUsage: {
    dataPointsCreated?: number;
    reportsPublished?: number;
    apiCallsCount?: number;
    storageUsedGB?: number;
  } | null = null;
  try {
    monthUsage = await tracker.getCurrentMonthUsage(ctx.activeOrg.id);
  } catch {
    monthUsage = null;
  }

  const projection = await getRealTimeOverageProjection(ctx.activeOrg.id);

  const datapoints = monthUsage?.dataPointsCreated ?? 0;
  const reports = monthUsage?.reportsPublished ?? 0;
  const apiCalls = monthUsage?.apiCallsCount ?? 0;
  const storageGb = monthUsage?.storageUsedGB ?? 0;

  return (
    <PageFrame
      eyebrow="Billing"
      title="Metered usage"
      help="Current-month datapoint, report, and API meters with projected overage add-on cost. Seat entitlements (periods / suppliers) remain on Plan & usage."
      actions={
        <Link
          href="/billing"
          className="inline-flex h-8 items-center rounded-[4px] border border-rule bg-surface-1 px-3 text-[12px] text-ink hover:border-rule-strong"
        >
          Back to billing
        </Link>
      }
    >
      <div className="space-y-6">
        <StatusLine tone="neutral">
          Pay-as-you-go estimate uses plan overage rates. Stripe metered invoice items
          settle on the billing portal when overages apply.
        </StatusLine>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <PageCard title="Datapoints">
            <p className="font-[family-name:var(--font-display)] text-3xl text-ink">
              <Metric value={datapoints} size="lg" animate={false} />
            </p>
            <p className="mt-1 text-[12px] text-ink-muted">This month</p>
          </PageCard>
          <PageCard title="Reports">
            <p className="font-[family-name:var(--font-display)] text-3xl text-ink">
              <Metric value={reports} size="lg" animate={false} />
            </p>
            <p className="mt-1 text-[12px] text-ink-muted">Published this month</p>
          </PageCard>
          <PageCard title="API calls">
            <p className="font-[family-name:var(--font-display)] text-3xl text-ink">
              <Metric value={apiCalls} size="lg" animate={false} />
            </p>
            <p className="mt-1 text-[12px] text-ink-muted">This month</p>
          </PageCard>
          <PageCard title="Storage">
            <p className="font-[family-name:var(--font-display)] text-3xl text-ink">
              <Metric value={storageGb} unit=" GB" size="lg" animate={false} />
            </p>
            <p className="mt-1 text-[12px] text-ink-muted">Evidence & uploads</p>
          </PageCard>
        </div>

        <PageCard title="Projected overage add-on (month-end)">
          {projection.projectedTotal > 0 ? (
            <ul className="space-y-2 text-[13px] text-ink-muted">
              <li>
                Datapoints{" "}
                <span className="font-mono tabular-nums text-ink">
                  ${projection.projectedDatapointCost.toFixed(2)}
                </span>
              </li>
              <li>
                Reports{" "}
                <span className="font-mono tabular-nums text-ink">
                  ${projection.projectedReportCost.toFixed(2)}
                </span>
              </li>
              <li>
                API{" "}
                <span className="font-mono tabular-nums text-ink">
                  ${projection.projectedApiCost.toFixed(2)}
                </span>
              </li>
              <li className="border-t border-rule pt-2 font-semibold text-ink">
                Total{" "}
                <span className="font-mono tabular-nums">
                  ${projection.projectedTotal.toFixed(2)}
                </span>
              </li>
            </ul>
          ) : (
            <EmptyState
              title="No projected overage"
              body="Usage is within included quotas for this plan, or no subscription meters are recorded yet."
            />
          )}
        </PageCard>

        <PageCard title="Entitlement seats">
          <ul className="space-y-2 text-[13px] text-ink-muted">
            <li>
              Periods{" "}
              <span className="font-mono tabular-nums text-ink">
                {meters.periods.used}
                {meters.periods.max == null ? " / ∞" : ` / ${meters.periods.max}`}
              </span>
            </li>
            <li>
              Suppliers{" "}
              <span className="font-mono tabular-nums text-ink">
                {meters.suppliers.used}
                {meters.suppliers.max == null ? " / ∞" : ` / ${meters.suppliers.max}`}
              </span>
            </li>
            <li>
              Clients{" "}
              <span className="font-mono tabular-nums text-ink">
                {meters.clients.used}
                {meters.clients.max == null ? " / ∞" : ` / ${meters.clients.max}`}
              </span>
            </li>
          </ul>
        </PageCard>
      </div>
    </PageFrame>
  );
}
