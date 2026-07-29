import type { Payload } from "payload";
import type { Subscription, Plan, UsageMetric, Invoice } from "./types";

export class InvoiceGenerator {
  private payload: Payload;

  constructor(payload: Payload) {
    this.payload = payload;
  }

  async generateMonthlyInvoice(
    subscription: Subscription,
    usage: UsageMetric,
    plan: Plan
  ): Promise<Invoice> {
    const now = new Date();
    const invoiceDate = new Date(now.getFullYear(), now.getMonth(), 1);
    const dueDate = new Date(invoiceDate);
    dueDate.setDate(dueDate.getDate() + 30);

    const lineItems = this.calculateLineItems(plan, subscription.billingCycle, subscription.seats);
    const overages = this.calculateOverages(usage, plan);
    const overageTotal = overages.reduce((sum, o) => sum + o.charge, 0);

    const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
    const total = subtotal + overageTotal;

    const invoiceNumber = `INV-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${subscription.id.substring(0, 6).toUpperCase()}`;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const invoice = await this.payload.create({
      collection: "invoices" as any,
      data: {
        subscription: subscription.id,
        organisation: subscription.organisation,
        invoiceNumber,
        status: "draft",
        periodStart: subscription.currentPeriodStart,
        periodEnd: subscription.currentPeriodEnd,
        issueDate: invoiceDate,
        dueDate,
        amount: total,
        currency: "USD",
        lineItems,
        overageCharges: overages.length > 0 ? overages : undefined,
      },
    });

    return invoice as Invoice;
  }

  private calculateLineItems(
    plan: Plan,
    billingCycle: "monthly" | "annual",
    seats: number
  ): Array<{ description: string; quantity: number; unitPrice: number; amount: number }> {
    const items = [];
    const planPrice = billingCycle === "monthly" ? plan.monthlyPrice : plan.annualPrice / 12;
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

  private calculateOverages(usage: UsageMetric, plan: Plan): Array<{metric: string; units: number; unitPrice: number; charge: number}> {
    const overages = [];

    if (plan.dataPointsPerMonth > 0 && usage.dataPointsCumulative > plan.dataPointsPerMonth) {
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await this.payload.update({
      collection: "invoices" as any,
      id: invoiceId,
      data: { status: "sent" },
    });
  }
}

export function createInvoiceGenerator(payload: Payload): InvoiceGenerator {
  return new InvoiceGenerator(payload);
}
