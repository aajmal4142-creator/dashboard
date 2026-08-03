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

const REPORT_SECTIONS = [
  { id: "html-report-summary", label: "Summary" },
  { id: "html-report-emissions", label: "Emissions" },
  { id: "html-report-tables", label: "Tables" },
  { id: "html-report-methodology", label: "Method" },
] as const;

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
  min-height: 44px;
  min-width: 44px;
  display: inline-flex;
  align-items: center;
}
.html-report-root .html-report-section-nav {
  position: sticky;
  top: 0;
  z-index: 20;
  margin: 0 -1rem;
  padding: 0.5rem 1rem;
  background: color-mix(in srgb, var(--canvas) 92%, transparent);
  border-bottom: 1px solid var(--rule);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}
.html-report-root .html-report-section-nav-track {
  display: flex;
  gap: 0.5rem;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  padding-bottom: 2px;
}
.html-report-root .html-report-section-nav-track::-webkit-scrollbar {
  display: none;
}
.html-report-root .html-report-section-chip {
  flex: 0 0 auto;
  min-height: 44px;
  padding: 0 0.875rem;
  border-radius: 2px;
  border: 1px solid var(--rule);
  background: var(--surface-1);
  color: var(--ink-muted);
  font-size: 12px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  font-weight: 600;
  cursor: pointer;
}
.html-report-root .html-report-section-chip[aria-current="true"] {
  border-color: var(--rule-strong);
  color: var(--ink);
  background: var(--surface-2);
}
.html-report-root .html-report-touch-select {
  min-height: 44px;
  min-width: 9rem;
  padding: 0.5rem 0.75rem;
  font-size: 14px;
}
.html-report-root .html-report-series-chip {
  min-height: 44px;
  padding: 0 0.75rem;
}
@media (min-width: 641px) {
  .html-report-root .html-report-section-nav {
    display: none;
  }
}
@media (max-width: 640px) {
  .html-report-root {
    padding-left: 1rem !important;
    padding-right: 1rem !important;
  }
  .html-report-root .html-report-metrics {
    grid-template-columns: 1fr !important;
    gap: 0.75rem !important;
  }
  .html-report-root .html-report-chart-panel {
    height: 14rem !important;
  }
  .html-report-root .html-report-section {
    scroll-margin-top: 4.5rem;
  }
  .html-report-root .html-report-table-wrap {
    overflow: visible;
  }
  .html-report-root table.html-report-table {
    min-width: 0 !important;
  }
  .html-report-root table.html-report-table thead {
    display: none;
  }
  .html-report-root table.html-report-table tbody {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .html-report-root table.html-report-table tr {
    display: block;
    border: 1px solid var(--rule);
    border-radius: 6px;
    background: var(--surface-1);
    padding: 0.25rem 0;
  }
  .html-report-root table.html-report-table tr.html-report-child-row {
    background: var(--surface-2);
    margin-left: 0.75rem;
  }
  .html-report-root table.html-report-table td {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 0.75rem;
    border-bottom: 1px solid var(--rule);
    padding: 0.625rem 0.75rem;
    text-align: right;
  }
  .html-report-root table.html-report-table td:last-child {
    border-bottom: 0;
  }
  .html-report-root table.html-report-table td::before {
    content: attr(data-label);
    flex: 0 0 auto;
    color: var(--ink-muted);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-size: 10px;
    font-weight: 600;
    text-align: left;
    padding-top: 0.15rem;
  }
  .html-report-root table.html-report-table td.html-report-empty-cell {
    display: block;
    text-align: left;
  }
  .html-report-root table.html-report-table td.html-report-empty-cell::before {
    display: none;
  }
  .html-report-root table.html-report-table .html-report-row-toggle {
    min-height: 44px;
    display: inline-flex;
    align-items: center;
    text-align: right;
  }
  .html-report-root .html-report-mobile-sort {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-top: 0.75rem;
    margin-bottom: 0.25rem;
  }
  .html-report-root .html-report-mobile-sort button {
    min-height: 44px;
    padding: 0 0.75rem;
    border-radius: 2px;
    border: 1px solid var(--rule);
    background: var(--surface-1);
    color: var(--ink-muted);
    font-size: 11px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    font-weight: 600;
    cursor: pointer;
  }
  .html-report-root .html-report-mobile-sort button[aria-pressed="true"] {
    border-color: var(--rule-strong);
    color: var(--ink);
    background: var(--surface-2);
  }
}
@media (min-width: 641px) {
  .html-report-root .html-report-mobile-sort {
    display: none;
  }
}
`;

function scrollToSection(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
}

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
  const [activeSection, setActiveSection] = useState<string>(REPORT_SECTIONS[0].id);

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

  function goToSection(id: string) {
    setActiveSection(id);
    scrollToSection(id);
  }

  const sortMark = (column: "label" | "value" | "scope" | "quality") =>
    sortColumn === column ? (sortDirection === "asc" ? " ↑" : " ↓") : "";

  return (
    <article
      className={`html-report-root mx-auto max-w-4xl px-4 py-8 text-ink sm:px-6 ${
        embedded ? "py-4" : "py-10"
      }`}
    >
      <style dangerouslySetInnerHTML={{ __html: PRINT_STYLES }} />

      <nav className="html-report-section-nav no-print" aria-label="Report sections">
        <div className="html-report-section-nav-track" role="list">
          {REPORT_SECTIONS.map((section) => (
            <button
              key={section.id}
              type="button"
              role="listitem"
              className="html-report-section-chip"
              aria-current={activeSection === section.id ? "true" : undefined}
              onClick={() => goToSection(section.id)}
            >
              {section.label}
            </button>
          ))}
        </div>
      </nav>

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

      <section id="html-report-summary" className="html-report-section mt-8">
        <details className="html-report-expand-force surface-print-reset group" open>
          <summary className="cursor-pointer list-none py-1">
            <span className="label-caps text-accent">01 — Executive summary</span>
            <h2 className="font-display mt-1 text-xl sm:text-2xl">Key metrics</h2>
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
          {typeof snapshot.emissions.scope2MarketBased === "number" ? (
            <p className="mt-3 text-xs text-ink-muted">
              Scope 2 dual · loc{" "}
              <span className="font-data text-ink">
                {(
                  snapshot.emissions.scope2LocationBased ?? snapshot.emissions.scope2
                ).toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </span>
              {" · mkt "}
              <span
                className={
                  snapshot.emissions.scope2MarketQuality === "missing"
                    ? "font-data text-ink-muted"
                    : "font-data text-ink"
                }
              >
                {snapshot.emissions.scope2MarketBased.toLocaleString(undefined, {
                  maximumFractionDigits: 2,
                })}
              </span>
              {snapshot.emissions.scope2MarketQuality === "missing"
                ? " (incomplete)"
                : null}
              {" · "}
              district heat uses the location factor in both totals
            </p>
          ) : null}
          <ul className="mt-4 space-y-2 text-sm text-ink-muted">
            {highlights.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          {snapshot.customMetrics && snapshot.customMetrics.length > 0 ? (
            <div className="mt-6 border-t border-rule pt-4">
              <p className="label-caps text-ink-muted">Custom metrics</p>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {snapshot.customMetrics.map((m) => (
                  <li
                    key={m.key}
                    className="flex items-baseline justify-between gap-2 border-b border-rule pb-2 text-sm"
                  >
                    <span className="text-ink">{m.label}</span>
                    <span className="font-data tabular-nums text-ink">
                      {m.value == null ? "—" : `${m.value}${m.unit ? ` ${m.unit}` : ""}`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </details>
      </section>

      <section
        id="html-report-emissions"
        className="html-report-section mt-10 html-report-chart"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
          <div>
            <p className="label-caps text-accent">02 — Emissions</p>
            <h2 className="font-display mt-1 text-xl sm:text-2xl">Scope breakdown</h2>
          </div>
          <label className="no-print flex flex-col gap-1 text-xs text-ink-muted sm:flex-row sm:items-center sm:gap-2">
            <span>Show</span>
            <select
              className="html-report-touch-select rounded-[4px] border border-rule bg-surface-1 text-ink"
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
        <div className="html-report-chart-panel surface-1 surface-print-reset mt-4 h-72 rounded-[6px] border border-rule p-2 sm:p-4">
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
                  width={48}
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
        <ul className="no-print mt-3 flex flex-wrap gap-2 text-xs sm:gap-3">
          {allChartRows.map((row) => {
            const on = !hiddenSeries.has(row.key);
            return (
              <li key={row.key}>
                <button
                  type="button"
                  className="html-report-series-chip inline-flex items-center gap-1.5 rounded-[2px] border border-rule text-ink"
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

      <section id="html-report-tables" className="html-report-section mt-10">
        <details className="html-report-expand-force" open>
          <summary className="cursor-pointer list-none py-1">
            <p className="label-caps text-accent">03 — Detailed tables</p>
            <h2 className="font-display mt-1 text-xl sm:text-2xl">Sortable breakdown</h2>
          </summary>
          <div
            className="html-report-mobile-sort no-print"
            role="group"
            aria-label="Sort table"
          >
            {(
              [
                ["label", "Line"],
                ["scope", "Scope"],
                ["value", "Value"],
                ["quality", "Quality"],
              ] as const
            ).map(([column, label]) => (
              <button
                key={column}
                type="button"
                aria-pressed={sortColumn === column}
                onClick={() => onSort(column)}
              >
                {label}
                {sortMark(column)}
              </button>
            ))}
          </div>
          <div className="html-report-table-wrap mt-4">
            <table className="html-report-table min-w-[520px] text-sm">
              <thead>
                <tr>
                  <th>
                    <button type="button" onClick={() => onSort("label")}>
                      Line{sortMark("label")}
                    </button>
                  </th>
                  <th>
                    <button type="button" onClick={() => onSort("scope")}>
                      Scope{sortMark("scope")}
                    </button>
                  </th>
                  <th>
                    <button type="button" onClick={() => onSort("value")}>
                      Value{sortMark("value")}
                    </button>
                  </th>
                  <th>
                    <button type="button" onClick={() => onSort("quality")}>
                      Quality{sortMark("quality")}
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
                        <td data-label="Line">
                          {hasChildren ? (
                            <button
                              type="button"
                              className="html-report-row-toggle text-left text-ink underline-offset-2 hover:underline sm:text-left"
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
                        <td data-label="Scope" className="font-data text-ink-muted">
                          {row.scope}
                        </td>
                        <td data-label="Value" className="font-data">
                          {formatTco2e(row.value)}
                        </td>
                        <td data-label="Quality" className="font-data text-ink-muted">
                          {row.quality ?? "—"}
                        </td>
                      </tr>
                      {hasChildren && isOpen
                        ? row.children.map((child) => (
                            <tr
                              key={child.id}
                              className="html-report-child-row bg-surface-2/40"
                            >
                              <td
                                data-label="Line"
                                className="pl-6 text-ink-muted sm:pl-6"
                              >
                                {child.label}
                              </td>
                              <td data-label="Scope" className="font-data text-ink-muted">
                                {child.scope}
                              </td>
                              <td data-label="Value" className="font-data text-ink-muted">
                                —
                              </td>
                              <td
                                data-label="Quality"
                                className="font-data text-ink-muted"
                              >
                                —
                              </td>
                            </tr>
                          ))
                        : null}
                    </Fragment>
                  );
                })}
                {tableRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="html-report-empty-cell py-4 text-ink-muted"
                      data-label=""
                    >
                      No rows for this scope filter.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </details>
      </section>

      <section id="html-report-methodology" className="html-report-section mt-10">
        <details className="html-report-expand-force" open>
          <summary className="cursor-pointer list-none py-1">
            <p className="label-caps text-accent">04 — Methodology</p>
            <h2 className="font-display mt-1 text-xl sm:text-2xl">
              Assumptions and sources
            </h2>
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
