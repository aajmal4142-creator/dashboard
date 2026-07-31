"use client";

import { Fragment, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Metric } from "@/components/ui/metric";
import {
  applyLegendVisibility,
  buildDetailTableRows,
  buildEmissionsChartRows,
  buildExecutiveHighlights,
  buildHtmlReportMeta,
  filterDetailRows,
  filterEmissionsByScope,
  nextSortDirection,
  sortDetailRows,
  type ScopeFilter,
  type SortDirection,
} from "@/lib/reports/htmlReport";
import { formatTco2e } from "@/lib/reports/pdfFormat";
import type { ReportSnapshot } from "@/lib/reports";

const SCOPE_COLORS: Record<"scope1" | "scope2" | "scope3", string> = {
  scope1: "var(--rust)",
  scope2: "var(--amber)",
  scope3: "var(--cobalt)",
};

const PRINT_STYLES = `
@media print {
  .html-report-root {
    background: transparent !important;
    color: #000 !important;
    max-width: none !important;
    padding: 0 !important;
  }
  .html-report-root .no-print { display: none !important; }
  .html-report-root details {
    display: block !important;
  }
  .html-report-root details > *:not(summary) {
    display: block !important;
    height: auto !important;
    overflow: visible !important;
  }
  .html-report-root details > summary {
    list-style: none;
  }
  .html-report-root .surface-print-reset {
    background: transparent !important;
    box-shadow: none !important;
    border-color: #ccc !important;
  }
  .html-report-root .html-report-chart {
    break-inside: avoid;
  }
}
.html-report-root table.html-report-table {
  width: 100%;
  border-collapse: collapse;
}
.html-report-root table.html-report-table th,
.html-report-root table.html-report-table td {
  text-align: left;
  padding: 0.5rem 0.5rem;
  border-bottom: 1px solid var(--rule);
  vertical-align: top;
}
.html-report-root table.html-report-table th button {
  font: inherit;
  background: none;
  border: 0;
  padding: 0;
  cursor: pointer;
  color: var(--ink-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 10px;
  font-weight: 600;
}
@media (max-width: 640px) {
  .html-report-root .html-report-metrics {
    grid-template-columns: 1fr !important;
  }
  .html-report-root .html-report-table-wrap {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }
}
`;

export function InteractiveHtmlReport({
  snapshot,
  embedded = false,
  generatedAtIso,
}: {
  snapshot: ReportSnapshot;
  embedded?: boolean;
  generatedAtIso?: string;
}) {
  const meta = useMemo(
    () =>
      buildHtmlReportMeta(
        snapshot,
        generatedAtIso ? new Date(generatedAtIso) : new Date(),
      ),
    [snapshot, generatedAtIso],
  );
  const highlights = useMemo(() => buildExecutiveHighlights(snapshot), [snapshot]);
  const allChartRows = useMemo(
    () => buildEmissionsChartRows(snapshot.emissions),
    [snapshot],
  );
  const allDetailRows = useMemo(() => buildDetailTableRows(snapshot), [snapshot]);

  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>("all");
  const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(() => new Set());
  const [sortColumn, setSortColumn] = useState<"label" | "value" | "scope" | "quality">(
    "label",
  );
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  const chartData = useMemo(() => {
    const filtered = filterEmissionsByScope(allChartRows, scopeFilter);
    return applyLegendVisibility(filtered, hiddenSeries);
  }, [allChartRows, scopeFilter, hiddenSeries]);

  const tableRows = useMemo(() => {
    const filtered = filterDetailRows(allDetailRows, scopeFilter);
    return sortDetailRows(filtered, sortColumn, sortDirection);
  }, [allDetailRows, scopeFilter, sortColumn, sortDirection]);

  function toggleSeries(key: string) {
    setHiddenSeries((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function onSort(column: "label" | "value" | "scope" | "quality") {
    const next = nextSortDirection(sortColumn, sortDirection, column);
    setSortColumn(next.column as "label" | "value" | "scope" | "quality");
    setSortDirection(next.direction);
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <article
      className={`html-report-root mx-auto max-w-4xl px-4 py-8 text-ink sm:px-6 ${
        embedded ? "py-4" : "py-10"
      }`}
    >
      <style dangerouslySetInnerHTML={{ __html: PRINT_STYLES }} />

      <header className="border-b border-rule-strong pb-4">
        {!embedded ? (
          <p className="label-caps text-accent">ClearESG interactive report</p>
        ) : (
          <p className="label-caps text-ink-muted">Sustainability report</p>
        )}
        <h1
          className={`font-display leading-tight ${
            embedded ? "mt-1 text-2xl sm:text-3xl" : "mt-2 text-3xl sm:text-4xl"
          }`}
        >
          {meta.organisationName}
        </h1>
        <p className="mt-2 font-data text-sm text-ink-muted">
          {embedded
            ? `${meta.periodLabel} · ${meta.generatedAtLabel}`
            : `${meta.periodLabel} · ${meta.frameworkLabel} · v${meta.version}`}
        </p>
        {!embedded ? (
          <p className="mt-1 font-data text-xs text-ink-muted">
            Generated {meta.generatedAtLabel}
          </p>
        ) : null}
      </header>

      <section className="mt-8">
        <details className="html-report-expand-force surface-print-reset group" open>
          <summary className="cursor-pointer list-none">
            <span className="label-caps text-accent">01 — Executive summary</span>
            <h2 className="font-display mt-1 text-2xl">Key metrics</h2>
          </summary>
          <div className="html-report-metrics mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="surface-1 surface-print-reset rounded-[6px] border border-rule p-3">
              <p className="label-caps">Total tCO₂e</p>
              <Metric
                value={snapshot.emissions.total}
                size="xl"
                decimals={2}
                className="mt-2"
                inView={false}
              />
            </div>
            <div className="surface-1 surface-print-reset rounded-[6px] border border-rule p-3">
              <p className="label-caps">Overall</p>
              <Metric
                value={snapshot.scores.overall}
                size="xl"
                decimals={0}
                className="mt-2"
                inView={false}
              />
              <p className="mt-1 text-xs text-ink-muted">{meta.bandLabel}</p>
            </div>
            <div className="surface-1 surface-print-reset rounded-[6px] border border-rule p-3">
              <p className="label-caps">Data quality</p>
              <Metric
                value={snapshot.emissions.dataQualityPct}
                size="xl"
                decimals={0}
                unit="%"
                className="mt-2"
                inView={false}
              />
            </div>
            <div className="surface-1 surface-print-reset rounded-[6px] border border-rule p-3">
              <p className="label-caps">E / S / G</p>
              <p className="mt-2 font-data text-lg text-ink">
                {Math.round(snapshot.scores.e)} / {Math.round(snapshot.scores.s)} /{" "}
                {Math.round(snapshot.scores.g)}
              </p>
            </div>
          </div>
          <ul className="mt-4 space-y-2 text-sm text-ink-muted">
            {highlights.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </details>
      </section>

      <section className="mt-10 html-report-chart">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="label-caps text-accent">02 — Emissions</p>
            <h2 className="font-display mt-1 text-2xl">Scope breakdown</h2>
          </div>
          <label className="no-print flex items-center gap-2 text-xs text-ink-muted">
            <span>Show</span>
            <select
              className="rounded-[4px] border border-rule bg-surface-1 px-2 py-1 text-ink"
              value={scopeFilter}
              onChange={(e) => setScopeFilter(e.target.value as ScopeFilter)}
            >
              <option value="all">All scopes</option>
              <option value="scope1">Scope 1 only</option>
              <option value="scope2">Scope 2 only</option>
              <option value="scope3">Scope 3 only</option>
            </select>
          </label>
        </div>
        <div className="surface-1 surface-print-reset mt-4 h-72 rounded-[6px] border border-rule p-2 sm:p-4">
          {chartData.length === 0 ? (
            <p className="p-4 text-sm text-ink-muted">
              No series visible. Click a legend item to restore, or change the scope
              filter.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={[
                  Object.fromEntries([
                    ["name", "Emissions"],
                    ...chartData.map((r) => [r.key, r.value]),
                  ]) as Record<string, string | number>,
                ]}
                margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  stroke="var(--rule)"
                  strokeDasharray="3 3"
                  vertical={false}
                />
                <XAxis
                  dataKey="name"
                  tick={{ fill: "var(--ink-muted)", fontSize: 12 }}
                  axisLine={{ stroke: "var(--rule-strong)" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{
                    fill: "var(--ink-muted)",
                    fontSize: 11,
                    fontFamily: "var(--font-jetbrains-mono)",
                  }}
                  axisLine={false}
                  tickLine={false}
                  width={56}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--surface-1)",
                    border: "1px solid var(--rule)",
                    borderRadius: 4,
                    color: "var(--ink)",
                    fontSize: 12,
                  }}
                  formatter={(value: number, name: string) => [
                    `${formatTco2e(value)} tCO₂e`,
                    name === "scope1"
                      ? "Scope 1"
                      : name === "scope2"
                        ? "Scope 2"
                        : name === "scope3"
                          ? "Scope 3"
                          : name,
                  ]}
                />
                <Legend
                  wrapperStyle={{ fontSize: 12, cursor: "pointer" }}
                  formatter={(value: string) =>
                    value === "scope1"
                      ? "Scope 1"
                      : value === "scope2"
                        ? "Scope 2"
                        : value === "scope3"
                          ? "Scope 3"
                          : value
                  }
                  onClick={(entry) => {
                    const key = String(entry.dataKey ?? "");
                    if (key === "scope1" || key === "scope2" || key === "scope3") {
                      toggleSeries(key);
                    }
                  }}
                />
                {(["scope1", "scope2", "scope3"] as const).map((key) =>
                  chartData.some((r) => r.key === key) ? (
                    <Bar
                      key={key}
                      dataKey={key}
                      name={key}
                      fill={SCOPE_COLORS[key]}
                      radius={[2, 2, 0, 0]}
                    />
                  ) : null,
                )}
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
        <ul className="no-print mt-3 flex flex-wrap gap-3 text-xs">
          {allChartRows.map((row) => {
            const on = !hiddenSeries.has(row.key);
            return (
              <li key={row.key}>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-[2px] border border-rule px-2 py-1 text-ink"
                  style={{ opacity: on ? 1 : 0.45 }}
                  onClick={() => toggleSeries(row.key)}
                  aria-pressed={on}
                >
                  <span
                    className="inline-block h-2 w-2 rounded-[1px]"
                    style={{ background: SCOPE_COLORS[row.key] }}
                    aria-hidden
                  />
                  {row.label}
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-10">
        <details className="html-report-expand-force" open>
          <summary className="cursor-pointer list-none">
            <p className="label-caps text-accent">03 — Detailed tables</p>
            <h2 className="font-display mt-1 text-2xl">Sortable breakdown</h2>
          </summary>
          <div className="html-report-table-wrap mt-4">
            <table className="html-report-table min-w-[520px] text-sm">
              <thead>
                <tr>
                  <th>
                    <button type="button" onClick={() => onSort("label")}>
                      Line
                      {sortColumn === "label"
                        ? sortDirection === "asc"
                          ? " ↑"
                          : " ↓"
                        : ""}
                    </button>
                  </th>
                  <th>
                    <button type="button" onClick={() => onSort("scope")}>
                      Scope
                      {sortColumn === "scope"
                        ? sortDirection === "asc"
                          ? " ↑"
                          : " ↓"
                        : ""}
                    </button>
                  </th>
                  <th>
                    <button type="button" onClick={() => onSort("value")}>
                      Value
                      {sortColumn === "value"
                        ? sortDirection === "asc"
                          ? " ↑"
                          : " ↓"
                        : ""}
                    </button>
                  </th>
                  <th>
                    <button type="button" onClick={() => onSort("quality")}>
                      Quality
                      {sortColumn === "quality"
                        ? sortDirection === "asc"
                          ? " ↑"
                          : " ↓"
                        : ""}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map((row) => {
                  const isOpen = expanded.has(row.id);
                  const hasChildren = row.children.length > 0;
                  return (
                    <Fragment key={row.id}>
                      <tr>
                        <td>
                          {hasChildren ? (
                            <button
                              type="button"
                              className="text-left text-ink underline-offset-2 hover:underline"
                              onClick={() => toggleExpand(row.id)}
                              aria-expanded={isOpen}
                            >
                              {isOpen ? "▾ " : "▸ "}
                              {row.label}
                            </button>
                          ) : (
                            row.label
                          )}
                          {row.detail && isOpen ? (
                            <p className="mt-1 text-xs text-ink-muted">{row.detail}</p>
                          ) : null}
                        </td>
                        <td className="font-data text-ink-muted">{row.scope}</td>
                        <td className="font-data">{formatTco2e(row.value)}</td>
                        <td className="font-data text-ink-muted">{row.quality ?? "—"}</td>
                      </tr>
                      {hasChildren && isOpen
                        ? row.children.map((child) => (
                            <tr key={child.id} className="bg-surface-2/40">
                              <td className="pl-6 text-ink-muted">{child.label}</td>
                              <td className="font-data text-ink-muted">{child.scope}</td>
                              <td className="font-data text-ink-muted">—</td>
                              <td className="font-data text-ink-muted">—</td>
                            </tr>
                          ))
                        : null}
                    </Fragment>
                  );
                })}
                {tableRows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-4 text-ink-muted">
                      No rows for this scope filter.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </details>
      </section>

      <section className="mt-10">
        <details className="html-report-expand-force" open>
          <summary className="cursor-pointer list-none">
            <p className="label-caps text-accent">04 — Methodology</p>
            <h2 className="font-display mt-1 text-2xl">Assumptions and sources</h2>
          </summary>
          <div className="mt-4 space-y-3 text-sm text-ink-muted">
            {snapshot.emissionsStandard ? (
              <p>
                Emissions standard:{" "}
                <span className="font-data text-ink">{snapshot.emissionsStandard}</span>
              </p>
            ) : null}
            <p>
              Factors pinned on this snapshot:{" "}
              <span className="font-data text-ink">{snapshot.factorsUsed.length}</span>
            </p>
            <ul className="space-y-1 font-data text-xs">
              {snapshot.factorsUsed.slice(0, 12).map((f) => (
                <li key={`${f.factorId}-${f.key}`}>
                  {f.key}: {f.source} {f.year}
                </li>
              ))}
              {snapshot.factorsUsed.length > 12 ? (
                <li>+{snapshot.factorsUsed.length - 12} more</li>
              ) : null}
            </ul>
            {snapshot.materiality.narrative ? (
              <p className="text-ink">{snapshot.materiality.narrative}</p>
            ) : null}
          </div>
        </details>
      </section>

      <footer className="mt-12 border-t border-rule pt-4 text-xs text-ink-muted">
        <p>{meta.disclaimer}</p>
        <p className="mt-2">
          ClearESG · {meta.organisationName} · v{meta.version} · Generated{" "}
          <time dateTime={meta.generatedAtIso}>{meta.generatedAtLabel}</time>
        </p>
      </footer>
    </article>
  );
}
