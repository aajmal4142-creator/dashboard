import type { Invoice, Subscription, OverageCharge } from "./types";
import type { Payload } from "payload";

interface UsageAlert {
  metric: string;
  percentageUsed: number;
  threshold: number;
}

export class EmailService {
  private payload: Payload;
  private resendApiKey: string;
  private emailFrom: string;

  constructor(payload: Payload) {
    this.payload = payload;
    this.resendApiKey = process.env.RESEND_API_KEY || "";
    this.emailFrom = process.env.EMAIL_FROM || "noreply@clearesg.ai";

    if (!this.resendApiKey) {
      console.warn("RESEND_API_KEY not configured. Email sending will be disabled.");
    }
  }

  /**
   * Send invoice email with PDF attachment
   */
  async sendInvoiceEmail(
    invoice: Invoice,
    recipients: string[],
    pdfBuffer?: Buffer,
    invoiceNumber?: string,
  ): Promise<void> {
    try {
      const emailContent = this.generateInvoiceEmailHtml(invoice);

      await this.sendEmail({
        to: recipients,
        subject: `Your ClearESG Invoice ${invoice.invoiceNumber} is Ready`,
        html: emailContent.html,
        text: emailContent.text,
        attachments: pdfBuffer
          ? [
              {
                filename: `${invoiceNumber || invoice.invoiceNumber}.pdf`,
                content: pdfBuffer.toString("base64"),
                contentType: "application/pdf",
              },
            ]
          : undefined,
      });

      // Log to audit collection
      await this.logEmailEvent({
        type: "invoice_sent",
        organisationId: invoice.organisation,
        invoice: invoice.id,
        recipients,
        status: "sent",
        timestamp: new Date(),
      });
    } catch (error) {
      console.error("Error sending invoice email:", error);

      // Log failure
      await this.logEmailEvent({
        type: "invoice_sent",
        organisationId: invoice.organisation,
        invoice: invoice.id,
        recipients,
        status: "failed",
        error: String(error),
        timestamp: new Date(),
      });

      throw error;
    }
  }

  /**
   * Send usage alert when threshold reached (80% of quota)
   */
  async sendUsageAlert(
    subscription: Subscription,
    alert: UsageAlert,
    recipients: string[],
  ): Promise<void> {
    try {
      const emailContent = this.generateUsageAlertEmailHtml(alert);

      await this.sendEmail({
        to: recipients,
        subject: `⚠️ Usage Alert: ${alert.metric} at ${alert.percentageUsed}%`,
        html: emailContent.html,
        text: emailContent.text,
      });

      await this.logEmailEvent({
        type: "usage_alert",
        organisationId: subscription.organisation,
        subscription: subscription.id,
        recipients,
        status: "sent",
        metadata: { metric: alert.metric, usage: alert.percentageUsed },
        timestamp: new Date(),
      });
    } catch (error) {
      console.error("Error sending usage alert:", error);
      throw error;
    }
  }

  /**
   * Send overage notice when limits exceeded
   */
  async sendOverageNotice(
    subscription: Subscription,
    overages: OverageCharge[],
    recipients: string[],
  ): Promise<void> {
    try {
      const emailContent = this.generateOverageNoticeEmailHtml(overages);

      await this.sendEmail({
        to: recipients,
        subject: "Usage Overage Notice - Charges Applied",
        html: emailContent.html,
        text: emailContent.text,
      });

      await this.logEmailEvent({
        type: "overage_notice",
        organisationId: subscription.organisation,
        subscription: subscription.id,
        recipients,
        status: "sent",
        metadata: {
          overages: overages.length,
          totalCharge: overages.reduce((s, o) => s + o.amount, 0),
        },
        timestamp: new Date(),
      });
    } catch (error) {
      console.error("Error sending overage notice:", error);
      throw error;
    }
  }

  /**
   * Internal method to send email via Resend API
   */
  private async sendEmail(params: {
    to: string[];
    subject: string;
    html: string;
    text: string;
    attachments?: Array<{
      filename: string;
      content: string;
      contentType: string;
    }>;
  }): Promise<void> {
    if (!this.resendApiKey) {
      console.warn("Skipping email send - RESEND_API_KEY not configured");
      return;
    }

    let attempts = 0;
    const maxAttempts = 3;
    let lastError: Error | null = null;

    while (attempts < maxAttempts) {
      try {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.resendApiKey}`,
          },
          body: JSON.stringify({
            from: this.emailFrom,
            to: params.to,
            subject: params.subject,
            html: params.html,
            text: params.text,
            attachments: params.attachments,
          }),
        });

        if (!response.ok) {
          throw new Error(`Resend API error: ${response.statusText}`);
        }

        return;
      } catch (error) {
        lastError = error as Error;
        attempts++;

        if (attempts < maxAttempts) {
          // Exponential backoff: 1s, 2s, 4s
          const delayMs = Math.pow(2, attempts - 1) * 1000;
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }
    }

    throw new Error(
      `Failed to send email after ${maxAttempts} attempts: ${lastError?.message}`,
    );
  }

  /**
   * Log email events to audit trail
   */
  private async logEmailEvent(event: {
    type: string;
    organisationId: string;
    invoice?: string;
    subscription?: string;
    recipients: string[];
    status: "sent" | "failed" | "bounced";
    error?: string;
    metadata?: Record<string, unknown>;
    timestamp: Date;
  }): Promise<void> {
    try {
      await this.payload.create({
        collection: "audit-logs",
        data: {
          organisation: event.organisationId,
          action: `email_${event.type}`,
          entityType: event.invoice
            ? "invoice"
            : event.subscription
              ? "subscription"
              : "email",
          entityId: event.invoice || event.subscription || "unknown",
          after: {
            status: event.status,
            recipients: event.recipients,
            error: event.error,
            timestamp: event.timestamp.toISOString(),
            ...event.metadata,
          },
        },
        overrideAccess: true,
      });
    } catch (error) {
      console.error("Failed to log email event:", error);
      // Don't throw - logging failure shouldn't block email sending
    }
  }

  private generateInvoiceEmailHtml(invoice: Invoice): { html: string; text: string } {
    const total = invoice.amount.toFixed(2);

    const html = `
    <html>
      <head>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            color: #1a202c;
            line-height: 1.6;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            color: white;
            padding: 30px;
            border-radius: 8px;
            text-align: center;
            margin-bottom: 30px;
          }
          .header h1 {
            margin: 0;
            font-size: 24px;
          }
          .section {
            margin-bottom: 20px;
          }
          .section-title {
            font-weight: 600;
            color: #1a202c;
            margin-bottom: 12px;
          }
          .row {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid #e2e8f0;
          }
          .row.total {
            font-weight: 700;
            font-size: 18px;
            border-bottom: 2px solid #cbd5e0;
            padding: 12px 0;
            margin-top: 12px;
          }
          .cta {
            display: inline-block;
            background: #10b981;
            color: white;
            padding: 12px 24px;
            border-radius: 6px;
            text-decoration: none;
            margin: 20px 0;
            font-weight: 600;
          }
          .footer {
            border-top: 1px solid #e2e8f0;
            margin-top: 30px;
            padding-top: 20px;
            font-size: 12px;
            color: #718096;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✓ Invoice Ready</h1>
            <p style="margin: 8px 0 0 0; opacity: 0.9;">Your invoice has been generated and is attached to this email</p>
          </div>

          <div class="section">
            <div class="section-title">Invoice Details</div>
            <div class="row">
              <span>Invoice Number:</span>
              <strong>${invoice.invoiceNumber}</strong>
            </div>
            <div class="row">
              <span>Issue Date:</span>
              <strong>${new Date(invoice.issueDate).toLocaleDateString()}</strong>
            </div>
            <div class="row">
              <span>Due Date:</span>
              <strong>${new Date(invoice.dueDate).toLocaleDateString()}</strong>
            </div>
            <div class="row total">
              <span>Total Amount Due:</span>
              <strong>$${total}</strong>
            </div>
          </div>

          <div class="section">
            <p style="margin: 0 0 12px 0; color: #4a5568;">
              Your invoice for ${new Date(invoice.periodStart).toLocaleDateString()} to ${new Date(invoice.periodEnd).toLocaleDateString()} is ready.
            </p>
            <p style="margin: 0; color: #4a5568;">
              Please see the attached PDF for a detailed breakdown of charges and payment instructions.
            </p>
          </div>

          <a href="#" class="cta">View Invoice Portal</a>

          <div class="footer">
            <p style="margin: 0 0 12px 0;"><strong>Need help?</strong> Contact our support team at support@clearesg.ai</p>
            <p style="margin: 0;">ClearESG © 2026. All rights reserved. | <a href="#" style="color: #10b981;">Privacy Policy</a></p>
          </div>
        </div>
      </body>
    </html>
    `;

    const text = `
Your ClearESG Invoice is Ready

Invoice Number: ${invoice.invoiceNumber}
Issue Date: ${new Date(invoice.issueDate).toLocaleDateString()}
Due Date: ${new Date(invoice.dueDate).toLocaleDateString()}
Total Amount Due: $${total}

Billing Period: ${new Date(invoice.periodStart).toLocaleDateString()} to ${new Date(invoice.periodEnd).toLocaleDateString()}

Please see the attached PDF for a detailed breakdown of charges and payment instructions.

For questions, contact support@clearesg.ai
    `.trim();

    return { html, text };
  }

  private generateUsageAlertEmailHtml(alert: UsageAlert): { html: string; text: string } {
    const html = `
    <html>
      <head>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            color: #1a202c;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .alert-box {
            background: #fef3c7;
            border: 1px solid #fcd34d;
            border-radius: 6px;
            padding: 20px;
            margin-bottom: 20px;
          }
          .progress-bar {
            width: 100%;
            height: 16px;
            background: #e5e7eb;
            border-radius: 8px;
            overflow: hidden;
            margin: 12px 0;
          }
          .progress-fill {
            height: 100%;
            width: ${Math.min(alert.percentageUsed, 100)}%;
            background: linear-gradient(90deg, #fbbf24, #f59e0b);
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h2 style="color: #d97706;">⚠️ Usage Alert</h2>

          <div class="alert-box">
            <p style="margin: 0 0 12px 0;"><strong>You're using a lot of ${alert.metric}!</strong></p>
            <p style="margin: 0;">Current usage: <strong>${alert.percentageUsed}%</strong> of your monthly limit</p>
            <div class="progress-bar">
              <div class="progress-fill"></div>
            </div>
            <p style="margin: 12px 0 0 0; font-size: 14px; color: #92400e;">
              You have ${100 - alert.percentageUsed}% remaining before reaching your plan limit.
            </p>
          </div>

          <div style="background: #f9fafb; padding: 16px; border-radius: 6px; margin-bottom: 20px;">
            <p style="margin: 0 0 12px 0;"><strong>What happens next?</strong></p>
            <ul style="margin: 0; padding-left: 20px;">
              <li>If you exceed your limit, usage will be charged at our standard overage rate</li>
              <li>Consider upgrading your plan for higher limits and better rates</li>
              <li>Check your usage dashboard to see where you're consuming the most</li>
            </ul>
          </div>

          <p style="text-align: center;">
            <a href="#" style="color: #10b981; text-decoration: none; font-weight: 600;">View Usage Dashboard</a>
          </p>

          <p style="text-align: center; font-size: 12px; color: #718096; margin-top: 30px;">
            This is an automated alert. For questions, contact support@clearesg.ai
          </p>
        </div>
      </body>
    </html>
    `;

    const text = `
⚠️ Usage Alert

You're using a lot of ${alert.metric}!
Current usage: ${alert.percentageUsed}% of your monthly limit
Remaining: ${100 - alert.percentageUsed}%

If you exceed your limit, usage will be charged at our standard overage rate. Consider upgrading your plan for higher limits and better rates.

View your usage dashboard for more details.

For questions, contact support@clearesg.ai
    `.trim();

    return { html, text };
  }

  private generateOverageNoticeEmailHtml(overages: OverageCharge[]): {
    html: string;
    text: string;
  } {
    const totalCharge = overages.reduce((sum, o) => sum + o.amount, 0);

    const overageRows = overages
      .map(
        (charge) => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${charge.metric}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">${charge.units} units</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">$${charge.amount.toFixed(2)}</td>
      </tr>
    `,
      )
      .join("");

    const html = `
    <html>
      <head>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            color: #1a202c;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
          }
          th {
            background: #f3f4f6;
            padding: 12px;
            text-align: left;
            font-weight: 600;
            border-bottom: 2px solid #d1d5db;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h2 style="color: #1a202c;">Usage Overage Notice</h2>

          <p style="color: #4a5568; line-height: 1.6;">
            Your organization exceeded its plan limits this billing period. The following overage charges will be applied to your invoice:
          </p>

          <table>
            <thead>
              <tr>
                <th>Metric</th>
                <th style="text-align: right;">Usage</th>
                <th style="text-align: right;">Charge</th>
              </tr>
            </thead>
            <tbody>
              ${overageRows}
            </tbody>
          </table>

          <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 6px; padding: 16px; margin: 20px 0;">
            <p style="margin: 0;"><strong>Total Overage Charges: $${totalCharge.toFixed(2)}</strong></p>
            <p style="margin: 12px 0 0 0; font-size: 14px; color: #166534;">These charges will appear on your next invoice.</p>
          </div>

          <div style="background: #f9fafb; padding: 16px; border-radius: 6px; margin-bottom: 20px;">
            <p style="margin: 0 0 12px 0;"><strong>Reduce Overages:</strong></p>
            <ul style="margin: 0; padding-left: 20px;">
              <li>Upgrade to a higher tier plan</li>
              <li>Optimize your data usage patterns</li>
              <li>Review your billing settings</li>
            </ul>
          </div>

          <p style="text-align: center;">
            <a href="#" style="display: inline-block; background: #10b981; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">View Billing Details</a>
          </p>

          <p style="text-align: center; font-size: 12px; color: #718096; margin-top: 30px;">
            For questions about overages, contact support@clearesg.ai
          </p>
        </div>
      </body>
    </html>
    `;

    const text = `
Usage Overage Notice

Your organization exceeded its plan limits this billing period. The following overage charges will be applied to your invoice:

${overages.map((o) => `${o.metric}: ${o.units} units = $${o.amount.toFixed(2)}`).join("\n")}

Total Overage Charges: $${totalCharge.toFixed(2)}

These charges will appear on your next invoice.

To reduce overages, consider upgrading your plan or optimizing your usage.

For questions, contact support@clearesg.ai
    `.trim();

    return { html, text };
  }
}

export function createEmailService(payload: Payload): EmailService {
  return new EmailService(payload);
}
