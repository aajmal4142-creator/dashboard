import Stripe from "stripe";

let client: Stripe | null = null;

export function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  if (!client) {
    client = new Stripe(key);
  }
  return client;
}

export function appOrigin(req?: Request): string {
  if (req) {
    try {
      return new URL(req.url).origin;
    } catch {
      /* fall through */
    }
  }
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}
