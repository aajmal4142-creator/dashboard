import { InkReveal } from "@/components/motion";
import { Metric } from "@/components/ui/metric";
import { METRICS_HREF } from "@/lib/metrics";

import { GoLink } from "./GoLink";

type RunwayEmissionsProps = {
  totalEmissions: number;
  scope1: number;
  scope2: number;
  scope3: number;
  s1Pct: number;
  s2Pct: number;
  s3Pct: number;
  hasScope3Composition: boolean;
  primarySharePct: number;
};

export function RunwayEmissions({
  totalEmissions,
  scope1,
  scope2,
  scope3,
  s1Pct,
  s2Pct,
  s3Pct,
  hasScope3Composition,
  primarySharePct,
}: RunwayEmissionsProps) {
  return (
    <InkReveal delay={0.08}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label-caps">Emissions</p>
          <p className="mt-1 text-sm text-ink-muted">Scope split for this period</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          {totalEmissions > 0 ? (
            <Metric
              value={totalEmissions}
              unit="tCO₂e"
              size="lg"
              decimals={1}
              inView={false}
            />
          ) : null}
          <GoLink href={METRICS_HREF}>
            {totalEmissions > 0 ? "Review metrics" : "Enter metrics"}
          </GoLink>
        </div>
      </div>

      {totalEmissions > 0 ? (
        <>
          <div
            className="mt-5 flex h-8 w-full overflow-hidden bg-surface-2"
            aria-label="Emissions split by scope"
          >
            <div className="bg-rust/80" style={{ width: `${s1Pct}%` }} title="Scope 1" />
            <div className="bg-amber/80" style={{ width: `${s2Pct}%` }} title="Scope 2" />
            <div
              className="bg-cobalt/80"
              style={{ width: `${s3Pct}%` }}
              title="Scope 3"
            />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-4 text-xs">
            {[
              {
                label: "Scope 1",
                value: scope1,
                share: s1Pct,
                tone: "rust" as const,
                href: METRICS_HREF,
                cta: "Enter metrics",
              },
              {
                label: "Scope 2",
                value: scope2,
                share: s2Pct,
                tone: "amber" as const,
                href: METRICS_HREF,
                cta: "Enter metrics",
              },
              {
                label: "Scope 3",
                value: scope3,
                share: s3Pct,
                tone: "ink" as const,
                href: "/dashboard/suppliers",
                cta: "Manage suppliers",
              },
            ].map((scope) => (
              <div key={scope.label}>
                <p className="label-caps">{scope.label}</p>
                <Metric
                  value={scope.value}
                  unit="t"
                  size="md"
                  decimals={1}
                  tone={scope.tone}
                  className="mt-1"
                  inView={false}
                />
                <p className="mt-1 text-ink-muted">
                  <Metric
                    value={scope.share}
                    unit="%"
                    size="sm"
                    decimals={0}
                    tone="muted"
                    inView={false}
                  />
                </p>
                <GoLink href={scope.href} className="mt-2 text-xs">
                  {scope.cta}
                </GoLink>
              </div>
            ))}
          </div>
          {hasScope3Composition ? (
            <p className="mt-4 text-xs text-ink-muted">
              <Metric
                value={primarySharePct}
                unit="%"
                size="sm"
                decimals={1}
                tone="signal"
                className="mr-1"
                inView={false}
              />
              supplier-verified
              {" · "}
              <Metric
                value={100 - primarySharePct}
                unit="%"
                size="sm"
                decimals={1}
                tone="amber"
                className="mr-1"
                inView={false}
              />
              spend estimate
            </p>
          ) : null}
        </>
      ) : (
        <p className="mt-4 text-sm text-ink-muted">
          No emissions yet. Add electricity, fuel, or supplier spend.
        </p>
      )}
    </InkReveal>
  );
}
