import crypto from "crypto";

interface CertificateData {
  certificationId: string;
  organisationName: string;
  certificateNumber: string;
  issuedDate: Date;
  expiresDate: Date;
  scope: "scope1" | "scope2" | "scope3" | "all";
  auditorName: string;
  baselineYear: number;
  verifiedEmissions: number;
}

interface GeneratedCertificate {
  pdfBytes: Buffer;
  certificateNumber: string;
  verificationToken: string;
}

export async function generateCertificatePDF(
  data: CertificateData,
): Promise<GeneratedCertificate> {
  // Create verification token
  const verificationToken = crypto.randomBytes(32).toString("hex");

  // Format dates
  const issuedDateStr = data.issuedDate.toLocaleDateString("en-GB");
  const expiresDateStr = data.expiresDate.toLocaleDateString("en-GB");

  // Scope label mapping
  const scopeLabels = {
    scope1: "Scope 1: Direct Emissions",
    scope2: "Scope 2: Indirect Emissions (Energy)",
    scope3: "Scope 3: Other Indirect Emissions",
    all: "All Scopes (1, 2, and 3)",
  };

  // Create PDF content as HTML string (to be rendered server-side)
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8" />
      <style>
        body {
          font-family: Arial, sans-serif;
          margin: 0;
          padding: 40px;
          background: #f5f5f5;
        }
        .certificate {
          background: white;
          border: 3px solid #1a5f3d;
          padding: 60px;
          max-width: 900px;
          margin: 0 auto;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
          position: relative;
        }
        .header {
          text-align: center;
          border-bottom: 2px solid #1a5f3d;
          padding-bottom: 30px;
          margin-bottom: 40px;
        }
        .logo {
          font-size: 24px;
          font-weight: bold;
          color: #1a5f3d;
          margin-bottom: 10px;
        }
        .title {
          font-size: 28px;
          font-weight: bold;
          color: #1a5f3d;
          margin-bottom: 10px;
        }
        .subtitle {
          font-size: 16px;
          color: #666;
        }
        .content {
          margin: 40px 0;
          line-height: 1.8;
        }
        .field {
          margin: 20px 0;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .field-label {
          font-weight: bold;
          color: #333;
          flex: 0 0 40%;
        }
        .field-value {
          color: #1a5f3d;
          font-size: 16px;
          flex: 1;
          text-align: right;
        }
        .footer {
          margin-top: 60px;
          border-top: 2px solid #1a5f3d;
          padding-top: 30px;
          text-align: center;
        }
        .verification-section {
          background: #f0f5f3;
          padding: 20px;
          border-radius: 8px;
          margin-top: 30px;
          font-size: 12px;
          color: #666;
        }
        .cert-number {
          font-family: monospace;
          font-size: 14px;
          background: #eee;
          padding: 5px 10px;
          border-radius: 4px;
          display: inline-block;
        }
      </style>
    </head>
    <body>
      <div class="certificate">
        <div class="header">
          <div class="logo">🌍 CARBON TRUST STANDARD</div>
          <div class="title">Certificate of Verification</div>
          <div class="subtitle">Independent Third-Party Verification</div>
        </div>

        <div class="content">
          <p>This certifies that</p>
          <div class="field">
            <div class="field-label">Organization:</div>
            <div class="field-value"><strong>${data.organisationName}</strong></div>
          </div>

          <p>has successfully completed the Carbon Trust Standard verification process and demonstrated commitment to accurate carbon accounting and transparent reporting.</p>

          <div class="field">
            <div class="field-label">Certificate Number:</div>
            <div class="field-value"><span class="cert-number">${data.certificateNumber}</span></div>
          </div>

          <div class="field">
            <div class="field-label">Verification Scope:</div>
            <div class="field-value">${scopeLabels[data.scope]}</div>
          </div>

          <div class="field">
            <div class="field-label">Baseline Year:</div>
            <div class="field-value">${data.baselineYear}</div>
          </div>

          <div class="field">
            <div class="field-label">Verified Emissions (tCO2e):</div>
            <div class="field-value">${data.verifiedEmissions.toLocaleString("en-GB", { maximumFractionDigits: 2 })}</div>
          </div>

          <div class="field">
            <div class="field-label">Issued Date:</div>
            <div class="field-value">${issuedDateStr}</div>
          </div>

          <div class="field">
            <div class="field-label">Expiration Date:</div>
            <div class="field-value">${expiresDateStr}</div>
          </div>

          <div class="field">
            <div class="field-label">Auditor:</div>
            <div class="field-value">${data.auditorName}</div>
          </div>
        </div>

        <div class="verification-section">
          <strong>Verification Token:</strong><br />
          <code>${verificationToken}</code><br />
          <p style="margin: 10px 0 0 0;">
            This certificate can be independently verified at:
            <br />https://clearesg.local/verify/${verificationToken}
          </p>
        </div>

        <div class="footer">
          <p style="margin: 0; color: #999; font-size: 12px;">
            This certificate is valid for 3 years from the date of issue.
            <br />Renewal applications must be submitted 90 days before expiration.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  // For now, return placeholder implementation
  // In production, would use a proper PDF library or HTML-to-PDF service
  const pdfBytes = Buffer.from(htmlContent, "utf-8");

  return {
    pdfBytes,
    certificateNumber: data.certificateNumber,
    verificationToken,
  };
}

export function generateCertificateNumber(orgId: string, timestamp: Date): string {
  const year = timestamp.getFullYear();
  const month = String(timestamp.getMonth() + 1).padStart(2, "0");
  const random = crypto.randomBytes(4).toString("hex").substring(0, 4).toUpperCase();
  return `CT-${year}${month}-${random}`;
}

export function calculateExpirationDate(issuedDate: Date): Date {
  const expiration = new Date(issuedDate);
  expiration.setFullYear(expiration.getFullYear() + 3);
  return expiration;
}

export function isExpiringSoon(expiresDate: Date): boolean {
  const today = new Date();
  const ninetyDaysFromNow = new Date(today);
  ninetyDaysFromNow.setDate(ninetyDaysFromNow.getDate() + 90);
  return expiresDate <= ninetyDaysFromNow;
}
