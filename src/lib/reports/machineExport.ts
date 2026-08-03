import { DATA_METRIC_BY_KEY } from "@/lib/data/metrics";

import type { ReportSnapshot, ScopeBreakdownRow } from "./types";

/** ClearESG ESG XML namespace for machine-readable report export. */
export const ESG_XML_NS = "https://schema.clearesg.com/esg/1.0";

/**
 * Field-name schema for machine export.
 * Names match Payload collection field definitions:
 * - Reports (`organisation`, `period`, `framework`, `version`, `status`, `publishedAt`,
 *   nested `emissions.scope1|scope2|scope3`)
 * - Datapoints (`id`, `value`, `unit`, `quality`, `metricKey`, `approvalState`, `enteredAt`)
 * - MetricDefinitions (`category`)
 *
 * Export slot `timestamp` resolves from Datapoints.enteredAt (fallback updatedAt / createdAt).
 */
export const MACHINE_EXPORT_SCHEMA = {
  reports: {
    organisation: "organisation",
    period: "period",
    framework: "framework",
    version: "version",
    status: "status",
    publishedAt: "publishedAt",
    emissions: {
      scope1: "scope1",
      scope2: "scope2",
      scope3: "scope3",
    },
  },
  datapoints: {
    id: "id",
    value: "value",
    unit: "unit",
    quality: "quality",
    metricKey: "metricKey",
    approvalState: "approvalState",
    enteredAt: "enteredAt",
  },
  metricDefinitions: {
    category: "category",
  },
} as const;

/** Convenience alias used by builders / tests. */
export const MACHINE_EXPORT_FIELDS = {
  metadata: MACHINE_EXPORT_SCHEMA.reports,
  emissions: MACHINE_EXPORT_SCHEMA.reports.emissions,
  datapoint: {
    ...MACHINE_EXPORT_SCHEMA.datapoints,
    category: MACHINE_EXPORT_SCHEMA.metricDefinitions.category,
  },
} as const;

/** Confirmed datapoints only — Datapoints.approvalState = approved. */
export const CONFIRMED_APPROVAL_STATE = "approved" as const;

export type MachineExportDatapointInput = {
  id: string;
  value?: number | null;
  unit?: string | null;
  metricKey: string;
  quality: string;
  approvalState: string;
  enteredAt?: string | null;
  updatedAt?: string | null;
  createdAt?: string | null;
};

export type MachineExportDatapointRow = {
  id: string;
  value: number | null;
  unit: string | null;
  category: string | null;
  quality: string;
  timestamp: string | null;
};

export type MachineExportDocument = {
  report: {
    metadata: {
      organisation: string;
      organisationId: string;
      period: string;
      periodId: string | null;
      framework: string;
      version: number;
      status: string | null;
      publishedAt: string;
      emissionsStandard: string | null;
      disclaimer: string;
    };
    emissions: {
      scope1: number;
      scope2: number;
      scope2LocationBased: number;
      scope2MarketBased: number | null;
      scope2LocationQuality: string | null;
      scope2MarketQuality: string | null;
      scope3: number;
      total: number;
      dataQualityPct: number;
    };
    breakdown: {
      items: ReportSnapshot["breakdown"];
      scopes: {
        scope1: ScopeBreakdownRow | null;
        scope2: ScopeBreakdownRow | null;
        scope2Market: ScopeBreakdownRow | null;
        scope3: ScopeBreakdownRow | null;
      };
    };
  };
  datapoints: MachineExportDatapointRow[];
};

export type MachineExportContext = {
  organisationId: string;
  periodId: string | null;
  status: string | null;
  datapoints: MachineExportDatapointInput[];
};

function categoryForMetricKey(metricKey: string): string | null {
  const def = DATA_METRIC_BY_KEY[metricKey];
  return def?.category ?? null;
}

function datapointTimestamp(dp: MachineExportDatapointInput): string | null {
  return dp.enteredAt ?? dp.updatedAt ?? dp.createdAt ?? null;
}

/** Map confirmed datapoints using schema field names; drop unverified rows. */
export function mapConfirmedDatapoints(
  rows: MachineExportDatapointInput[],
): MachineExportDatapointRow[] {
  return rows
    .filter((row) => row.approvalState === CONFIRMED_APPROVAL_STATE)
    .map((row) => ({
      id: String(row.id),
      value: typeof row.value === "number" ? row.value : null,
      unit: row.unit ?? null,
      category: categoryForMetricKey(row.metricKey),
      quality: row.quality,
      timestamp: datapointTimestamp(row),
    }));
}

export function buildMachineExportDocument(
  snapshot: ReportSnapshot,
  ctx: MachineExportContext,
): MachineExportDocument {
  return {
    report: {
      metadata: {
        organisation: snapshot.organisationName,
        organisationId: ctx.organisationId,
        period: snapshot.periodLabel,
        periodId: ctx.periodId,
        framework: snapshot.framework,
        version: snapshot.version,
        status: ctx.status,
        publishedAt: snapshot.publishedAt,
        emissionsStandard: snapshot.emissionsStandard ?? null,
        disclaimer: snapshot.disclaimer,
      },
      emissions: {
        scope1: snapshot.emissions.scope1,
        scope2: snapshot.emissions.scope2,
        scope2LocationBased:
          snapshot.emissions.scope2LocationBased ?? snapshot.emissions.scope2,
        scope2MarketBased: snapshot.emissions.scope2MarketBased ?? null,
        scope2LocationQuality: snapshot.emissions.scope2LocationQuality ?? null,
        scope2MarketQuality: snapshot.emissions.scope2MarketQuality ?? null,
        scope3: snapshot.emissions.scope3,
        total: snapshot.emissions.total,
        dataQualityPct: snapshot.emissions.dataQualityPct,
      },
      breakdown: {
        items: snapshot.breakdown,
        scopes: {
          scope1: snapshot.scopeBreakdown?.scope1 ?? null,
          scope2: snapshot.scopeBreakdown?.scope2 ?? null,
          scope2Market: snapshot.scopeBreakdown?.scope2Market ?? null,
          scope3: snapshot.scopeBreakdown?.scope3 ?? null,
        },
      },
    },
    datapoints: mapConfirmedDatapoints(ctx.datapoints),
  };
}

export function snapshotToJsonExport(
  snapshot: ReportSnapshot,
  ctx: MachineExportContext,
): string {
  return JSON.stringify(buildMachineExportDocument(snapshot, ctx), null, 2);
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function el(name: string, content: string, attrs?: Record<string, string>): string {
  const attrStr = attrs
    ? Object.entries(attrs)
        .map(([k, v]) => ` ${k}="${escapeXml(v)}"`)
        .join("")
    : "";
  return `<${name}${attrStr}>${content}</${name}>`;
}

function textEl(name: string, value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return `<${name}/>`;
  }
  return el(name, escapeXml(String(value)));
}

function scopeBreakdownXml(name: string, row: ScopeBreakdownRow | null): string {
  if (!row) return `<${name}/>`;
  return el(
    name,
    [
      textEl("value", row.value),
      textEl("quality", row.quality),
      textEl("methodology", row.methodology),
      textEl("uncertainties", row.uncertainties),
      el("sources", row.sources.map((s) => textEl("source", s)).join("")),
    ].join(""),
  );
}

export function snapshotToXmlExport(
  snapshot: ReportSnapshot,
  ctx: MachineExportContext,
): string {
  const doc = buildMachineExportDocument(snapshot, ctx);
  const meta = doc.report.metadata;
  const emis = doc.report.emissions;
  const emisFields = MACHINE_EXPORT_FIELDS.emissions;

  const metadataXml = el(
    "metadata",
    [
      textEl(MACHINE_EXPORT_FIELDS.metadata.organisation, meta.organisation),
      textEl("organisationId", meta.organisationId),
      textEl(MACHINE_EXPORT_FIELDS.metadata.period, meta.period),
      textEl("periodId", meta.periodId),
      textEl(MACHINE_EXPORT_FIELDS.metadata.framework, meta.framework),
      textEl(MACHINE_EXPORT_FIELDS.metadata.version, meta.version),
      textEl(MACHINE_EXPORT_FIELDS.metadata.status, meta.status),
      textEl(MACHINE_EXPORT_FIELDS.metadata.publishedAt, meta.publishedAt),
      textEl("emissionsStandard", meta.emissionsStandard),
      textEl("disclaimer", meta.disclaimer),
    ].join(""),
  );

  const emissionsXml = el(
    "esg:emissions",
    [
      textEl(`esg:${emisFields.scope1}`, emis.scope1),
      textEl(`esg:${emisFields.scope2}`, emis.scope2),
      textEl(`esg:${emisFields.scope3}`, emis.scope3),
      textEl("esg:total", emis.total),
      textEl("esg:dataQualityPct", emis.dataQualityPct),
    ].join(""),
  );

  const itemsXml = el(
    "items",
    doc.report.breakdown.items
      .map((item) =>
        el(
          "item",
          [
            textEl("component", item.component),
            textEl("contribution", item.contribution),
            textEl("explanation", item.explanation),
          ].join(""),
        ),
      )
      .join(""),
  );

  const scopesXml = el(
    "scopes",
    [
      scopeBreakdownXml(emisFields.scope1, doc.report.breakdown.scopes.scope1),
      scopeBreakdownXml(emisFields.scope2, doc.report.breakdown.scopes.scope2),
      scopeBreakdownXml(emisFields.scope3, doc.report.breakdown.scopes.scope3),
    ].join(""),
  );

  const breakdownXml = el("breakdown", itemsXml + scopesXml);

  const dpFields = MACHINE_EXPORT_FIELDS.datapoint;
  const datapointsXml = el(
    "datapoints",
    doc.datapoints
      .map((dp) =>
        el(
          "datapoint",
          [
            textEl(dpFields.id, dp.id),
            textEl(dpFields.value, dp.value),
            textEl(dpFields.unit, dp.unit),
            textEl(dpFields.category, dp.category),
            textEl(dpFields.quality, dp.quality),
            textEl("timestamp", dp.timestamp),
          ].join(""),
        ),
      )
      .join(""),
  );

  const root = el("report", metadataXml + emissionsXml + breakdownXml + datapointsXml, {
    date: snapshot.publishedAt,
    org_id: ctx.organisationId,
    version: String(snapshot.version),
    "xmlns:esg": ESG_XML_NS,
  });

  return `<?xml version="1.0" encoding="UTF-8"?>\n${root}\n`;
}

export type MachineExportFormat = "json" | "xml" | "csv" | "xlsx";

export function parseMachineExportFormat(raw: string | null): MachineExportFormat | null {
  if (!raw) return "json";
  const normalised = raw.trim().toLowerCase();
  if (
    normalised === "json" ||
    normalised === "xml" ||
    normalised === "csv" ||
    normalised === "xlsx" ||
    normalised === "excel"
  ) {
    return normalised === "excel" ? "xlsx" : normalised;
  }
  return null;
}
