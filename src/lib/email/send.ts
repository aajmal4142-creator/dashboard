/**
 * Shared transactional email via Resend HTTP API.
 * Falls back to console when RESEND_API_KEY is absent (non-production).
 */

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

export type SendEmailResult = {
  delivery: "resend" | "console" | "failed";
  id?: string;
  error?: string;
};

const FROM = () => process.env.RESEND_FROM?.trim() || "ClearESG <onboarding@resend.dev>";

export async function sendTransactionalEmail(
  input: SendEmailInput,
): Promise<SendEmailResult> {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) {
    console.info(`[email] (no RESEND_API_KEY) to=${input.to} subject=${input.subject}`);
    return { delivery: "console" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM(),
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
    });
    const body = (await res.json()) as { id?: string; message?: string };
    if (!res.ok) {
      return {
        delivery: "failed",
        error: body.message ?? `Resend ${res.status}`,
      };
    }
    return { delivery: "resend", id: body.id };
  } catch (err) {
    return {
      delivery: "failed",
      error: err instanceof Error ? err.message : "send failed",
    };
  }
}
