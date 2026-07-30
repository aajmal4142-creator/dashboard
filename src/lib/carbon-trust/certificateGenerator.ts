import crypto from "crypto";

interface CertificateData {
  certificateNumber: string;
  organisationName: string;
  issuedDate: Date;
  expiresDate: Date;
  scope: "scope1" | "scope2" | "scope3" | "all";
  auditorName: string;
  baselineYear: number;
  verifiedEmissions: number;
}

export async function generateCertificatePDF(data: CertificateData): Promise<Buffer> {
  // Format dates
  const issuedDateStr = data.issuedDate.toLocaleDateString("en-GB", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const expiresDateStr = data.expiresDate.toLocaleDateString("en-GB", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Scope label mapping
  const scopeLabels: Record<string, string> = {
    scope1: "Scope 1: Direct Emissions",
    scope2: "Scope 2: Indirect Emissions (Energy)",
    scope3: "Scope 3: Other Indirect Emissions",
    all: "All Scopes (1, 2, and 3)",
  };

  // Return SVG representation (can be converted to PDF by client or via service)
  // In production, use pdfkit or puppeteer to generate actual PDF
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 800 1100" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style>
      .bg { fill: white; }
      .border { stroke: #1a5f3d; stroke-width: 8; fill: none; }
      .line { stroke: #1a5f3d; stroke-width: 2; }
      .logo { font-size: 32px; font-weight: bold; fill: #1a5f3d; text-anchor: middle; }
      .title { font-size: 44px; font-weight: bold; fill: #1a5f3d; text-anchor: middle; }
      .subtitle { font-size: 20px; fill: #666; text-anchor: middle; }
      .label { font-size: 16px; font-weight: bold; fill: #333; }
      .value { font-size: 18px; fill: #1a5f3d; font-weight: 500; }
      .body { font-size: 14px; fill: #333; line-height: 20px; }
      .footer { font-size: 11px; fill: #999; text-anchor: middle; }
    </style>
  </defs>

  <rect class="bg" width="800" height="1100"/>
  <rect class="border" x="20" y="20" width="760" height="1060"/>

  <!-- Header -->
  <text class="logo" x="400" y="80">🌍 CARBON TRUST STANDARD</text>
  <text class="title" x="400" y="140">Certificate of Verification</text>
  <text class="subtitle" x="400" y="175">Independent Third-Party Verification</text>
  <line class="line" x1="60" y1="200" x2="740" y2="200"/>

  <!-- Body -->
  <text class="body" x="60" y="240">This certifies that</text>
  <text class="label" x="60" y="280">Organization:</text>
  <text class="value" x="60" y="310">${data.organisationName}</text>

  <text class="body" x="60" y="360">has successfully completed the Carbon Trust Standard verification process and demonstrated</text>
  <text class="body" x="60" y="380">commitment to accurate carbon accounting and transparent reporting.</text>

  <text class="label" x="60" y="430">Certificate Number:</text>
  <text class="value" x="60" y="460" style="font-family: monospace;">${data.certificateNumber}</text>

  <text class="label" x="60" y="510">Verification Scope:</text>
  <text class="value" x="60" y="540">${scopeLabels[data.scope]}</text>

  <text class="label" x="60" y="590">Baseline Year:</text>
  <text class="value" x="60" y="620">${data.baselineYear}</text>

  <text class="label" x="60" y="670">Verified Emissions (tCO2e):</text>
  <text class="value" x="60" y="700">${data.verifiedEmissions.toLocaleString("en-GB")}</text>

  <text class="label" x="60" y="750">Issued Date:</text>
  <text class="value" x="60" y="780">${issuedDateStr}</text>

  <text class="label" x="60" y="830">Expiration Date:</text>
  <text class="value" x="60" y="860">${expiresDateStr}</text>

  <text class="label" x="60" y="910">Auditor:</text>
  <text class="value" x="60" y="940">${data.auditorName}</text>

  <line class="line" x1="60" y1="980" x2="740" y2="980"/>

  <!-- Footer -->
  <text class="footer" x="400" y="1020">This certificate is valid for 3 years from the date of issue.</text>
  <text class="footer" x="400" y="1040">For independent verification visit: https://verify.clearesg.local</text>
  <text class="footer" x="400" y="1070">Renewal applications must be submitted 90 days before expiration.</text>
</svg>`;

  return Buffer.from(svg, "utf-8");
}

export function generateCertificateNumber(orgId: string, timestamp: Date): string {
  const year = timestamp.getFullYear();
  const month = String(timestamp.getMonth() + 1).padStart(2, "0");
  const day = String(timestamp.getDate()).padStart(2, "0");
  const random = crypto.randomBytes(4).toString("hex").substring(0, 4).toUpperCase();
  return `CT-${year}${month}${day}-${random}`;
}

export function calculateExpirationDate(issuedDate: Date): Date {
  const expiration = new Date(issuedDate);
  expiration.setFullYear(expiration.getFullYear() + 3);
  return expiration;
}

export function isExpiringSoon(expiresDate: Date, daysThreshold: number = 90): boolean {
  const today = new Date();
  const thresholdDate = new Date(today);
  thresholdDate.setDate(thresholdDate.getDate() + daysThreshold);
  return expiresDate <= thresholdDate;
}

export function isExpired(expiresDate: Date): boolean {
  return new Date() > expiresDate;
}

export function daysUntilExpiry(expiresDate: Date): number {
  const today = new Date();
  const diff = expiresDate.getTime() - today.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}
