import { randomUUID } from "node:crypto";

import type { Payload } from "payload";

import { writeAuditLog } from "@/lib/audit/write";
import { rateLimit } from "@/lib/rate-limit";

import { REPORT_EMBED_TOKENS_SLUG } from "@/collections/ReportEmbedTokens";

import {
  buildEmbedCode,
  buildShareUrls,
  clampShareTtlDays,
  classifyEmbedTokenStatus,
  computeShareExpiry,
  isShareTokenExpired,
  SHARE_TOKEN_TTL_DAYS,
} from "./htmlReport";
import type { ReportSnapshot } from "./types";

export type MintShareLinkResult = {
  token: string;
  tokenId: string;
  shareUrl: string;
  embedUrl: string;
  embedCode: string;
  expiresAt: string;
  ttlDays: number;
};

export type EmbedTokenListItem = {
  id: string;
  token: string;
  tokenPreview: string;
  shareUrl: string;
  embedUrl: string;
  expiresAt: string;
  createdAt: string;
  usageCount: number;
  lastAccessedAt: string | null;
  revokedAt: string | null;
  status: "active" | "expired" | "revoked";
};

export type ResolveShareTokenResult =
  | {
      ok: true;
      snapshot: ReportSnapshot;
      organisationId: string;
      reportId: string;
      tokenId: string;
      generatedAtIso: string;
    }
  | { ok: false; reason: "not_found" | "expired" | "revoked" | "no_snapshot" };

function mintOpaqueToken(): string {
  return randomUUID();
}

function appOrigin(reqUrl?: string): string {
  // Prefer the live request origin so share/embed URLs match the host:port in use
  // (NEXT_PUBLIC_APP_URL may be stale, e.g. :3000 while QA runs on :3010).
  if (reqUrl) {
    try {
      const origin = new URL(reqUrl).origin;
      if (origin && origin !== "null") return origin;
    } catch {
      /* fall through */
    }
  }
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

function tokenPreview(token: string): string {
  if (token.length <= 12) return token;
  return `${token.slice(0, 8)}…${token.slice(-4)}`;
}

function relationId(value: string | { id: string } | null | undefined): string {
  if (value == null) return "";
  if (typeof value === "object") return String(value.id);
  return String(value);
}

/**
 * Rate-limited mint of a read-only embed/share token linked to report + org.
 * Default TTL 7 days (configurable 1–30). Opaque UUID — never embeds organisation id.
 */
export async function mintReportShareLink(
  payload: Payload,
  input: {
    reportId: string;
    organisationId: string;
    actorId: string;
    origin?: string;
    ip?: string | null;
    userAgent?: string | null;
    ttlDays?: number;
  },
): Promise<
  { ok: true; result: MintShareLinkResult } | { ok: false; error: string; status: number }
> {
  const limited = await rateLimit(
    `report-share:${input.organisationId}:${input.actorId}`,
    { max: 20, windowMs: 60 * 60 * 1000 },
  );
  if (!limited.ok) {
    return {
      ok: false,
      error: `Too many share links. Retry after ${limited.retryAfterSec}s.`,
      status: 429,
    };
  }

  const ttlDays = clampShareTtlDays(input.ttlDays ?? SHARE_TOKEN_TTL_DAYS);
  const token = mintOpaqueToken();
  const expiresAt = computeShareExpiry(new Date(), ttlDays);
  const doc = await payload.create({
    collection: REPORT_EMBED_TOKENS_SLUG,
    data: {
      organisation: input.organisationId,
      report: input.reportId,
      token,
      expiresAt: expiresAt.toISOString(),
      usageCount: 0,
      createdBy: input.actorId,
    },
    overrideAccess: true,
  });

  const origin = appOrigin(input.origin);
  const urls = buildShareUrls(origin, token);
  const result: MintShareLinkResult = {
    token,
    tokenId: String(doc.id),
    shareUrl: urls.shareUrl,
    embedUrl: urls.embedUrl,
    embedCode: buildEmbedCode(urls.embedUrl),
    expiresAt: expiresAt.toISOString(),
    ttlDays,
  };

  await writeAuditLog(payload, {
    organisationId: input.organisationId,
    actorId: input.actorId,
    action: "report.share_link.create",
    entityType: REPORT_EMBED_TOKENS_SLUG,
    entityId: String(doc.id),
    after: {
      reportId: input.reportId,
      expiresAt: result.expiresAt,
      ttlDays,
    },
    ip: input.ip,
    userAgent: input.userAgent,
  });

  return { ok: true, result };
}

/**
 * List embed tokens for a report (org-scoped). Never returns organisation id in the token.
 */
export async function listReportEmbedTokens(
  payload: Payload,
  input: {
    reportId: string;
    organisationId: string;
    origin?: string;
    includeInactive?: boolean;
  },
): Promise<EmbedTokenListItem[]> {
  const found = await payload.find({
    collection: REPORT_EMBED_TOKENS_SLUG,
    where: {
      and: [
        { report: { equals: input.reportId } },
        { organisation: { equals: input.organisationId } },
      ],
    },
    sort: "-createdAt",
    limit: 50,
    depth: 0,
    overrideAccess: true,
  });

  const origin = appOrigin(input.origin);
  const now = new Date();
  const items: EmbedTokenListItem[] = [];

  for (const doc of found.docs) {
    const revokedAt = doc.revokedAt ? String(doc.revokedAt) : null;
    const expiresAt = String(doc.expiresAt);
    const status = classifyEmbedTokenStatus({ expiresAt, revokedAt }, now);

    if (!input.includeInactive && status !== "active") continue;

    const token = String(doc.token);
    const urls = buildShareUrls(origin, token);
    items.push({
      id: String(doc.id),
      token,
      tokenPreview: tokenPreview(token),
      shareUrl: urls.shareUrl,
      embedUrl: urls.embedUrl,
      expiresAt,
      createdAt: String(doc.createdAt),
      usageCount: Number(doc.usageCount ?? 0),
      lastAccessedAt: doc.lastAccessedAt ? String(doc.lastAccessedAt) : null,
      revokedAt,
      status,
    });
  }

  return items;
}

/**
 * Revoke an embed token by opaque token string (org + report scoped).
 */
export async function revokeReportEmbedToken(
  payload: Payload,
  input: {
    reportId: string;
    organisationId: string;
    token: string;
    actorId: string;
    ip?: string | null;
    userAgent?: string | null;
  },
): Promise<
  | { ok: true; alreadyRevoked: boolean; tokenId: string }
  | { ok: false; error: string; status: number }
> {
  const found = await payload.find({
    collection: REPORT_EMBED_TOKENS_SLUG,
    where: {
      and: [
        { token: { equals: input.token } },
        { report: { equals: input.reportId } },
        { organisation: { equals: input.organisationId } },
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  });
  const doc = found.docs[0];
  if (!doc) {
    return { ok: false, error: "Token not found", status: 404 };
  }

  if (doc.revokedAt) {
    return { ok: true, alreadyRevoked: true, tokenId: String(doc.id) };
  }

  const nowIso = new Date().toISOString();
  await payload.update({
    collection: REPORT_EMBED_TOKENS_SLUG,
    id: doc.id,
    data: { revokedAt: nowIso },
    overrideAccess: true,
  });

  await writeAuditLog(payload, {
    organisationId: input.organisationId,
    actorId: input.actorId,
    action: "report.embed.revoke",
    entityType: REPORT_EMBED_TOKENS_SLUG,
    entityId: String(doc.id),
    after: { reportId: input.reportId, revokedAt: nowIso },
    ip: input.ip,
    userAgent: input.userAgent,
  });

  return { ok: true, alreadyRevoked: false, tokenId: String(doc.id) };
}

/**
 * Resolve a public HTML share/embed token. Read-only; bumps usage + audit on success.
 * Loads the current report snapshot so living data is fresh when the snapshot changes.
 */
export async function resolveReportShareToken(
  payload: Payload,
  token: string,
  meta?: { ip?: string | null; userAgent?: string | null },
): Promise<ResolveShareTokenResult> {
  const found = await payload.find({
    collection: REPORT_EMBED_TOKENS_SLUG,
    where: { token: { equals: token } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  });
  const doc = found.docs[0];
  if (!doc) return { ok: false, reason: "not_found" };
  if (doc.revokedAt) return { ok: false, reason: "revoked" };
  if (isShareTokenExpired(String(doc.expiresAt))) return { ok: false, reason: "expired" };

  const organisationId = relationId(doc.organisation);
  const reportId = relationId(doc.report);

  let report;
  try {
    report = await payload.findByID({
      collection: "reports",
      id: reportId,
      depth: 0,
      overrideAccess: true,
    });
  } catch {
    return { ok: false, reason: "not_found" };
  }

  const reportOrg = relationId(report.organisation);
  if (reportOrg !== organisationId) {
    return { ok: false, reason: "not_found" };
  }

  const snapshot = report.snapshot as ReportSnapshot | null;
  if (!snapshot) return { ok: false, reason: "no_snapshot" };

  const nowIso = new Date().toISOString();
  await payload.update({
    collection: REPORT_EMBED_TOKENS_SLUG,
    id: doc.id,
    data: {
      usageCount: (doc.usageCount ?? 0) + 1,
      lastAccessedAt: nowIso,
    },
    overrideAccess: true,
  });

  await writeAuditLog(payload, {
    organisationId,
    action: "report.embed.access",
    entityType: REPORT_EMBED_TOKENS_SLUG,
    entityId: String(doc.id),
    after: {
      reportId,
      accessedAt: nowIso,
    },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });

  return {
    ok: true,
    snapshot,
    organisationId,
    reportId,
    tokenId: String(doc.id),
    generatedAtIso: nowIso,
  };
}
