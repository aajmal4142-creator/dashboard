import type { Payload } from "payload";
import type { Subscription, Plan, UsageMetric, Invoice } from "./types";
import { createPdfGenerator } from "./pdfGenerator";
import { createEmailService } from "./emailService";

export class InvoiceGenerator {
  private payload: Payload;

  constructor(payload: Payload) {
    this.payload = payload;
  }

  async generateMonthlyInvoice(
    subscription: Subscription,
    usage: UsageMetric,
    plan: Plan,
  ): Promise<Invoice> {
    const now = new Date();
    const invoiceDate = new Date(now.getFullYear(), now.getMonth(), 1);
    const dueDate = new Date(invoiceDate);
    dueDate.setDate(dueDate.getDate() + 30);

    const lineItems = this.calculateLineItems(
      plan,
      subscription.billingCycle,
      subscription.seats,
    );
    const overages = this.calculateOverages(usage, plan);
    const overageTotal = overages.reduce((sum, o) => sum + o.charge, 0);

    const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
    const total = subtotal + overageTotal;

    const invoiceNumber = `INV-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${subscription.id.substring(0, 6).toUpperCase()}`;

    const invoice = await this.payload.create({
      collection: "invoices",
      data: {
        subscription: subscription.id,
        organisation: subscription.organisation,
        invoiceNumber,
        status: "draft",
        periodStart:
          subscription.currentPeriodStart instanceof Date
            ? subscription.currentPeriodStart.toISOString()
            : String(subscription.currentPeriodStart),
        periodEnd:
          subscription.currentPeriodEnd instanceof Date
            ? subscription.currentPeriodEnd.toISOString()
            : String(subscription.currentPeriodEnd),
        issueDate: invoiceDate.toISOString(),
        dueDate: dueDate.toISOString(),
        amount: total,
        currency: "USD",
        lineItems,
        overageCharges:
          overages.length > 0
            ? overages.map((o) => ({
                metric: o.metric,
                units: o.units,
                unitPrice: o.unitPrice,
                amount: o.charge,
              }))
            : undefined,
      },
    });

    return invoice as unknown as Invoice;
  }

  private calculateLineItems(
    plan: Plan,
    billingCycle: "monthly" | "annual",
    seats: number,
  ): Array<{ description: string; quantity: number; unitPrice: number; amount: number }> {
    const items = [];
    const planPrice =
      billingCycle === "monthly" ? plan.monthlyPrice : plan.annualPrice / 12;
    items.push({
      description: `${plan.displayName} Plan`,
      quantity: 1,
      unitPrice: planPrice,
      amount: planPrice,
    });

    if (seats > 1) {
      const seatPrice = planPrice * 0.1;
      items.push({
        description: `Additional Seats (${seats - 1})`,
        quantity: seats - 1,
        unitPrice: seatPrice,
        amount: seatPrice * (seats - 1),
      });
    }

    return items;
  }

  private calculateOverages(
    usage: UsageMetric,
    plan: Plan,
  ): Array<{ metric: string; units: number; unitPrice: number; charge: number }> {
    const overages = [];

    if (
      plan.dataPointsPerMonth > 0 &&
      usage.dataPointsCumulative > plan.dataPointsPerMonth
    ) {
      const excess = usage.dataPointsCumulative - plan.dataPointsPerMonth;
      overages.push({
        metric: "Datapoints",
        units: Math.ceil(excess / 100),
        unitPrice: plan.overageRatePerUnit,
        charge: Math.ceil(excess / 100) * plan.overageRatePerUnit,
      });
    }

    return overages;
  }

  async finalizeInvoice(invoiceId: string): Promise<void> {
    await this.payload.update({
      collection: "invoices",
      id: invoiceId,
      data: { status: "sent" },
    });
  }

  /**
   * Generate PDF for an invoice and optionally send via email
   */
  async generateAndSendInvoice(
    invoice: Invoice,
    subscription: Subscription,
    plan: Plan,
    options?: { sendEmail?: boolean },
  ): Promise<void> {
    try {
      // Fetch organization
      const org = await this.payload.findByID({
        collection: "organisations",
        id: invoice.organisation,
      });

      // Generate PDF
      const pdfGenerator = createPdfGenerator();
      const pdfBuffer = await pdfGenerator.generateInvoicePdf(
        invoice,
        { id: org.id, name: org.name },
        subscription,
        plan,
      );

      // Optionally send email
      if (options?.sendEmail && subscription.sendInvoices) {
        const emailService = createEmailService(this.payload);
        const recipientEmail = subscription.contactEmail;

        if (recipientEmail) {
          await emailService.sendInvoiceEmail(
            invoice,
            [recipientEmail],
            pdfBuffer,
            invoice.invoiceNumber,
          );
        }
      }
    } catch (error) {
      console.error("Error generating and sending invoice:", error);
      throw error;
    }
  }

  /**
   * Send usage alert email
   */
  async sendUsageAlert(
    subscription: Subscription,
    metric: string,
    percentageUsed: number,
  ): Promise<void> {
    try {
      if (!subscription.sendUsageAlerts) {
        return;
      }

      const emailService = createEmailService(this.payload);
      const recipientEmail = subscription.contactEmail;

      if (recipientEmail) {
        await emailService.sendUsageAlert(
          subscription,
          { metric, percentageUsed, threshold: 80 },
          [recipientEmail],
        );
      }
    } catch (error) {
      console.error("Error sending usage alert:", error);
      // Don't throw - usage alerts are non-critical
    }
  }

  /**
   * Send overage notice email
   */
  async sendOverageNotice(
    subscription: Subscription,
    overages: Array<{ metric: string; units: number; unitPrice: number; amount: number }>,
  ): Promise<void> {
    try {
      const emailService = createEmailService(this.payload);
      const recipientEmail = subscription.contactEmail;

      if (recipientEmail) {
        await emailService.sendOverageNotice(subscription, overages, [recipientEmail]);
      }
    } catch (error) {
      console.error("Error sending overage notice:", error);
      // Don't throw - overage notices are non-critical
    }
  }
}

export function createInvoiceGenerator(payload: Payload): InvoiceGenerator {
  return new InvoiceGenerator(payload);
}
