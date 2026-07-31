/**
 * Shared transactional email via Resend HTTP API.
 * Falls back to console when RESEND_API_KEY is absent (non-production).
 */

export type SendEmailAttachment = {
  filename: string;
  /** Base64-encoded content (Resend wire format) */
  content: string;
  contentType?: string;
};

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: SendEmailAttachment[];
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
    console.info(
      `[email] (no RESEND_API_KEY) to=${input.to} subject=${input.subject}` +
        (input.attachments?.length
          ? ` attachments=${input.attachments.map((a) => a.filename).join(",")}`
          : ""),
    );
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
        attachments: input.attachments?.map((a) => ({
          filename: a.filename,
          content: a.content,
          content_type: a.contentType,
        })),
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
