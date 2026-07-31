import { renderToBuffer } from "@react-pdf/renderer";

import type { SendEmailAttachment } from "@/lib/email/send";
import { ReportPdfDocument } from "@/lib/reports/ReportPdfDocument";
import {
  snapshotToJsonExport,
  snapshotToXmlExport,
  type MachineExportContext,
  type MachineExportDatapointInput,
} from "@/lib/reports/machineExport";
import { snapshotToCsv, type ReportSnapshot } from "@/lib/reports/types";

export type ReportDeliveryFormat = "pdf" | "csv" | "json" | "xml";

export async function generateReportAttachment(params: {
  snapshot: ReportSnapshot;
  format: ReportDeliveryFormat;
  watermarked?: boolean;
  organisationId?: string;
  periodId?: string | null;
  status?: string | null;
  datapoints?: MachineExportDatapointInput[];
}): Promise<SendEmailAttachment> {
  const { snapshot, format } = params;
  const base = `clearesg-${slugify(snapshot.organisationName)}-v${snapshot.version}`;

  if (format === "csv") {
    const csv = snapshotToCsv(snapshot);
    return {
      filename: `${base}.csv`,
      content: Buffer.from(csv, "utf8").toString("base64"),
      contentType: "text/csv; charset=utf-8",
    };
  }

  const exportCtx: MachineExportContext = {
    organisationId: params.organisationId ?? "unknown",
    periodId: params.periodId ?? null,
    status: params.status ?? null,
    datapoints: params.datapoints ?? [],
  };

  if (format === "json") {
    const json = snapshotToJsonExport(snapshot, exportCtx);
    return {
      filename: `${base}.json`,
      content: Buffer.from(json, "utf8").toString("base64"),
      contentType: "application/json",
    };
  }

  if (format === "xml") {
    const xml = snapshotToXmlExport(snapshot, exportCtx);
    return {
      filename: `${base}.xml`,
      content: Buffer.from(xml, "utf8").toString("base64"),
      contentType: "application/xml; charset=utf-8",
    };
  }

  const buffer = await renderToBuffer(
    <ReportPdfDocument snapshot={snapshot} watermarked={params.watermarked ?? false} />,
  );
  return {
    filename: `${base}.pdf`,
    content: Buffer.from(buffer).toString("base64"),
    contentType: "application/pdf",
  };
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "report"
  );
}
