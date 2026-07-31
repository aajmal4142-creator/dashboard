import type {
  SlackChannelOption,
  SlackPostMessageInput,
  SlackPostMessageResult,
} from "./types";

type SlackApiEnvelope = {
  ok?: boolean;
  error?: string;
  channel?: string;
  ts?: string;
  channels?: Array<{
    id?: string;
    name?: string;
    is_private?: boolean;
    is_archived?: boolean;
  }>;
  response_metadata?: { next_cursor?: string };
};

async function slackApi(
  method: string,
  token: string,
  body: Record<string, unknown>,
  fetchImpl: typeof fetch = fetch,
): Promise<SlackApiEnvelope> {
  const response = await fetchImpl(`https://slack.com/api/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    return { ok: false, error: `http_${response.status}` };
  }

  return (await response.json()) as SlackApiEnvelope;
}

/** Post a message via chat.postMessage. Token must already be decrypted. */
export async function postSlackMessage(
  token: string,
  input: SlackPostMessageInput,
  fetchImpl: typeof fetch = fetch,
): Promise<SlackPostMessageResult> {
  const channel = input.channel.trim();
  if (!channel) {
    return { ok: false, error: "channel_required" };
  }

  const payload: Record<string, unknown> = {
    channel,
    text: input.text,
  };
  if (input.blocks && input.blocks.length > 0) {
    payload.blocks = input.blocks;
  }

  const data = await slackApi("chat.postMessage", token, payload, fetchImpl);
  if (!data.ok) {
    return { ok: false, error: data.error || "post_failed" };
  }

  return {
    ok: true,
    channel: data.channel || channel,
    ts: data.ts || "",
  };
}

/** List public + private channels the bot can see (paginated, capped). */
export async function listSlackChannels(
  token: string,
  options?: { limit?: number; fetchImpl?: typeof fetch },
): Promise<SlackChannelOption[]> {
  const fetchImpl = options?.fetchImpl ?? fetch;
  const max = Math.min(Math.max(options?.limit ?? 200, 1), 400);
  const out: SlackChannelOption[] = [];
  let cursor = "";

  while (out.length < max) {
    const pageSize = Math.min(200, max - out.length);
    const body: Record<string, unknown> = {
      types: "public_channel,private_channel",
      exclude_archived: true,
      limit: pageSize,
    };
    if (cursor) body.cursor = cursor;

    const data = await slackApi("conversations.list", token, body, fetchImpl);
    if (!data.ok) {
      throw new Error(data.error || "conversations_list_failed");
    }

    for (const ch of data.channels ?? []) {
      if (!ch.id || !ch.name || ch.is_archived) continue;
      out.push({
        id: ch.id,
        name: ch.name,
        isPrivate: Boolean(ch.is_private),
      });
      if (out.length >= max) break;
    }

    const next = data.response_metadata?.next_cursor?.trim() || "";
    if (!next) break;
    cursor = next;
  }

  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}
