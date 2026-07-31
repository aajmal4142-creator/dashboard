/**
 * I/O boundary for compliance checklist export — Payload + file buffers.
 */

import { renderToBuffer } from "@react-pdf/renderer";
import { getPayload } from "payload";

import type { ObligationStandard } from "@/lib/obligations/types";
import config from "@/payload.config";

import {
  buildChecklistFilename,
  buildChecklistSnapshot,
  defaultExportPeriod,
  type ChecklistExportFormat,
  type ChecklistExportSnapshot,
  type ObligationExportSource,
} from "./checklistExport";
import { ChecklistExportPdfDocument } from "./ChecklistExportPdfDocument";
import { buildChecklistExcelBuffer } from "./checklistExportExcel";

function isObligationStandard(value: string): value is ObligationStandard {
  return (
    value === "CSRD_SET1" ||
    value === "CSRD_SIMPLIFIED" ||
    value === "BRSR" ||
    value === "VSME" ||
    value === "GRI"
  );
}

export async function loadObligationExportSources(
  organisationId: string,
): Promise<ObligationExportSource[]> {
  const payload = await getPayload({ config });
  const result = await payload.find({
    collection: "compliance-obligations",
    where: { organisation: { equals: organisationId } },
    limit: 200,
    depth: 0,
    overrideAccess: true,
  });

  return result.docs.flatMap((doc) => {
    if (!isObligationStandard(doc.standardVersion)) return [];
    const checklistStatus =
      doc.checklistStatus === "complete" || doc.checklistStatus === "pending"
        ? doc.checklistStatus
        : "pending";
    return [
      {
        id: doc.id,
        standardVersion: doc.standardVersion,
        wave: doc.wave,
        jurisdiction: doc.jurisdiction,
        firstReportingFY: doc.firstReportingFY,
        filingDeadline: doc.filingDeadline,
        notes: doc.notes,
        derivationReason: doc.derivationReason,
        checklistStatus,
        confidence: doc.confidence,
        source: doc.source,
        confirmedAt: doc.confirmedAt,
        owner: doc.owner,
        evidenceLink: doc.evidenceLink,
      },
    ];
  });
}

export async function buildObligationChecklistExport(input: {
  organisationId: string;
  organisationName: string;
  period?: string | null;
  format: ChecklistExportFormat;
  confirmedOnly?: boolean;
}): Promise<{
  buffer: Buffer;
  filename: string;
  contentType: string;
  snapshot: ChecklistExportSnapshot;
}> {
  const period = input.period?.trim() || defaultExportPeriod();
  const sources = await loadObligationExportSources(input.organisationId);
  const snapshot = buildChecklistSnapshot({
    organisationName: input.organisationName,
    period,
    sources,
    confirmedOnly: input.confirmedOnly,
  });
  const filename = buildChecklistFilename(input.organisationName, period, input.format);

  if (input.format === "pdf") {
    const buffer = Buffer.from(
      await renderToBuffer(<ChecklistExportPdfDocument snapshot={snapshot} />),
    );
    return {
      buffer,
      filename,
      contentType: "application/pdf",
      snapshot,
    };
  }

  const buffer = await buildChecklistExcelBuffer(snapshot);
  return {
    buffer,
    filename,
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    snapshot,
  };
}
