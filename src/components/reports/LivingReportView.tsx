"use client";

import { Assemble, InkReveal, PageMasthead, RuleDraw } from "@/components/motion";
import { Metric } from "@/components/ui/metric";
import type { ReportSnapshot } from "@/lib/reports";
import { BUYER_FAQ } from "@/lib/reports/buyerFaq";

export function LivingReportView({ snapshot }: { snapshot: ReportSnapshot }) {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 text-ink">
      <PageMasthead
        label="ClearESG living report"
        title={snapshot.organisationName}
        description={`${snapshot.periodLabel} · ${snapshot.framework} · v${snapshot.version}`}
      />

      <Assemble layer="data" className="mt-8">
        <Metric
          value={snapshot.scores.overall}
          size="display"
          decimals={0}
          inView={false}
        />
        <p className="label-caps mt-1">Overall · {snapshot.band}</p>
      </Assemble>

      <InkReveal className="mt-10" delay={0.08}>
        <RuleDraw delay={0} duration={0.4} className="mb-4" />
        <div className="grid grid-cols-3 gap-3">
          {(
            [
              ["E", snapshot.scores.e],
              ["S", snapshot.scores.s],
              ["G", snapshot.scores.g],
            ] as const
          ).map(([k, v]) => (
            <div key={k} className="surface-1 rounded-[4px] p-3">
              <p className="label-caps">{k}</p>
              <Metric value={v} size="xl" decimals={0} className="mt-2" />
            </div>
          ))}
        </div>
      </InkReveal>

      <InkReveal className="surface-1 mt-10 rounded-[4px] p-4" delay={0.12}>
        <p className="label-caps mb-3">Emissions tCO2e</p>
        <div className="flex flex-wrap gap-4 text-ink-muted">
          <Metric value={snapshot.emissions.scope1} unit="S1" size="sm" decimals={2} />
          <Metric value={snapshot.emissions.scope2} unit="S2" size="sm" decimals={2} />
          <Metric value={snapshot.emissions.scope3} unit="S3" size="sm" decimals={2} />
          <Metric value={snapshot.emissions.total} unit="total" size="sm" decimals={2} />
        </div>
        {typeof snapshot.emissions.scope3PrimarySharePct === "number" &&
        (snapshot.emissions.scope3PrimaryTco2e ?? 0) +
          (snapshot.emissions.scope3EstimateTco2e ?? 0) >
          0 ? (
          <p className="mt-3 text-xs text-ink-muted">
            <span className="font-data text-signal">
              {snapshot.emissions.scope3PrimarySharePct}%
            </span>{" "}
            supplier-verified
            {" · "}
            <span className="font-data text-amber">
              {(100 - (snapshot.emissions.scope3PrimarySharePct ?? 0)).toFixed(1)}%
            </span>{" "}
            spend estimate
          </p>
        ) : null}
        <div className="mt-2">
          <Metric
            value={snapshot.emissions.dataQualityPct}
            unit="% quality"
            size="sm"
            decimals={0}
            tone="ash"
          />
        </div>
      </InkReveal>

      <InkReveal className="mt-10 border border-rule p-4" delay={0.16}>
        <p className="label-caps mb-2">Materiality</p>
        <p className="text-sm text-ink-muted">
          {snapshot.materiality.narrative ?? "No materiality narrative on this version."}
        </p>
        {snapshot.materiality.points.filter((p) => p.material).length > 0 ? (
          <ul className="mt-3 flex flex-wrap gap-2">
            {snapshot.materiality.points
              .filter((p) => p.material)
              .map((p) => (
                <li
                  key={p.esrsTopic}
                  className="rounded-[2px] border border-rule px-2 py-0.5 font-data text-xs text-ink"
                >
                  {p.esrsTopic}
                </li>
              ))}
          </ul>
        ) : (
          <p className="mt-3 text-xs text-ink-muted">
            No finalised material topics on this snapshot.
          </p>
        )}
      </InkReveal>

      <InkReveal className="mt-10" delay={0.18}>
        <RuleDraw delay={0} duration={0.35} className="mb-4" />
        <p className="label-caps mb-3">Auditor trail</p>
        <p className="mb-4 text-xs text-ink-muted">
          Evidence hashes and factors used for this published snapshot. Open a figure
          below for sha256.
        </p>
        <ul className="space-y-2">
          {snapshot.evidenceIndex.map((e) => (
            <li key={e.sha256} className="border-b border-rule py-2 text-sm">
              <details>
                <summary className="cursor-pointer text-ink">
                  {e.filename}
                  {e.metricKey ? (
                    <span className="font-data text-ink-muted"> · {e.metricKey}</span>
                  ) : null}
                </summary>
                <p className="mt-2 font-data text-xs break-all text-ink-muted">
                  sha256 {e.sha256}
                </p>
              </details>
            </li>
          ))}
          {snapshot.evidenceIndex.length === 0 ? (
            <li className="text-sm text-ink-muted">
              No evidence attached on this version.
            </li>
          ) : null}
        </ul>
        <ul className="mt-6 space-y-2">
          {snapshot.factorsUsed.map((f) => (
            <li
              key={`${f.key}-${f.source}-${f.year}`}
              className="font-data text-xs text-ink-muted"
            >
              {f.key}: {f.source} {f.year}
            </li>
          ))}
        </ul>
      </InkReveal>

      <InkReveal className="mt-10 border border-rule p-4" delay={0.2}>
        <p className="label-caps mb-3">For banks &amp; buyers</p>
        <ul className="space-y-3 text-sm">
          {BUYER_FAQ.map((item) => (
            <li key={item.q}>
              <p className="font-medium text-ink">{item.q}</p>
              <p className="mt-1 text-ink-muted">{item.a}</p>
            </li>
          ))}
        </ul>
      </InkReveal>

      <div className="mt-10 flex flex-wrap gap-x-4 gap-y-1 border-t border-rule pt-4 text-xs text-ink-muted">
        <span>
          Last updated{" "}
          <span className="font-data text-ink">
            {new Date(snapshot.publishedAt).toISOString().slice(0, 16).replace("T", " ")}{" "}
            UTC
          </span>
        </span>
        <span>
          Evidence linked{" "}
          <span className="font-data text-ink">{snapshot.evidenceIndex.length}</span>
        </span>
        <span>
          Calculation <span className="font-data text-ink">v{snapshot.version}</span>
        </span>
      </div>

      <p className="mt-6 text-xs text-ink-muted">{snapshot.disclaimer}</p>
    </main>
  );
}
