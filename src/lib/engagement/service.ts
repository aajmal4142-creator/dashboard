import type { Payload, Where } from "payload";

import { ENGAGEMENT_CAMPAIGNS_SLUG } from "@/collections/EngagementCampaigns";

import { campaignProgress, isCampaignGoalType } from "./progress";
import {
  isCampaignStatus,
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
