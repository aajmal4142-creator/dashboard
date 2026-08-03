import type { Subprocessor } from "./types";

/**
 * Editable static subprocessor register for the Trust Center.
 * Update this file when vendors change — no paid GRC required.
 */
export const SUBPROCESSORS: Subprocessor[] = [
  {
    id: "clerk",
    name: "Clerk",
    purpose: "User authentication and session management",
    dataCategories: "Account identifiers, email, authentication metadata",
    region: "Vendor-managed (see Clerk data residency docs)",
    website: "https://clerk.com",
  },
  {
    id: "mongodb-atlas",
    name: "MongoDB Atlas",
    purpose: "Primary application database (Payload collections)",
    dataCategories: "Organisation ESG data, memberships, audit records",
    region: "Configured Atlas cluster region",
    website: "https://www.mongodb.com/cloud/atlas",
  },
  {
    id: "vercel",
    name: "Vercel",
    purpose: "Application hosting and edge delivery",
    dataCategories: "HTTP request metadata, logs as configured",
    region: "Edge / regional (deployment dependent)",
    website: "https://vercel.com",
  },
  {
    id: "resend",
    name: "Resend",
    purpose: "Transactional email delivery",
    dataCategories: "Recipient email, message content for notified events",
    region: "Vendor-managed",
    website: "https://resend.com",
  },
  {
    id: "stripe",
    name: "Stripe",
    purpose: "Billing and subscription payments (when enabled)",
    dataCategories: "Billing contact, payment method tokens (Stripe-hosted)",
    region: "Vendor-managed",
    website: "https://stripe.com",
  },
  {
    id: "upstash",
    name: "Upstash Redis",
    purpose: "Rate limiting and short-lived operational caches",
    dataCategories: "Request counters, opaque rate-limit keys",
    region: "Configured Upstash region",
    website: "https://upstash.com",
  },
  {
    id: "sentry",
    name: "Sentry",
    purpose: "Application error monitoring (when configured)",
    dataCategories: "Error stacks, limited request context — scrub secrets",
    region: "Vendor-managed",
    website: "https://sentry.io",
  },
];
