import { getPayload } from "payload";
import config from "@/payload.config";
import { getDataQualityRating } from "./dataQualityAssessor";

export interface ComplianceReportData {
  organisationName: string;
  complianceYear: string;
  reportDate: string;
  scope1Total: number;
  scope2Total: number;
  scope3Total: number;
  complianceScore: number;
  dataQualityScore: number;
  checkpointsFulfilled: number;
  checkpointsTotal: number;
  boundaryDefinition: string;
  methodology: string;
  preparedBy: string;
  verifiedBy?: string;
  verifiedAt?: string;
  isLocked: boolean;
}

function relationId(
  value: string | { id: string } | null | undefined,
): string | undefined {
  if (!value) return undefined;
  return typeof value === "string" ? value : value.id;
}

export async function generateComplianceReport(
  organisationId: string,
  complianceId: string,
): Promise<string> {
  const payload = await getPayload({ config });

  const compliance = await payload.findByID({
    collection: "ghg-protocol-compliance",
    id: complianceId,
  });

  if (!compliance || relationId(compliance.organisation) !== organisationId) {
    throw new Error("Compliance record not found");
  }

  const organisation = await payload.findByID({
    collection: "organisations",
    id: organisationId,
  });

  const checkpoints = await payload.find({
    collection: "compliance-checkpoints",
    where: {
      ghgProtocolCompliance: { equals: complianceId },
    },
    limit: 100,
  });

  const verified = (checkpoints.docs || []).filter(
    (cp) => cp.status === "verified",
  ).length;
  const total = checkpoints.docs?.length || 0;

  const narrative = generateNarrative({
    organisationName: organisation.name,
    complianceYear: compliance.complianceYear,
    reportDate: new Date().toISOString().split("T")[0],
    scope1Total: compliance.scope1Total,
    scope2Total: compliance.scope2Total,
    scope3Total: compliance.scope3Total,
    complianceScore: compliance.complianceScore,
    dataQualityScore: compliance.dataQualityScore,
    checkpointsFulfilled: verified,
    checkpointsTotal: total,
    boundaryDefinition: compliance.boundaryDefinition,
    methodology: compliance.methodology,
    preparedBy: "GHG Protocol Compliance System",
    verifiedBy: relationId(compliance.verifiedBy),
    verifiedAt: compliance.verifiedAt ?? undefined,
    isLocked: compliance.isLocked,
  });

  return narrative;
}

function generateNarrative(data: ComplianceReportData): string {
  const parts: string[] = [];

  // Header
  parts.push("# GHG Protocol 2004/2015 Compliance Report\n");
  parts.push(`**${data.organisationName}**`);
  parts.push(`Reporting Year: ${data.complianceYear}`);
  parts.push(`Report Date: ${data.reportDate}\n`);

  // Executive Summary
  parts.push("## Executive Summary\n");
  parts.push(
    `${data.organisationName} has completed a comprehensive GHG Protocol 2004/2015 compliance assessment for the year ${data.complianceYear}.`,
  );
  parts.push(
    `This report documents emissions calculations, data quality, and compliance with international GHG accounting standards.\n`,
  );

  // Emissions Summary
  parts.push("## Emissions Summary (tCO2e)\n");
  parts.push(`| Scope | Emissions (tCO2e) | Percentage |`);
  parts.push(`|-------|------------------|-----------|`);
  const total = data.scope1Total + data.scope2Total + data.scope3Total;
  const scope1Pct = total > 0 ? ((data.scope1Total / total) * 100).toFixed(1) : "0.0";
  const scope2Pct = total > 0 ? ((data.scope2Total / total) * 100).toFixed(1) : "0.0";
  const scope3Pct = total > 0 ? ((data.scope3Total / total) * 100).toFixed(1) : "0.0";
  parts.push(
    `| Scope 1 (Direct) | ${data.scope1Total.toLocaleString()} | ${scope1Pct}% |`,
  );
  parts.push(
    `| Scope 2 (Indirect - Energy) | ${data.scope2Total.toLocaleString()} | ${scope2Pct}% |`,
  );
  parts.push(
    `| Scope 3 (Other Indirect) | ${data.scope3Total.toLocaleString()} | ${scope3Pct}% |`,
  );
  parts.push(`| **TOTAL** | **${total.toLocaleString()}** | **100.0%** |\n`);

  // Compliance Status
  parts.push("## Compliance Status\n");
  parts.push(`**Overall Compliance Score:** ${data.complianceScore}%`);
  parts.push(
    `**Checkpoints Fulfilled:** ${data.checkpointsFulfilled}/${data.checkpointsTotal} (${
      total > 0
        ? ((data.checkpointsFulfilled / data.checkpointsTotal) * 100).toFixed(1)
        : "0.0"
    }%)\n`,
  );

  if (data.complianceScore >= 90) {
    parts.push(
      "**Status:** ✓ **EXCELLENT** - Organization is highly compliant with GHG Protocol standards.\n",
    );
  } else if (data.complianceScore >= 75) {
    parts.push(
      "**Status:** ✓ **GOOD** - Organization meets most GHG Protocol requirements.\n",
    );
  } else if (data.complianceScore >= 60) {
    parts.push(
      "**Status:** ⚠ **ACCEPTABLE** - Organization meets baseline requirements but has improvement opportunities.\n",
    );
  } else {
    parts.push(
      "**Status:** ✗ **NEEDS IMPROVEMENT** - Organization should address identified gaps before assurance.\n",
    );
  }

  // Data Quality
  parts.push("## Data Quality Assessment\n");
  parts.push(`**Overall Data Quality Score:** ${data.dataQualityScore}%`);
  parts.push(`**Rating:** ${getDataQualityRating(data.dataQualityScore)}\n`);

  if (data.dataQualityScore >= 80) {
    parts.push(
      "Data quality is **high** and suitable for third-party assurance audit.\n",
    );
  } else if (data.dataQualityScore >= 60) {
    parts.push(
      "Data quality is **acceptable** but should be improved before external assurance engagement.\n",
    );
  } else {
    parts.push(
      "Data quality is **concerning** and requires significant improvement before audit readiness.\n",
    );
  }

  // Boundaries
  parts.push("## Organizational and Operational Boundaries\n");
  parts.push(`${data.boundaryDefinition}\n`);

  // Methodology
  parts.push("## Calculation Methodology\n");
  parts.push(`${data.methodology}\n`);

  // Verification Status
  if (data.isLocked) {
    parts.push("## Verification and Lock Status\n");
    parts.push("✓ **LOCKED FOR ASSURANCE AUDIT**\n");
    if (data.verifiedBy) {
      parts.push(`This compliance record has been locked by ${data.verifiedBy}`);
      if (data.verifiedAt) {
        parts.push(` on ${new Date(data.verifiedAt).toLocaleDateString()}`);
      }
      parts.push(". No further modifications are permitted.\n");
    }
  }

  // Footer
  parts.push("---\n");
  parts.push(`*Report prepared by: ${data.preparedBy}*`);
  parts.push(
    `*This report is audit-ready and suitable for third-party GHG Protocol verification.*\n`,
  );

  return parts.join("\n");
}

export async function exportReportAsMarkdown(
  organisationId: string,
  complianceId: string,
): Promise<string> {
  return generateComplianceReport(organisationId, complianceId);
}

export async function exportReportAsHTML(
  organisationId: string,
  complianceId: string,
): Promise<string> {
  const markdown = await generateComplianceReport(organisationId, complianceId);

  // Simple markdown to HTML conversion (in production, use a library like markdown-it)
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GHG Protocol Compliance Report</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; margin: 40px; }
    h1 { color: #333; border-bottom: 3px solid #2c3e50; padding-bottom: 10px; }
    h2 { color: #555; margin-top: 30px; }
    table { border-collapse: collapse; width: 100%; margin: 20px 0; }
    th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
    th { background-color: #f8f9fa; }
    .status-excellent { color: #27ae60; font-weight: bold; }
    .status-good { color: #3498db; font-weight: bold; }
    .status-warning { color: #f39c12; font-weight: bold; }
    .status-error { color: #e74c3c; font-weight: bold; }
  </style>
</head>
<body>
  ${markdown
    .replace(/# /g, "<h1>")
    .replace(/## /g, "<h2>")
    .replace(/\n/g, "<br>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/✓/g, "✓")
    .replace(/✗/g, "✗")
    .replace(/⚠/g, "⚠")}
</body>
</html>
  `;

  return html;
}
