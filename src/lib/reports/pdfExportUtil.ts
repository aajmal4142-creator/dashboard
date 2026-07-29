export type PDFExportOptions = {
  title: string;
  orientation?: "portrait" | "landscape";
  includeWatermark?: boolean;
  confidential?: boolean;
};

export function generatePDFMetadata(
  orgName: string,
  reportName: string,
  options: PDFExportOptions,
): {
  title: string;
  author: string;
  subject: string;
  keywords: string[];
  creator: string;
} {
  return {
    title: options.title || reportName,
    author: orgName,
    subject: `ESG Report: ${reportName}`,
    keywords: ["ESG", "emissions", "sustainability", "report", reportName.toLowerCase()],
    creator: "ClearESG",
  };
}

export function generatePDFHeader(
  orgName: string,
  reportName: string,
  reportDate: Date,
  confidential?: boolean,
): string {
  const dateStr = reportDate.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const confidentialTag = confidential ? " [CONFIDENTIAL]" : "";

  return `
    <div style="text-align: center; margin-bottom: 40px; border-bottom: 2px solid #333; padding-bottom: 20px;">
      <h1 style="margin: 0; color: #1a5f3b;">${orgName}</h1>
      <h2 style="margin: 10px 0; color: #333;">${reportName}${confidentialTag}</h2>
      <p style="margin: 5px 0; color: #666; font-size: 12px;">Generated on ${dateStr}</p>
    </div>
  `;
}

export function generatePDFFooter(pageNumber: number, totalPages: number): string {
  return `
    <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #ccc; font-size: 10px; color: #666;">
      <p>Page ${pageNumber} of ${totalPages}</p>
      <p>© ClearESG - Confidential</p>
    </div>
  `;
}

export function generateScopeBreakdownChart(scopes: {
  scope1: number;
  scope2: number;
  scope3: number;
}): string {
  const total = scopes.scope1 + scopes.scope2 + scopes.scope3 || 1;
  const s1Pct = Math.round((scopes.scope1 / total) * 100);
  const s2Pct = Math.round((scopes.scope2 / total) * 100);
  const s3Pct = Math.round((scopes.scope3 / total) * 100);

  return `
    <div style="margin: 20px 0;">
      <h3>Scope Breakdown</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr style="background-color: #f0f0f0;">
          <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Scope</th>
          <th style="padding: 10px; text-align: right; border: 1px solid #ddd;">Emissions (kg CO2e)</th>
          <th style="padding: 10px; text-align: center; border: 1px solid #ddd;">Percentage</th>
        </tr>
        <tr>
          <td style="padding: 10px; border: 1px solid #ddd;">Scope 1 (Direct)</td>
          <td style="padding: 10px; text-align: right; border: 1px solid #ddd;">${scopes.scope1.toLocaleString()}</td>
          <td style="padding: 10px; text-align: center; border: 1px solid #ddd;">${s1Pct}%</td>
        </tr>
        <tr>
          <td style="padding: 10px; border: 1px solid #ddd;">Scope 2 (Indirect Energy)</td>
          <td style="padding: 10px; text-align: right; border: 1px solid #ddd;">${scopes.scope2.toLocaleString()}</td>
          <td style="padding: 10px; text-align: center; border: 1px solid #ddd;">${s2Pct}%</td>
        </tr>
        <tr>
          <td style="padding: 10px; border: 1px solid #ddd;">Scope 3 (Value Chain)</td>
          <td style="padding: 10px; text-align: right; border: 1px solid #ddd;">${scopes.scope3.toLocaleString()}</td>
          <td style="padding: 10px; text-align: center; border: 1px solid #ddd;">${s3Pct}%</td>
        </tr>
        <tr style="background-color: #f0f0f0; font-weight: bold;">
          <td style="padding: 10px; border: 1px solid #ddd;">Total</td>
          <td style="padding: 10px; text-align: right; border: 1px solid #ddd;">${total.toLocaleString()}</td>
          <td style="padding: 10px; text-align: center; border: 1px solid #ddd;">100%</td>
        </tr>
      </table>
    </div>
  `;
}

export function generateExecutiveSummary(
  scopes: { scope1: number; scope2: number; scope3: number },
  orgName: string,
): string {
  const total = scopes.scope1 + scopes.scope2 + scopes.scope3;

  return `
    <div style="margin: 30px 0;">
      <h2>Executive Summary</h2>
      <p>${orgName} generated <strong>${total.toLocaleString()} kg CO2e</strong> of greenhouse gas emissions during the reporting period.</p>
      <ul>
        <li><strong>Scope 1 (Direct):</strong> ${scopes.scope1.toLocaleString()} kg CO2e from fuel combustion and process emissions</li>
        <li><strong>Scope 2 (Indirect Energy):</strong> ${scopes.scope2.toLocaleString()} kg CO2e from purchased electricity and steam</li>
        <li><strong>Scope 3 (Value Chain):</strong> ${scopes.scope3.toLocaleString()} kg CO2e from business travel, supply chain, and other indirect sources</li>
      </ul>
      <p>This report provides a comprehensive analysis of emissions across all scopes and recommendations for reduction initiatives.</p>
    </div>
  `;
}
