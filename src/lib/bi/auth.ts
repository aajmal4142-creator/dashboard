import { getPayload, type Payload } from "payload";
import { NextResponse } from "next/server";

import { writeAuditLog } from "@/lib/audit/write";
import { clientIp } from "@/lib/rate-limit";
import config from "@/payload.config";

import { extractBiApiKey, hashBiApiKey } from "./apiKey";
import { checkBiRateLimit, getBiRateLimitHeaders } from "./rateLimit";

export type BiAuthContext = {
  payload: Payload;
  organisationId: string;
  keyId: string;
  keyPrefix: string;
  rateLimitHeaders: Record<string, string>;
};

type BiKeyDoc = {
  id: string;
  organisation: string | { id: string };
  apiKeyHash?: string | null;
  apiKeyPrefix?: string | null;
  status?: string | null;
};

function orgIdOf(value: string | { id: string }): string {
  return typeof value === "string" ? value : value.id;
}

/**
 * Authenticate a read-only BI request via org API key.
 * Applies rate limiting and writes an audit event (prefix only — never full key).
 */
export async function requireBiAuth(
  req: Request,
  resource: string,
): Promise<{ ok: true; ctx: BiAuthContext } | { ok: false; response: NextResponse }> {
  const apiKey = extractBiApiKey(req.headers);
  if (!apiKey) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error:
            "Missing API key. Send Authorization: Bearer <key> or X-ClearESG-Api-Key.",
        },
        { status: 401 },
      ),
    };
  }

  const payload = await getPayload({ config });
  const hash = hashBiApiKey(apiKey);

  const found = await payload.find({
    collection: "bi-api-keys",
    where: {
      and: [{ apiKeyHash: { equals: hash } }, { status: { equals: "active" } }],
    },
    limit: 1,
    overrideAccess: true,
  });

  const doc = found.docs[0] as BiKeyDoc | undefined;
  if (!doc) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Invalid or revoked API key." },
        { status: 401 },
      ),
    };
  }

  const rate = await checkBiRateLimit(doc.id);
  const rateLimitHeaders = getBiRateLimitHeaders(rate);
  if (!rate.ok) {
    await writeAuditLog(payload, {
      organisationId: orgIdOf(doc.organisation),
      action: "bi.rate_limited",
      entityType: "bi-api-keys",
      entityId: doc.id,
      after: { resource, apiKeyPrefix: doc.apiKeyPrefix ?? null },
      ip: clientIp(req),
      userAgent: req.headers.get("user-agent"),
    });
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Rate limit exceeded. Retry after the period in Retry-After." },
        { status: 429, headers: rateLimitHeaders },
      ),
    };
  }

  const organisationId = orgIdOf(doc.organisation);
  const keyPrefix = doc.apiKeyPrefix ?? apiKey.slice(0, 12);

  await writeAuditLog(payload, {
    organisationId,
    action: `bi.read.${resource}`,
    entityType: "bi-api-keys",
    entityId: doc.id,
    after: { resource, apiKeyPrefix: keyPrefix },
    ip: clientIp(req),
    userAgent: req.headers.get("user-agent"),
  });

  // Fire-and-forget last-used stamp; do not block the response on failure.
  void payload
    .update({
      collection: "bi-api-keys",
      id: doc.id,
      data: { lastUsedAt: new Date().toISOString() },
      overrideAccess: true,
    })
    .catch((err: unknown) => {
      console.error("[bi] lastUsedAt update failed", err);
    });

  return {
    ok: true,
    ctx: {
      payload,
      organisationId,
      keyId: doc.id,
      keyPrefix,
      rateLimitHeaders,
    },
  };
}

export function biJson(
  body: unknown,
  auth: BiAuthContext,
  init?: { status?: number },
): NextResponse {
  return NextResponse.json(body, {
    status: init?.status ?? 200,
    headers: auth.rateLimitHeaders,
  });
}
