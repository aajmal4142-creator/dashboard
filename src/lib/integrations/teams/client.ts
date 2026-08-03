import type { TeamsPostResult } from "./types";

/**
 * POST JSON to a Teams Incoming Webhook URL.
 * Never logs the URL.
 */
export async function postTeamsWebhook(
  webhookUrl: string,
  body: unknown,
  fetchImpl: typeof fetch = fetch,
): Promise<TeamsPostResult> {
  const url = webhookUrl.trim();
  if (!url) {
    return { ok: false, error: "webhook_url_required" };
  }

  try {
    const response = await fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      const snippet = text.trim().slice(0, 120);
      return {
        ok: false,
        error: snippet
          ? `http_${response.status}: ${snippet}`
          : `http_${response.status}`,
        status: response.status,
      };
    }

    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "network_error";
    return { ok: false, error: message.slice(0, 200) };
  }
}
