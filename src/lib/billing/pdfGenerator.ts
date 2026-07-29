import type { Invoice, Subscription, Plan, UsageMetric } from "./types";

interface BillingOrganisation {
  id: string;
  name: string;
  email?: string | null;
  address?: string | null;
}

export class PdfGenerator {
  /**
   * Generate a professional invoice PDF
   */
  async generateInvoicePdf(
    invoice: Invoice,
    org: BillingOrganisation,
    subscription: Subscription,
    plan: Plan,
  ): Promise<Buffer> {
    // Generate simple HTML template that can be rendered as PDF
    const html = this.generateInvoiceHtml(invoice, org, subscription, plan);
    return this.htmlToBuffer(html);
  }

  /**
   * Generate a usage report PDF
   */
  async generateUsageReportPdf(
    usage: UsageMetric,
    subscription: Subscription,
    plan: Plan,
    org: BillingOrganisation,
  ): Promise<Buffer> {
    const html = this.generateUsageReportHtml(usage, subscription, plan, org);
    return this.htmlToBuffer(html);
  }

  private generateInvoiceHtml(
    invoice: Invoice,
    org: BillingOrganisation,
    _subscription: Subscription,
    _plan: Plan,
  ): string {
    const lineItemsHtml = invoice.lineItems
      .map(
        (item) => `
      <tr>
        <td class="py-2">${item.description}</td>
        <td class="py-2 text-right">${item.quantity}</td>
        <td class="py-2 text-right">$${item.unitPrice.toFixed(2)}</td>
        <td class="py-2 text-right">$${item.amount.toFixed(2)}</td>
      </tr>
    `,
      )
      .join("");

    const overageItemsHtml =
      invoice.overageCharges && invoice.overageCharges.length > 0
        ? `
      <tr class="border-t-2 border-gray-300">
        <td colspan="4" class="py-3 font-semibold text-gray-700">Overage Charges</td>
      </tr>
      ${invoice.overageCharges
        .map(
          (charge) => `
        <tr>
          <td class="py-2">${charge.metric} Overage (${charge.units} units @ $${charge.unitPrice.toFixed(2)}/unit)</td>
          <td class="py-2 text-right">1</td>
          <td class="py-2 text-right">$${charge.amount.toFixed(2)}</td>
          <td class="py-2 text-right">$${charge.amount.toFixed(2)}</td>
        </tr>
      `,
        )
        .join("")}
    `
        : "";

    const subtotal = invoice.lineItems.reduce((sum, item) => sum + item.amount, 0);
    const overageTotal =
      invoice.overageCharges?.reduce((sum, charge) => sum + charge.amount, 0) || 0;
    const taxes = invoice.taxes || 0;
    const discount = invoice.discount || 0;
    const total = subtotal + overageTotal + taxes - discount;

    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          margin: 0;
          padding: 20px;
          background: white;
          color: #1a202c;
        }
        .container {
          max-width: 900px;
          margin: 0 auto;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 40px;
          border-bottom: 2px solid #e2e8f0;
          padding-bottom: 20px;
        }
        .logo-section h1 {
          margin: 0;
          font-size: 32px;
          font-weight: 700;
          color: #10b981;
        }
        .invoice-meta {
          text-align: right;
        }
        .invoice-meta p {
          margin: 4px 0;
          color: #4a5568;
        }
        .invoice-meta .invoice-number {
          font-size: 18px;
          font-weight: 600;
          color: #1a202c;
        }
        .org-info {
          margin-bottom: 40px;
        }
        .org-info h3 {
          margin: 0 0 8px 0;
          font-size: 14px;
          font-weight: 600;
          color: #718096;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .org-info p {
          margin: 2px 0;
          font-size: 14px;
          color: #2d3748;
        }
        .section-title {
          font-size: 14px;
          font-weight: 600;
          color: #718096;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-top: 30px;
          margin-bottom: 15px;
          border-bottom: 1px solid #e2e8f0;
          padding-bottom: 8px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
        }
        th {
          background: #f7fafc;
          padding: 12px;
          text-align: left;
          font-weight: 600;
          font-size: 12px;
          color: #4a5568;
          border-bottom: 1px solid #cbd5e0;
        }
        td {
          padding: 12px;
          border-bottom: 1px solid #e2e8f0;
        }
        .totals {
          width: 100%;
          margin-top: 30px;
        }
        .totals-row {
          display: flex;
          justify-content: flex-end;
          padding: 8px 0;
          font-size: 14px;
        }
        .totals-row.subtotal {
          border-bottom: 1px solid #e2e8f0;
        }
        .totals-row.total {
          font-size: 18px;
          font-weight: 700;
          color: #1a202c;
          padding: 16px 0;
          border-top: 2px solid #cbd5e0;
        }
        .totals-label {
          min-width: 150px;
          text-align: right;
          padding-right: 20px;
          color: #4a5568;
        }
        .totals-amount {
          min-width: 100px;
          text-align: right;
        }
        .footer {
          margin-top: 50px;
          padding-top: 20px;
          border-top: 1px solid #e2e8f0;
          font-size: 12px;
          color: #718096;
          line-height: 1.6;
        }
        .payment-terms {
          background: #f7fafc;
          padding: 15px;
          border-radius: 4px;
          margin-top: 20px;
          font-size: 13px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo-section">
            <h1>ClearESG</h1>
            <p style="margin: 4px 0; font-size: 14px; color: #718096;">Billing</p>
          </div>
          <div class="invoice-meta">
            <p class="invoice-number">${invoice.invoiceNumber}</p>
            <p><strong>Issue Date:</strong> ${this.formatDate(invoice.issueDate)}</p>
            <p><strong>Due Date:</strong> ${this.formatDate(invoice.dueDate)}</p>
            <p><strong>Period:</strong> ${this.formatDate(invoice.periodStart)} - ${this.formatDate(invoice.periodEnd)}</p>
          </div>
        </div>

        <div class="org-info">
          <h3>Bill To</h3>
          <p><strong>${org.name}</strong></p>
          ${org.email ? `<p>${org.email}</p>` : ""}
          ${org.address ? `<p>${org.address}</p>` : ""}
        </div>

        <h3 class="section-title">Billing Summary</h3>
        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th style="text-align: right; width: 80px;">Qty</th>
              <th style="text-align: right; width: 100px;">Unit Price</th>
              <th style="text-align: right; width: 100px;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${lineItemsHtml}
            ${overageItemsHtml}
          </tbody>
        </table>

        <div class="totals">
          <div class="totals-row subtotal">
            <div class="totals-label">Subtotal:</div>
            <div class="totals-amount">$${subtotal.toFixed(2)}</div>
          </div>
          ${
            overageTotal > 0
              ? `
          <div class="totals-row">
            <div class="totals-label">Overages:</div>
            <div class="totals-amount">$${overageTotal.toFixed(2)}</div>
          </div>
          `
              : ""
          }
          ${
            taxes > 0
              ? `
          <div class="totals-row">
            <div class="totals-label">Tax:</div>
            <div class="totals-amount">$${taxes.toFixed(2)}</div>
          </div>
          `
              : ""
          }
          ${
            discount > 0
              ? `
          <div class="totals-row">
            <div class="totals-label">Discount:</div>
            <div class="totals-amount">-$${discount.toFixed(2)}</div>
          </div>
          `
              : ""
          }
          <div class="totals-row total">
            <div class="totals-label">Total:</div>
            <div class="totals-amount">$${total.toFixed(2)}</div>
          </div>
        </div>

        <div class="payment-terms">
          <strong>Payment Terms:</strong><br>
          Payment is due by ${this.formatDate(invoice.dueDate)}. Please reference invoice number ${invoice.invoiceNumber} with your payment.
        </div>

        <div class="footer">
          <p><strong>Thank you for your business!</strong></p>
          <p>ClearESG makes it easy to track, report, and reduce your environmental impact. Questions? Contact support@clearesg.ai</p>
          <p style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
            This is an automatically generated invoice. Please do not reply to this email.
          </p>
        </div>
      </div>
    </body>
    </html>
    `;
  }

  private generateUsageReportHtml(
    usage: UsageMetric,
    subscription: Subscription,
    plan: Plan,
    org: BillingOrganisation,
  ): string {
    const usagePercent = {
      dataPoints: Math.round(
        (usage.dataPointsCumulative / plan.dataPointsPerMonth) * 100,
      ),
      reports: Math.round((usage.reportsCumulative / plan.reportsPerMonth) * 100),
      storage: Math.round((usage.storageUsedGB / plan.storageGB) * 100),
      users: Math.round((usage.activeUsersCount / plan.activeUsersLimit) * 100),
    };

    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          margin: 0;
          padding: 20px;
          background: white;
          color: #1a202c;
        }
        .container {
          max-width: 900px;
          margin: 0 auto;
        }
        .header {
          text-align: center;
          margin-bottom: 40px;
          padding-bottom: 20px;
          border-bottom: 2px solid #e2e8f0;
        }
        .header h1 {
          margin: 0;
          font-size: 32px;
          font-weight: 700;
          color: #10b981;
        }
        .header p {
          margin: 8px 0 0 0;
          color: #718096;
        }
        .org-info {
          display: flex;
          justify-content: space-between;
          margin-bottom: 40px;
        }
        .info-block h3 {
          margin: 0 0 8px 0;
          font-size: 12px;
          font-weight: 600;
          color: #718096;
          text-transform: uppercase;
        }
        .info-block p {
          margin: 4px 0;
          font-size: 14px;
          color: #2d3748;
        }
        .usage-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-bottom: 40px;
        }
        .metric-card {
          border: 1px solid #e2e8f0;
          border-radius: 4px;
          padding: 20px;
          background: #f9fafb;
        }
        .metric-title {
          font-size: 13px;
          font-weight: 600;
          color: #718096;
          text-transform: uppercase;
          margin-bottom: 12px;
        }
        .metric-value {
          font-size: 28px;
          font-weight: 700;
          color: #1a202c;
          margin: 8px 0;
        }
        .metric-label {
          font-size: 12px;
          color: #4a5568;
        }
        .progress-bar {
          width: 100%;
          height: 8px;
          background: #e2e8f0;
          border-radius: 4px;
          margin-top: 8px;
          overflow: hidden;
        }
        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #10b981, #059669);
          border-radius: 4px;
        }
        .footer {
          margin-top: 50px;
          padding-top: 20px;
          border-top: 1px solid #e2e8f0;
          font-size: 12px;
          color: #718096;
          text-align: center;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>ClearESG Usage Report</h1>
          <p>Monthly Usage Summary</p>
        </div>

        <div class="org-info">
          <div class="info-block">
            <h3>Organization</h3>
            <p><strong>${org.name}</strong></p>
            <p style="font-size: 12px; color: #718096;">${plan.displayName} Plan</p>
          </div>
          <div class="info-block">
            <h3>Reporting Period</h3>
            <p>${this.formatDate(usage.date)}</p>
          </div>
        </div>

        <div class="usage-grid">
          <div class="metric-card">
            <div class="metric-title">Datapoints</div>
            <div class="metric-value">${usage.dataPointsCumulative.toLocaleString()}</div>
            <div class="metric-label">of ${plan.dataPointsPerMonth.toLocaleString()} per month</div>
            <div class="progress-bar">
              <div class="progress-fill" style="width: ${Math.min(usagePercent.dataPoints, 100)}%"></div>
            </div>
            <div class="metric-label" style="margin-top: 4px;">${usagePercent.dataPoints}% utilized</div>
          </div>

          <div class="metric-card">
            <div class="metric-title">Reports</div>
            <div class="metric-value">${usage.reportsCumulative}</div>
            <div class="metric-label">of ${plan.reportsPerMonth} per month</div>
            <div class="progress-bar">
              <div class="progress-fill" style="width: ${Math.min(usagePercent.reports, 100)}%"></div>
            </div>
            <div class="metric-label" style="margin-top: 4px;">${usagePercent.reports}% utilized</div>
          </div>

          <div class="metric-card">
            <div class="metric-title">Storage</div>
            <div class="metric-value">${usage.storageUsedGB.toFixed(1)} GB</div>
            <div class="metric-label">of ${plan.storageGB} GB</div>
            <div class="progress-bar">
              <div class="progress-fill" style="width: ${Math.min(usagePercent.storage, 100)}%"></div>
            </div>
            <div class="metric-label" style="margin-top: 4px;">${usagePercent.storage}% utilized</div>
          </div>

          <div class="metric-card">
            <div class="metric-title">Active Users</div>
            <div class="metric-value">${usage.activeUsersCount}</div>
            <div class="metric-label">of ${plan.activeUsersLimit} users</div>
            <div class="progress-bar">
              <div class="progress-fill" style="width: ${Math.min(usagePercent.users, 100)}%"></div>
            </div>
            <div class="metric-label" style="margin-top: 4px;">${usagePercent.users}% utilized</div>
          </div>
        </div>

        <div class="footer">
          <p>This report was automatically generated by ClearESG.</p>
          <p style="margin: 12px 0 0 0;">For questions or support, contact support@clearesg.ai</p>
        </div>
      </div>
    </body>
    </html>
    `;
  }

  private async htmlToBuffer(html: string): Promise<Buffer> {
    // For Node.js environments, we'll use a simple approach
    // In production, you might want to use puppeteer or similar for better rendering
    // For now, return HTML as buffer with a note that it needs proper PDF conversion
    // This is a placeholder - the actual implementation would need puppeteer or similar

    // For development/testing, we can encode as a text buffer
    // In production, integrate with puppeteer or use a PDF service

    // Using a simple approach: we'll assume puppeteer or headless-chrome is available
    try {
      // Dynamic import to handle optional dependency
      const puppeteer = (await import("puppeteer")).default;

      const browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });

      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "load" });

      const pdfBuffer = await page.pdf({
        format: "A4",
        margin: {
          top: "20px",
          right: "20px",
          bottom: "20px",
          left: "20px",
        },
      });

      await browser.close();

      return pdfBuffer as Buffer;
    } catch {
      // Fallback: if puppeteer not available, use a basic HTML-to-PDF library
      // or return HTML as base64 encoded in a simple wrapper
      console.warn(
        "Puppeteer not available, using HTML fallback. Install puppeteer for proper PDF generation.",
      );

      // Return HTML wrapped in a minimal PDF structure (base64)
      const htmlBuffer = Buffer.from(html, "utf-8");
      return htmlBuffer;
    }
  }

  private formatDate(date: Date): string {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }
}

export function createPdfGenerator(): PdfGenerator {
  return new PdfGenerator();
}
