import { getPayload } from "payload";
import config from "@/payload.config";
import { GHG_PROTOCOL_REQUIREMENTS } from "./ghgProtocolRules";
import type { DataQualityAssessment } from "./dataQualityAssessor";

type EvidenceDocumentType =
  | "data-source"
  | "calculation-sheet"
  | "policy-document"
  | "audit-report"
  | "third-party"
  | "other";

function relationId(
  value: string | { id: string } | null | undefined,
): string | undefined {
  if (!value) return undefined;
  return typeof value === "string" ? value : value.id;
}

export interface ComplianceChecklistResponse {
  complianceId: string;
  organisationId: string;
  complianceYear: string;
  checkpoints: Array<{
    checkpointId: string;
    category: string;
    requirementName: string;
    requirementCode: string;
    requirementText: string;
    status: "not-started" | "in-progress" | "completed" | "verified" | "waived";
    applicableScopes: ("scope1" | "scope2" | "scope3")[];
    evidenceLinks: Array<{
      url: string;
      documentType: string;
      description: string;
    }>;
    verifiedBy?: string;
    verifiedAt?: string;
    notes?: string;
  }>;
  complianceScore: number;
  dataQualityScore: number;
  isVerified: boolean;
  isLocked: boolean;
}

export async function getCompliance(
  organisationId: string,
  complianceId: string,
): Promise<ComplianceChecklistResponse | null> {
  const payload = await getPayload({ config });

  const compliance = await payload.findByID({
    collection: "ghg-protocol-compliance",
    id: complianceId,
  });

  if (!compliance) return null;

  const complianceOrgId = relationId(compliance.organisation);
  if (complianceOrgId !== organisationId) return null;

  const checkpoints = await payload.find({
    collection: "compliance-checkpoints",
    where: {
      ghgProtocolCompliance: { equals: complianceId },
    },
    limit: 100,
  });

  return {
    complianceId: compliance.id,
    organisationId: complianceOrgId,
    complianceYear: compliance.complianceYear,
    checkpoints: (checkpoints.docs || []).map((cp) => ({
      checkpointId: cp.checkpointId,
      category: cp.category,
      requirementName: cp.requirementName,
      requirementCode: cp.requirementCode,
      requirementText: cp.requirementText,
      status: cp.status,
      applicableScopes: (cp.applicableScopes || []) as ("scope1" | "scope2" | "scope3")[],
      evidenceLinks: (cp.evidenceLinks || []).map((link) => ({
        url: link.url || "",
        documentType: link.documentType || "other",
        description: link.description || "",
      })),
      verifiedBy: relationId(cp.verifiedBy),
      verifiedAt: cp.verifiedAt ?? undefined,
      notes: cp.notes ?? undefined,
    })),
    complianceScore: compliance.complianceScore,
    dataQualityScore: compliance.dataQualityScore,
    isVerified: compliance.isVerified,
    isLocked: compliance.isLocked,
  };
}

export async function updateCheckpoint(
  organisationId: string,
  checkpointId: string,
  updates: {
    status?: "not-started" | "in-progress" | "completed" | "verified" | "waived";
    notes?: string;
    evidenceLinks?: Array<{
      url: string;
      documentType: EvidenceDocumentType;
      description: string;
    }>;
  },
): Promise<void> {
  const payload = await getPayload({ config });

  const checkpoint = await payload.find({
    collection: "compliance-checkpoints",
    where: {
      and: [
        { checkpointId: { equals: checkpointId } },
        { organisation: { equals: organisationId } },
      ],
    },
    limit: 1,
  });

  if (!checkpoint.docs || checkpoint.docs.length === 0) {
    throw new Error(`Checkpoint ${checkpointId} not found`);
  }

  await payload.update({
    collection: "compliance-checkpoints",
    id: checkpoint.docs[0].id,
    data: {
      status: updates.status || checkpoint.docs[0].status,
      notes: updates.notes !== undefined ? updates.notes : checkpoint.docs[0].notes,
      evidenceLinks: updates.evidenceLinks || checkpoint.docs[0].evidenceLinks,
    },
  });
}

export async function verifyCheckpoint(
  organisationId: string,
  checkpointId: string,
  userId: string,
): Promise<void> {
  const payload = await getPayload({ config });

  const checkpoint = await payload.find({
    collection: "compliance-checkpoints",
    where: {
      and: [
        { checkpointId: { equals: checkpointId } },
        { organisation: { equals: organisationId } },
      ],
    },
    limit: 1,
  });

  if (!checkpoint.docs || checkpoint.docs.length === 0) {
    throw new Error(`Checkpoint ${checkpointId} not found`);
  }

  await payload.update({
    collection: "compliance-checkpoints",
    id: checkpoint.docs[0].id,
    data: {
      status: "verified",
      verifiedBy: userId,
      verifiedAt: new Date().toISOString(),
    },
  });
}

export async function calculateComplianceScore(
  organisationId: string,
  complianceId: string,
): Promise<number> {
  const payload = await getPayload({ config });

  const checkpoints = await payload.find({
    collection: "compliance-checkpoints",
    where: {
      and: [
        { ghgProtocolCompliance: { equals: complianceId } },
        { organisation: { equals: organisationId } },
      ],
    },
    limit: 100,
  });

  const docs = checkpoints.docs || [];
  if (docs.length === 0) return 0;

  const statusWeights = {
    "not-started": 0,
    "in-progress": 25,
    completed: 75,
    verified: 100,
    waived: 100,
  };

  const totalScore = docs.reduce((sum, checkpoint) => {
    return sum + (statusWeights[checkpoint.status as keyof typeof statusWeights] || 0);
  }, 0);

  const score = Math.round(totalScore / docs.length);
  return Math.min(100, Math.max(0, score));
}

export async function initializeCompliance(
  organisationId: string,
  complianceYear: string,
  userId: string,
): Promise<string> {
  const payload = await getPayload({ config });

  const compliance = await payload.create({
    collection: "ghg-protocol-compliance",
    data: {
      organisation: organisationId,
      complianceYear,
      scope1Total: 0,
      scope2Total: 0,
      scope3Total: 0,
      boundaryDefinition: "Pending definition",
      methodology: "Pending documentation",
      dataQualityScore: 0,
      complianceScore: 0,
      isVerified: false,
      isLocked: false,
    },
  });

  for (const requirement of GHG_PROTOCOL_REQUIREMENTS) {
    await payload.create({
      collection: "compliance-checkpoints",
      data: {
        organisation: organisationId,
        ghgProtocolCompliance: compliance.id,
        checkpointId: requirement.checkpointId,
        category: requirement.category,
        requirementName: requirement.requirementName,
        requirementCode: requirement.requirementCode,
        requirementText: requirement.requirementText,
        status: "not-started",
        applicableScopes: requirement.applicableScopes,
        evidenceLinks: [],
      },
    });
  }

  await payload.create({
    collection: "compliance-history",
    data: {
      organisation: organisationId,
      compliance: compliance.id,
      action: "created",
      actor: userId,
      changes: JSON.stringify({
        complianceYear,
        checkpointsCount: GHG_PROTOCOL_REQUIREMENTS.length,
      }),
    },
  });

  return compliance.id;
}

export async function lockCompliance(
  organisationId: string,
  complianceId: string,
  userId: string,
  reason: string,
): Promise<void> {
  const payload = await getPayload({ config });

  const compliance = await payload.findByID({
    collection: "ghg-protocol-compliance",
    id: complianceId,
  });

  if (!compliance || relationId(compliance.organisation) !== organisationId) {
    throw new Error("Compliance record not found");
  }

  if (compliance.isLocked) {
    throw new Error("Compliance already locked; cannot be modified");
  }

  const lockedAt = new Date().toISOString();

  await payload.update({
    collection: "ghg-protocol-compliance",
    id: complianceId,
    data: {
      isLocked: true,
      isVerified: true,
      verifiedBy: userId,
      verifiedAt: lockedAt,
      lockedBy: userId,
      lockedAt,
    },
  });

  await payload.create({
    collection: "compliance-history",
    data: {
      organisation: organisationId,
      compliance: complianceId,
      action: "locked",
      actor: userId,
      reason,
      changes: JSON.stringify({
        isLocked: true,
        isVerified: true,
      }),
    },
  });
}

export async function validateAndUpdateEmissions(
  organisationId: string,
  complianceId: string,
  scope1: number,
  scope2: number,
  scope3: number,
  userId: string,
): Promise<void> {
  const payload = await getPayload({ config });

  const compliance = await payload.findByID({
    collection: "ghg-protocol-compliance",
    id: complianceId,
  });

  if (!compliance || relationId(compliance.organisation) !== organisationId) {
    throw new Error("Compliance record not found");
  }

  if (compliance.isLocked) {
    throw new Error("Cannot modify locked compliance record");
  }

  const totalEmissions = scope1 + scope2 + scope3;
  if (totalEmissions < 0) {
    throw new Error("Total emissions cannot be negative");
  }

  if (totalEmissions === 0) {
    console.warn("Warning: Total emissions are zero");
  }

  await payload.update({
    collection: "ghg-protocol-compliance",
    id: complianceId,
    data: {
      scope1Total: scope1,
      scope2Total: scope2,
      scope3Total: scope3,
    },
  });

  await payload.create({
    collection: "compliance-history",
    data: {
      organisation: organisationId,
      compliance: complianceId,
      action: "updated",
      actor: userId,
      changes: JSON.stringify({
        scope1Total: scope1,
        scope2Total: scope2,
        scope3Total: scope3,
      }),
    },
  });
}

export async function updateDataQuality(
  organisationId: string,
  complianceId: string,
  assessment: DataQualityAssessment,
  userId: string,
): Promise<void> {
  const payload = await getPayload({ config });

  await payload.update({
    collection: "ghg-protocol-compliance",
    id: complianceId,
    data: {
      dataQualityScore: assessment.overallScore,
      dataQualityBreakdown: {
        completeness: assessment.completeness,
        accuracy: assessment.accuracy,
        consistency: assessment.consistency,
        recency: assessment.recency,
      },
    },
  });

  await payload.create({
    collection: "compliance-history",
    data: {
      organisation: organisationId,
      compliance: complianceId,
      action: "data-quality-assessed",
      actor: userId,
      changes: JSON.stringify(assessment.breakdown),
    },
  });
}
