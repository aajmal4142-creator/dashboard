import { renderToBuffer } from "@react-pdf/renderer";
import type { Payload, Where } from "payload";

import { buildStoreZip } from "@/lib/assurance/zipStore";

import { buildExecutiveHighlights } from "./htmlReport";
import { REPORT_DISCLAIMER, type ReportSnapshot } from "./types";

import { AudiencePackPdfDocument } from "./AudiencePackPdfDocument";
import {
  audiencePackBasename,
  audiencePackToCsv,
  buildAudiencePackManifest,
  type AudienceKind,
  type AudiencePackManifest,
} from "./audiencePack";

export type AudiencePackFormat = "pdf" | "csv" | "zip";

export type AssembleAudiencePackResult = {
  manifest: AudiencePackManifest;
  basename: string;
  buffer: Uint8Array;
  contentType: string;
  filename: string;
};

function relationId(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "id" in value) {
    const id = (value as { id: unknown }).id;
    return typeof id === "string" ? id : null;
  }
  return null;
}

function asSnapshot(value: unknown): ReportSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const s = value as ReportSnapshot;
  if (typeof s.organisationName !== "string") return null;
  if (!s.emissions || typeof s.emissions.total !== "number") return null;
  return s;
}

/**
 * Load published report snapshot and assemble audience pack bytes (board / ops / auditor).
 * Distinct from F17 assurance evidence pack — no lineage, factors, or evidence index.
 */
export async function assembleAudiencePack(opts: {
  payload: Payload;
  organisationId: string;
  periodId?: string | null;
  reportId?: string | null;
  format: AudiencePackFormat;
  audience?: AudienceKind | null;
}): Promise<
  | { ok: true; result: AssembleAudiencePackResult }
  | { ok: false; status: number; error: string }
> {
  let report: {
    id: string;
    version: number;
    status?: string | null;
    snapshot?: unknown;
    organisation: string | { id: string };
    period: string | { id: string };
    framework?: string | null;
  } | null = null;

  if (opts.reportId) {
    try {
      report = await opts.payload.findByID({
        collection: "reports",
        id: opts.reportId,
        depth: 0,
        overrideAccess: true,
      });
    } catch {
      return { ok: false, status: 404, error: "Report not found" };
    }
    const orgId = relationId(report.organisation);
    if (orgId !== opts.organisationId) {
      return { ok: false, status: 404, error: "Report not found" };
    }
  } else {
    const whereAnd: Where[] = [
      { organisation: { equals: opts.organisationId } },
      { status: { equals: "published" } },
    ];
    if (opts.periodId) {
      whereAnd.push({ period: { equals: opts.periodId } });
    }
    const found = await opts.payload.find({
      collection: "reports",
      where: { and: whereAnd },
      sort: "-version",
      limit: 1,
      depth: 0,
      overrideAccess: true,
    });
    report = found.docs[0] ?? null;
  }

  if (!report) {
    return {
      ok: false,
      status: 404,
      error:
        "No published report for this organisation and period. Publish from Reports first.",
    };
  }

  const periodId = relationId(report.period);
  if (!periodId) {
    return { ok: false, status: 409, error: "Report has no reporting period" };
  }
  if (opts.periodId && opts.periodId !== periodId) {
    return {
      ok: false,
      status: 409,
      error: "Report period does not match the requested period",
    };
  }

  const snapshot = asSnapshot(report.snapshot);
  if (!snapshot) {
    return {
      ok: false,
      status: 409,
      error: "Published report has no snapshot. Re-publish from Reports.",
    };
  }

  const audience = opts.audience ?? "board_investor";
  const gapSummaries = (snapshot.dataGaps ?? []).map(
    (g) => `${g.severity}: ${g.code} — ${g.message}`,
  );

  const manifest = buildAudiencePackManifest({
    organisationId: opts.organisationId,
    organisationName: snapshot.organisationName,
    periodId,
    periodLabel: snapshot.periodLabel,
    framework: snapshot.framework,
    versionLabel: `v${report.version}`,
    generatedAt: new Date().toISOString(),
    disclaimer: snapshot.disclaimer || REPORT_DISCLAIMER,
    reportId: report.id,
    audience,
    band: snapshot.band,
    scores: snapshot.scores,
    emissions: snapshot.emissions,
    yoy: snapshot.yoy ?? null,
    materialityNarrative: snapshot.materiality?.narrative ?? null,
    gapCount: snapshot.dataGaps?.length ?? 0,
    gapSummaries,
    highlights:
      audience === "board_investor" ? buildExecutiveHighlights(snapshot) : undefined,
  });

  const basename = audiencePackBasename(manifest);
  const csvText = audiencePackToCsv(manifest);
  const csvBytes = new TextEncoder().encode(csvText);

  if (opts.format === "csv") {
    return {
      ok: true,
      result: {
        manifest,
        basename,
        buffer: csvBytes,
        contentType: "text/csv; charset=utf-8",
        filename: `${basename}.csv`,
      },
    };
  }

  const pdfBuffer = await renderToBuffer(<AudiencePackPdfDocument manifest={manifest} />);
  const pdfBytes = new Uint8Array(pdfBuffer);

  if (opts.format === "pdf") {
    return {
      ok: true,
      result: {
        manifest,
        basename,
        buffer: pdfBytes,
        contentType: "application/pdf",
        filename: `${basename}.pdf`,
      },
    };
  }

  const zip = buildStoreZip([
    { name: `${basename}.pdf`, data: pdfBytes },
    { name: `${basename}.csv`, data: csvBytes },
    {
      name: `${basename}.manifest.json`,
      data: new TextEncoder().encode(JSON.stringify(manifest, null, 2)),
    },
  ]);

  return {
    ok: true,
    result: {
      manifest,
      basename,
      buffer: zip,
      contentType: "application/zip",
      filename: `${basename}.zip`,
    },
  };
}
