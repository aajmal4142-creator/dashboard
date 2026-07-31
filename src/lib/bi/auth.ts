import { getPayload, type Payload } from "payload";
import { NextResponse } from "next/server";

import { writeAuditLog } from "@/lib/audit/write";
import { incrementApiUsage } from "@/lib/billing/freeTierGates";
import { notifyOrganisationMembers } from "@/lib/notifications/createNotification";
import { clientIp } from "@/lib/rate-limit";
import config from "@/payload.config";

import { extractBiApiKey, hashBiApiKey } from "./apiKey";
import {
  isIpAllowed,
  nextUtcDayResetMs,
  parseAllowedIps,
  shouldAlertApproachingQuota,
} from "./quota";
import { checkBiQuota } from "./rateLimit";

export type BiAuthContext = {
  payload: Payload;
  organisationId: string;
  keyId: string;
  keyPrefix: string;
  plan: string;
  rateLimitHeaders: Record<string, string>;
};

type BiKeyDoc = {
  id: string;
  organisation: string | { id: string };
  apiKeyHash?: string | null;
  apiKeyPrefix?: string | null;
  status?: string | null;
  lastUsedAt?: string | null;
  quotaLimitPerHour?: number | null;
  quotaLimitPerDay?: number | null;
  allowedIps?: { ip?: string | null }[] | null;
  callsThisHour?: number | null;
  callsToday?: number | null;
  quotaResetAt?: string | null;
  quotaWarningSentAt?: string | null;
};

function orgIdOf(value: string | { id: string }): string {
  return typeof value === "string" ? value : value.id;
}

function sameUtcDay(aMs: number, bMs: number): boolean {
  const a = new Date(aMs);
  const b = new Date(bMs);
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

function sameUtcHour(aMs: number, bMs: number): boolean {
  return (
    sameUtcDay(aMs, bMs) && new Date(aMs).getUTCHours() === new Date(bMs).getUTCHours()
  );
}

async function resolveOrgPlan(payload: Payload, organisationId: string): Promise<string> {
  try {
    const org = await payload.findByID({
      collection: "organisations",
      id: organisationId,
      depth: 0,
      overrideAccess: true,
    });
    const plan = org && typeof org === "object" && "plan" in org ? org.plan : null;
    return typeof plan === "string" ? plan : "free";
  } catch {
    return "free";
  }
}

async function stampUsageAndMaybeWarn(
  payload: Payload,
  doc: BiKeyDoc,
  organisationId: string,
  quota: Extract<Awaited<ReturnType<typeof checkBiQuota>>, { ok: true }>,
): Promise<void> {
  const now = Date.now();
  const prevReset = doc.quotaResetAt ? Date.parse(doc.quotaResetAt) : NaN;
  const dayRollover = !Number.isFinite(prevReset) || now >= prevReset;
  const lastUsedMs = doc.lastUsedAt ? Date.parse(doc.lastUsedAt) : NaN;
  const hourRollover = !Number.isFinite(lastUsedMs) || !sameUtcHour(lastUsedMs, now);

  const callsThisHour =
    quota.limits.perHour != null
      ? quota.usedHour
      : hourRollover
        ? 1
        : (doc.callsThisHour ?? 0) + 1;
  const callsToday =
    quota.limits.perDay != null
      ? quota.usedDay
      : dayRollover
        ? 1
        : (doc.callsToday ?? 0) + 1;

  const data: Record<string, unknown> = {
    lastUsedAt: new Date(now).toISOString(),
    callsThisHour,
    callsToday,
    quotaResetAt: new Date(nextUtcDayResetMs(now)).toISOString(),
  };

  const warnHour = shouldAlertApproachingQuota(callsThisHour, quota.limits.perHour);
  const warnDay = shouldAlertApproachingQuota(callsToday, quota.limits.perDay);
  const lastWarn = doc.quotaWarningSentAt ? Date.parse(doc.quotaWarningSentAt) : NaN;
  const warnedToday = Number.isFinite(lastWarn) && sameUtcDay(lastWarn, now);

  if ((warnHour || warnDay) && !warnedToday) {
    data.quotaWarningSentAt = new Date(now).toISOString();
    const hourPart =
      quota.limits.perHour != null
        ? `Hour: ${callsThisHour}/${quota.limits.perHour}. `
        : "";
    const dayPart =
      quota.limits.perDay != null ? `Day: ${callsToday}/${quota.limits.perDay}.` : "";
    void notifyOrganisationMembers(payload, {
      organisationId,
      type: "alert_triggered",
      title: "BI API quota approaching limit",
      message:
        `Key ${doc.apiKeyPrefix ?? doc.id} is near its plan quota. ${hourPart}${dayPart}`.trim(),
      resourceType: "bi-api-keys",
      resourceId: doc.id,
    });
  }

  await payload.update({
    collection: "bi-api-keys",
    id: doc.id,
    data,
    overrideAccess: true,
  });

  void incrementApiUsage(organisationId, 1).catch((err: unknown) => {
    console.error("[bi] free-tier api usage increment failed", err);
  });
}

/**
 * Authenticate a read-only BI request via org API key.
 * Applies plan quotas, optional IP whitelist, and writes an audit event
 * (prefix only — never full key).
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

  const organisationId = orgIdOf(doc.organisation);
  const ip = clientIp(req);
  const allowedIps = parseAllowedIps(doc.allowedIps);
  if (!isIpAllowed(ip, allowedIps)) {
    await writeAuditLog(payload, {
      organisationId,
      action: "bi.ip_denied",
      entityType: "bi-api-keys",
      entityId: doc.id,
      after: { resource, apiKeyPrefix: doc.apiKeyPrefix ?? null, ip },
      ip,
      userAgent: req.headers.get("user-agent"),
    });
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Client IP is not on this key's allowlist." },
        { status: 403 },
      ),
    };
  }

  const plan = await resolveOrgPlan(payload, organisationId);
  const quota = await checkBiQuota({
    keyId: doc.id,
    plan,
    overrides: {
      quotaLimitPerHour: doc.quotaLimitPerHour,
      quotaLimitPerDay: doc.quotaLimitPerDay,
    },
  });
  const rateLimitHeaders = quota.headers;

  if (!quota.ok) {
    await writeAuditLog(payload, {
      organisationId,
      action: "bi.rate_limited",
      entityType: "bi-api-keys",
      entityId: doc.id,
      after: {
        resource,
        apiKeyPrefix: doc.apiKeyPrefix ?? null,
        window: quota.window,
      },
      ip,
      userAgent: req.headers.get("user-agent"),
    });
    return {
      ok: false,
      response: NextResponse.json(
        {
          error:
            quota.window === "hour"
              ? "Hourly API quota exceeded. Retry after the period in Retry-After."
              : "Daily API quota exceeded. Retry after the period in Retry-After.",
        },
        { status: 429, headers: rateLimitHeaders },
      ),
    };
  }

  const keyPrefix = doc.apiKeyPrefix ?? apiKey.slice(0, 12);

  await writeAuditLog(payload, {
    organisationId,
    action: `bi.read.${resource}`,
    entityType: "bi-api-keys",
    entityId: doc.id,
    after: { resource, apiKeyPrefix: keyPrefix },
    ip,
    userAgent: req.headers.get("user-agent"),
  });

  // Fire-and-forget usage stamp + approaching-limit alert.
  void stampUsageAndMaybeWarn(payload, doc, organisationId, quota).catch(
    (err: unknown) => {
      console.error("[bi] usage stamp failed", err);
    },
  );

  return {
    ok: true,
    ctx: {
      payload,
      organisationId,
      keyId: doc.id,
      keyPrefix,
      plan,
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
