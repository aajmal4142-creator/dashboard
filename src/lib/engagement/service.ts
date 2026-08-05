import { randomBytes } from "node:crypto";

import type { Payload, Where } from "payload";

import { ENGAGEMENT_CAMPAIGNS_SLUG } from "@/collections/EngagementCampaigns";

import { campaignProgress, isCampaignGoalType } from "./progress";
import {
  isCampaignStatus,
  isSurveyMode,
  type CampaignStatus,
  type EngagementCampaignDto,
} from "./types";

function relationId(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value;
  if (value && typeof value === "object" && "id" in value) {
    const id = (value as { id: unknown }).id;
    return typeof id === "string" ? id : null;
  }
  return null;
}

function dateOnly(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  return value.slice(0, 10);
}

function finiteOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  return n;
}

export function docToCampaign(doc: Record<string, unknown>): EngagementCampaignDto {
  const goalType = isCampaignGoalType(doc.goalType) ? doc.goalType : "participants";
  const goalValue = finiteOrNull(doc.goalValue);
  const participantCount =
    typeof doc.participantCount === "number" && Number.isFinite(doc.participantCount)
      ? Math.max(0, doc.participantCount)
      : 0;
  const achievedTco2e = finiteOrNull(doc.achievedTco2e);

  return {
    id: String(doc.id),
    title: typeof doc.title === "string" ? doc.title : "",
    status: isCampaignStatus(doc.status) ? doc.status : "draft",
    startDate: dateOnly(doc.startDate),
    endDate: dateOnly(doc.endDate),
    goalType,
    goalValue,
    participantCount,
    achievedTco2e,
    linkCommuteChallenge: Boolean(doc.linkCommuteChallenge),
    description:
      typeof doc.description === "string" && doc.description.trim()
        ? doc.description
        : null,
    publicToken:
      typeof doc.publicToken === "string" && doc.publicToken.trim()
        ? doc.publicToken
        : null,
    surveyMode: isSurveyMode(doc.surveyMode) ? doc.surveyMode : "none",
    surveyResponseCount:
      typeof doc.surveyResponseCount === "number" &&
      Number.isFinite(doc.surveyResponseCount)
        ? Math.max(0, doc.surveyResponseCount)
        : 0,
    progress: campaignProgress({
      goalType,
      goalValue,
      participantCount,
      achievedTco2e,
    }),
    updatedAt: typeof doc.updatedAt === "string" ? doc.updatedAt : null,
    createdAt: typeof doc.createdAt === "string" ? doc.createdAt : null,
  };
}

export function generatePublicToken(): string {
  return randomBytes(24).toString("base64url");
}

/**
 * Ensure a campaign has a publicToken, generating and persisting one if
 * missing. Returns the token. Retries once on the (astronomically unlikely)
 * unique-constraint collision.
 */
export async function ensureCampaignPublicToken(
  payload: Payload,
  id: string,
  existingToken: string | null,
): Promise<string> {
  if (existingToken) return existingToken;
  const token = generatePublicToken();
  try {
    await payload.update({
      collection: ENGAGEMENT_CAMPAIGNS_SLUG,
      id,
      data: { publicToken: token },
      depth: 0,
      overrideAccess: true,
    });
    return token;
  } catch {
    const retryToken = generatePublicToken();
    await payload.update({
      collection: ENGAGEMENT_CAMPAIGNS_SLUG,
      id,
      data: { publicToken: retryToken },
      depth: 0,
      overrideAccess: true,
    });
    return retryToken;
  }
}

/**
 * Public (unauthenticated) lookup by token — used by the /e/[token] survey
 * page and its submit route. Only returns campaigns with an active status
 * and a commute survey mode; never exposes org-internal fields beyond what
 * the public form needs.
 */
export async function getCampaignByPublicToken(
  payload: Payload,
  token: string,
): Promise<EngagementCampaignDto | null> {
  if (!token.trim()) return null;
  const result = await payload.find({
    collection: ENGAGEMENT_CAMPAIGNS_SLUG,
    where: { publicToken: { equals: token } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  });
  const doc = result.docs[0];
  if (!doc) return null;
  return docToCampaign(doc as unknown as Record<string, unknown>);
}

export async function listOrgCampaigns(
  payload: Payload,
  organisationId: string,
  opts?: { status?: CampaignStatus },
): Promise<EngagementCampaignDto[]> {
  const where: Where = {
    organisation: { equals: organisationId },
  };
  if (opts?.status) {
    where.status = { equals: opts.status };
  }

  const result = await payload.find({
    collection: ENGAGEMENT_CAMPAIGNS_SLUG,
    where,
    limit: 200,
    sort: "-updatedAt",
    depth: 0,
    overrideAccess: true,
  });

  return result.docs.map((doc) =>
    docToCampaign(doc as unknown as Record<string, unknown>),
  );
}

export async function getOrgCampaign(
  payload: Payload,
  organisationId: string,
  id: string,
): Promise<EngagementCampaignDto | null> {
  try {
    const doc = await payload.findByID({
      collection: ENGAGEMENT_CAMPAIGNS_SLUG,
      id,
      depth: 0,
      overrideAccess: true,
    });
    const orgId = relationId((doc as unknown as { organisation?: unknown }).organisation);
    if (orgId !== organisationId) return null;
    return docToCampaign(doc as unknown as Record<string, unknown>);
  } catch {
    return null;
  }
}
