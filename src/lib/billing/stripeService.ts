import type Stripe from "stripe";
import type { Payload } from "payload";
import type {
  Plan,
  BillingCycle,
  Subscription,
  Invoice,
  PaymentRecord,
} from "./types";
import { getStripe } from "./stripe";

export class StripeService {
  private payload: Payload;
  private stripe: Stripe;

  constructor(payload: Payload) {
    this.payload = payload;
    this.stripe = getStripe();
  }

  /**
   * Create a Stripe customer for an organisation
   */
  async createCustomer(organisation: {
    id: string;
    name: string;
    email?: string;
  }): Promise<string> {
    try {
      const customer = await this.stripe.customers.create({
        name: organisation.name,
        email: organisation.email || `org-${organisation.id}@clearecs.ai`,
        metadata: {
          organisationId: organisation.id,
        },
      });

      // Update organisation with Stripe customer ID
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await this.payload.update({
        collection: "organisations" as any,
        id: organisation.id,
        data: {
          stripeCustomerId: customer.id,
        },
        overrideAccess: true,
      });

      return customer.id;
    } catch (error) {
      console.error("Error creating Stripe customer:", error);
      throw error;
    }
  }

  /**
   * Create a subscription in Stripe
   */
  async createSubscription(
    customerId: string,
    plan: Plan,
    billingCycle: BillingCycle,
  ): Promise<string> {
    try {
      const priceId =
        billingCycle === "annual"
          ? this.getAnnualPriceId(plan.name)
          : this.getMonthlyPriceId(plan.name);

      if (!priceId) {
        throw new Error(`No Stripe price ID found for plan ${plan.name}`);
      }

      const subscription = await this.stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: priceId }],
        metadata: {
          planName: plan.name,
          billingCycle,
        },
        expand: ["latest_invoice.payment_intent"],
      });

      return subscription.id;
    } catch (error) {
      console.error("Error creating Stripe subscription:", error);
      throw error;
    }
  }

  /**
   * Update an existing subscription
   */
  async updateSubscription(
    subscriptionId: string,
    updates: {
      items?: Array<{ price: string }>;
      billingCycle?: BillingCycle;
      metadata?: Record<string, string>;
    },
  ): Promise<void> {
    try {
      const updateData: Parameters<typeof this.stripe.subscriptions.update>[1] = {};

      if (updates.items) {
        updateData.items = updates.items as any;
      }

      if (updates.metadata) {
        updateData.metadata = updates.metadata;
      }

      await this.stripe.subscriptions.update(subscriptionId, updateData);
    } catch (error) {
      console.error("Error updating Stripe subscription:", error);
      throw error;
    }
  }

  /**
   * Cancel a subscription
   */
  async cancelSubscription(subscriptionId: string): Promise<void> {
    try {
      await this.stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
      });
    } catch (error) {
      console.error("Error canceling Stripe subscription:", error);
      throw error;
    }
  }

  /**
   * Create an invoice in Stripe (for manual invoicing, e.g., overages)
   */
  async createInvoice(
    customerId: string,
    lineItems: Array<{
      description: string;
      quantity: number;
      unitPrice: number;
    }>,
  ): Promise<string> {
    try {
      // Create invoice items
      for (const item of lineItems) {
        await this.stripe.invoiceItems.create({
          customer: customerId,
          description: item.description,
          amount: Math.round(item.unitPrice * item.quantity * 100), // Stripe uses cents
        } as any); // eslint-disable-line @typescript-eslint/no-explicit-any
      }

      // Create and finalize the invoice
      const invoice = await this.stripe.invoices.create({
        customer: customerId,
        collection_method: "send_invoice",
        days_until_due: 30,
      });

      await this.stripe.invoices.finalizeInvoice(invoice.id);

      return invoice.id;
    } catch (error) {
      console.error("Error creating Stripe invoice:", error);
      throw error;
    }
  }

  /**
   * Process a Stripe webhook event and sync to Payload
   */
  async handleWebhookEvent(event: Stripe.Event): Promise<void> {
    try {
      switch (event.type) {
        case "charge.succeeded":
          await this.handleChargeSucceeded(
            event.data.object as Stripe.Charge,
          );
          break;

        case "charge.failed":
          await this.handleChargeFailed(event.data.object as Stripe.Charge);
          break;

        case "charge.refunded":
          await this.handleChargeRefunded(
            event.data.object as Stripe.Charge,
          );
          break;

        case "customer.subscription.updated":
          await this.handleSubscriptionUpdated(
            event.data.object as Stripe.Subscription,
          );
          break;

        case "customer.subscription.deleted":
          await this.handleSubscriptionDeleted(
            event.data.object as Stripe.Subscription,
          );
          break;

        case "invoice.payment_succeeded":
          await this.handleInvoicePaymentSucceeded(
            event.data.object as Stripe.Invoice,
          );
          break;

        case "invoice.payment_failed":
          await this.handleInvoicePaymentFailed(
            event.data.object as Stripe.Invoice,
          );
          break;

        default:
          console.log(`Unhandled Stripe event type: ${event.type}`);
      }
    } catch (error) {
      console.error("Error handling Stripe webhook event:", error);
      throw error;
    }
  }

  /**
   * Private: Handle charge.succeeded event
   */
  private async handleChargeSucceeded(charge: Stripe.Charge): Promise<void> {
    if (!charge.customer) return;

    const customerId =
      typeof charge.customer === "string"
        ? charge.customer
        : charge.customer.id;

    const organisationId = await this.getOrganisationIdFromCustomer(
      customerId,
    );
    if (!organisationId) return;

    // Get subscription for this organisation
    const subscription = await this.getSubscriptionForOrg(organisationId);
    if (!subscription) return;

    // Create payment record
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await this.payload.create({
      collection: "payment-history" as any,
      data: {
        subscription: subscription.id,
        organisation: organisationId,
        amount: charge.amount / 100, // Convert from cents
        currency: "USD",
        status: "success",
        paymentMethod: "stripe",
        transactionId: charge.id,
        stripeChargeId: charge.id,
        paidAt: new Date(charge.created * 1000),
      },
      overrideAccess: true,
    });
  }

  /**
   * Private: Handle charge.failed event
   */
  private async handleChargeFailed(charge: Stripe.Charge): Promise<void> {
    if (!charge.customer) return;

    const customerId =
      typeof charge.customer === "string"
        ? charge.customer
        : charge.customer.id;

    const organisationId = await this.getOrganisationIdFromCustomer(
      customerId,
    );
    if (!organisationId) return;

    // Get subscription for this organisation
    const subscription = await this.getSubscriptionForOrg(organisationId);
    if (!subscription) return;

    // Create failed payment record
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await this.payload.create({
      collection: "payment-history" as any,
      data: {
        subscription: subscription.id,
        organisation: organisationId,
        amount: charge.amount / 100,
        currency: "USD",
        status: "failed",
        paymentMethod: "stripe",
        transactionId: charge.id,
        stripeChargeId: charge.id,
        paidAt: new Date(charge.created * 1000),
        failureReason: charge.failure_message || "Unknown error",
      },
      overrideAccess: true,
    });

    // Update subscription status to past_due if it's not already
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await this.payload.update({
      collection: "subscriptions" as any,
      id: subscription.id,
      data: {
        status: "past_due",
      },
      overrideAccess: true,
    });
  }

  /**
   * Private: Handle charge.refunded event
   */
  private async handleChargeRefunded(charge: Stripe.Charge): Promise<void> {
    if (!charge.customer) return;

    const customerId =
      typeof charge.customer === "string"
        ? charge.customer
        : charge.customer.id;

    const organisationId = await this.getOrganisationIdFromCustomer(
      customerId,
    );
    if (!organisationId) return;

    // Get subscription for this organisation
    const subscription = await this.getSubscriptionForOrg(organisationId);
    if (!subscription) return;

    // Find the original payment and create refund record
    const refundAmounts = charge.refunds?.data || [];
    for (const refund of refundAmounts) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await this.payload.create({
        collection: "payment-history" as any,
        data: {
          subscription: subscription.id,
          organisation: organisationId,
          amount: refund.amount / 100,
          currency: "USD",
          status: "refunded",
          paymentMethod: "stripe",
          transactionId: refund.id,
          stripeChargeId: charge.id,
          paidAt: new Date(refund.created * 1000),
          refundReason: refund.reason || "Unknown reason",
        },
        overrideAccess: true,
      });
    }
  }

  /**
   * Private: Handle customer.subscription.updated event
   */
  private async handleSubscriptionUpdated(
    stripeSubscription: Stripe.Subscription,
  ): Promise<void> {
    const customerId =
      typeof stripeSubscription.customer === "string"
        ? stripeSubscription.customer
        : stripeSubscription.customer.id;

    const organisationId = await this.getOrganisationIdFromCustomer(
      customerId,
    );
    if (!organisationId) return;

    // Get or create subscription record
    const subscription = await this.getSubscriptionForOrg(organisationId);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stripeSubAny = stripeSubscription as any;
    const subscriptionData = {
      organisation: organisationId,
      stripeSubscriptionId: stripeSubscription.id,
      stripeCustomerId: customerId,
      status: this.mapStripeSubStatus(stripeSubscription.status),
      currentPeriodStart: new Date(
        stripeSubAny.current_period_start * 1000,
      ),
      currentPeriodEnd: new Date(stripeSubAny.current_period_end * 1000),
      autoRenew: !stripeSubAny.cancel_at_period_end,
    };

    if (subscription) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await this.payload.update({
        collection: "subscriptions" as any,
        id: subscription.id,
        data: subscriptionData,
        overrideAccess: true,
      });
    }
  }

  /**
   * Private: Handle customer.subscription.deleted event
   */
  private async handleSubscriptionDeleted(
    stripeSubscription: Stripe.Subscription,
  ): Promise<void> {
    const customerId =
      typeof stripeSubscription.customer === "string"
        ? stripeSubscription.customer
        : stripeSubscription.customer.id;

    const organisationId = await this.getOrganisationIdFromCustomer(
      customerId,
    );
    if (!organisationId) return;

    const subscription = await this.getSubscriptionForOrg(organisationId);
    if (!subscription) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await this.payload.update({
      collection: "subscriptions" as any,
      id: subscription.id,
      data: {
        status: "canceled",
        cancelledAt: new Date(),
      },
      overrideAccess: true,
    });
  }

  /**
   * Private: Handle invoice.payment_succeeded event
   */
  private async handleInvoicePaymentSucceeded(
    invoice: Stripe.Invoice,
  ): Promise<void> {
    if (!invoice.customer) return;

    const customerId =
      typeof invoice.customer === "string" ? invoice.customer : invoice.customer.id;

    const organisationId = await this.getOrganisationIdFromCustomer(
      customerId,
    );
    if (!organisationId) return;

    // Find and update the invoice in Payload
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const invoices = await this.payload.find({
      collection: "invoices" as any,
      where: {
        stripeInvoiceId: { equals: invoice.id },
      },
      limit: 1,
      overrideAccess: true,
    });

    if (invoices.docs?.[0]) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const invoiceAny = invoice as any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await this.payload.update({
        collection: "invoices" as any,
        id: invoices.docs[0].id,
        data: {
          status: "paid",
          paidDate: invoiceAny.status_transitions?.paid_at
            ? new Date(invoiceAny.status_transitions.paid_at * 1000)
            : new Date(),
        },
        overrideAccess: true,
      });
    }
  }

  /**
   * Private: Handle invoice.payment_failed event
   */
  private async handleInvoicePaymentFailed(
    invoice: Stripe.Invoice,
  ): Promise<void> {
    if (!invoice.customer) return;

    const customerId =
      typeof invoice.customer === "string" ? invoice.customer : invoice.customer.id;

    const organisationId = await this.getOrganisationIdFromCustomer(
      customerId,
    );
    if (!organisationId) return;

    // Find and update the invoice in Payload
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const invoices = await this.payload.find({
      collection: "invoices" as any,
      where: {
        stripeInvoiceId: { equals: invoice.id },
      },
      limit: 1,
      overrideAccess: true,
    });

    if (invoices.docs?.[0]) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await this.payload.update({
        collection: "invoices" as any,
        id: invoices.docs[0].id,
        data: {
          status: "failed",
        },
        overrideAccess: true,
      });
    }
  }

  /**
   * Private: Get organisation ID from Stripe customer
   */
  private async getOrganisationIdFromCustomer(
    customerId: string,
  ): Promise<string | null> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const orgs = await this.payload.find({
      collection: "organisations" as any,
      where: {
        stripeCustomerId: { equals: customerId },
      },
      limit: 1,
      overrideAccess: true,
    });

    return orgs.docs?.[0]?.id ?? null;
  }

  /**
   * Private: Get subscription for organisation
   */
  private async getSubscriptionForOrg(
    organisationId: string,
  ): Promise<Subscription | null> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const subs = await this.payload.find({
      collection: "subscriptions" as any,
      where: {
        organisation: { equals: organisationId },
      },
      limit: 1,
      overrideAccess: true,
    });

    return (subs.docs?.[0] as Subscription) ?? null;
  }

  /**
   * Private: Map Stripe subscription status to internal status
   */
  private mapStripeSubStatus(
    stripeStatus: string,
  ): "active" | "trialing" | "past_due" | "canceled" | "suspended" {
    switch (stripeStatus) {
      case "active":
        return "active";
      case "trialing":
        return "trialing";
      case "past_due":
        return "past_due";
      case "canceled":
      case "incomplete_expired":
        return "canceled";
      default:
        return "suspended";
    }
  }

  /**
   * Private: Get monthly price ID for plan
   */
  private getMonthlyPriceId(planName: string): string | null {
    const priceIds: Record<string, string> = {
      starter: process.env.STRIPE_PRICE_STARTER_MONTHLY || "",
      professional: process.env.STRIPE_PRICE_PROFESSIONAL_MONTHLY || "",
      enterprise: process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY || "",
      trial: process.env.STRIPE_PRICE_TRIAL_MONTHLY || "",
    };

    return priceIds[planName] || null;
  }

  /**
   * Private: Get annual price ID for plan
   */
  private getAnnualPriceId(planName: string): string | null {
    const priceIds: Record<string, string> = {
      starter: process.env.STRIPE_PRICE_STARTER_ANNUAL || "",
      professional: process.env.STRIPE_PRICE_PROFESSIONAL_ANNUAL || "",
      enterprise: process.env.STRIPE_PRICE_ENTERPRISE_ANNUAL || "",
      trial: process.env.STRIPE_PRICE_TRIAL_ANNUAL || "",
    };

    return priceIds[planName] || null;
  }
}

/**
 * Factory function to create a StripeService instance
 */
export function createStripeService(payload: Payload): StripeService {
  return new StripeService(payload);
}
