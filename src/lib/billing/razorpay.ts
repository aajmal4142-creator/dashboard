import { mayEnablePaidBilling } from "@/lib/launch/gates";

/**
 * Razorpay / INR billing — Y05, gated behind §11 (open decision: INR/Razorpay).
 * Never assume production credentials or a live processor switch. This module
 * only calls the real Razorpay API when RAZORPAY_KEY_ID/SECRET are both present
 * AND CLEARESG_WS0_SIGNED_OFF=1 — otherwise it returns a structured denial that
 * says exactly what is missing. It never fabricates a stub order.
 */

export type BillingProvider = "stripe" | "razorpay";
export type BillingCurrency = "INR" | "EUR" | "USD";

const RAZORPAY_API_BASE = "https://api.razorpay.com/v1";
const OPEN_DECISION_DOCS = "/docs/LAUNCH_DECISIONS.md";

/** Which processor the checkout routes and BillingClient treat as active. */
export function billingProvider(): BillingProvider {
  const raw = process.env.BILLING_PROVIDER?.trim().toLowerCase();
  return raw === "razorpay" ? "razorpay" : "stripe";
}

/** Display / quoting currency — does not by itself enable a live charge path. */
export function billingCurrency(): BillingCurrency {
  const raw = process.env.BILLING_CURRENCY?.trim().toUpperCase();
  if (raw === "INR" || raw === "USD") return raw;
  return "EUR";
}

export function razorpayConfigured(): boolean {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

export type RazorpayDenialCode =
  | "RAZORPAY_NOT_CONFIGURED"
  | "PROVIDER_NOT_RAZORPAY"
  | "WS0_REQUIRED"
  | "RAZORPAY_API_ERROR";

export type RazorpayDenial = {
  ok: false;
  status: 501 | 402 | 502;
  error: string;
  code: RazorpayDenialCode;
  docs: string;
};

export function razorpayNotConfiguredDenial(): RazorpayDenial {
  return {
    ok: false,
    status: 501,
    error: "Razorpay not configured — open decision §11",
    code: "RAZORPAY_NOT_CONFIGURED",
    docs: OPEN_DECISION_DOCS,
  };
}

export function providerNotRazorpayDenial(): RazorpayDenial {
  return {
    ok: false,
    status: 501,
    error:
      "Billing provider is Stripe. Set BILLING_PROVIDER=razorpay after ops confirms the INR/Razorpay open decision (§11) to enable this path.",
    code: "PROVIDER_NOT_RAZORPAY",
    docs: OPEN_DECISION_DOCS,
  };
}

export function razorpayPaidBillingDenial(): RazorpayDenial {
  return {
    ok: false,
    status: 402,
    error:
      "Razorpay keys are present but live INR checkout is locked until Workstream 0 sign-off confirms the §11 INR/Razorpay decision (CLEARESG_WS0_SIGNED_OFF=1).",
    code: "WS0_REQUIRED",
    docs: OPEN_DECISION_DOCS,
  };
}

export type RazorpayOrder = {
  ok: true;
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
  receipt: string | null;
};

export type CreateRazorpayOrderInput = {
  /** Amount in the smallest currency unit (paise for INR). */
  amountMinorUnits: number;
  currency?: string;
  receipt?: string;
  notes?: Record<string, string>;
};

export type RazorpayOrderResult = RazorpayOrder | RazorpayDenial;

type RazorpayApiOrderResponse = {
  id: string;
  amount: number;
  currency: string;
  receipt?: string | null;
};

/**
 * Create a Razorpay order via the live Orders API. Only reaches the network
 * when keys are configured and WS0 is signed off — otherwise returns a
 * structured 501/402 denial. Never charges or fabricates a stub order.
 */
export async function createRazorpayOrder(
  input: CreateRazorpayOrderInput,
): Promise<RazorpayOrderResult> {
  if (!razorpayConfigured()) {
    return razorpayNotConfiguredDenial();
  }
  if (!mayEnablePaidBilling()) {
    return razorpayPaidBillingDenial();
  }

  const keyId = process.env.RAZORPAY_KEY_ID ?? "";
  const keySecret = process.env.RAZORPAY_KEY_SECRET ?? "";
  const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");

  let res: Response;
  try {
    res = await fetch(`${RAZORPAY_API_BASE}/orders`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: input.amountMinorUnits,
        currency: input.currency ?? "INR",
        receipt: input.receipt,
        notes: input.notes,
      }),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "network error";
    return {
      ok: false,
      status: 502,
      error: `Could not reach Razorpay: ${message}`,
      code: "RAZORPAY_API_ERROR",
      docs: OPEN_DECISION_DOCS,
    };
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return {
      ok: false,
      status: 502,
      error: `Razorpay order creation failed (${res.status})${text ? `: ${text}` : ""}`,
      code: "RAZORPAY_API_ERROR",
      docs: OPEN_DECISION_DOCS,
    };
  }

  const order = (await res.json()) as RazorpayApiOrderResponse;
  return {
    ok: true,
    orderId: order.id,
    amount: order.amount,
    currency: order.currency,
    keyId,
    receipt: order.receipt ?? null,
  };
}
