import { getPayload } from "payload";
import config from "@/payload.config";
import { GHG_PROTOCOL_REQUIREMENTS } from "./ghgProtocolRules";
import type {
  DataQualityAssessment,
  DataQualityInput,
} from "./dataQualityAssessor";
import { assessDataQuality } from "./dataQualityAssessor";
import type { BoundaryDefinition, BoundaryValidationResult } from "./boundaryValidator";
import { validateBoundary } from "./boundaryValidator";

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
  complianceId: string
): Promise<ComplianceChecklistResponse | null> {
  const payload = await getPayload({ config });

  const compliance = await payload.findByID({
    collection: "ghg-protocol-compliance",
    id: complianceId,
    where: {
      organisation: { equals: organisationId },
    },
  });

  if (!compliance) return null;

  const checkpoints = await payload.find({
    collection: "compliance-checkpoints",
    where: {
      ghgProtocolCompliance: { equals: complianceId },
    },
    limit: 100,
  });

  return {
    complianceId: compliance.id,
    organisationId: compliance.organisation,
    complianceYear: compliance.complianceYear,
    checkpoints: (checkpoints.docs || []).map(cp => ({
      checkpointId: cp.checkpointId,
      category: cp.category,
      requirementName: cp.requirementName,
      requirementCode: cp.requirementCode,
      requirementText: cp.requirementText,
      status: cp.status,
      applicableScopes: cp.applicableScopes,
      evidenceLinks: cp.evidenceLinks || [],
      verifiedBy: cp.verifiedBy?.id,
      verifiedAt: cp.verifiedAt,
      notes: cp.notes,
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
      documentType: string;
      description: string;
    }>;
  }
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
  userId: string
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
      verifiedAt: new Date(),
    },
  });
}

export async function calculateComplianceScore(
  organisationId: string,
  complianceId: string
): Promise<number> {
  const payload = await getPayload({ config });

  const checkpoints = await payload.find({
    collection: "compliance-checkpoints",
    where: {
      ghgProtocolCompliance: { equals: complianceId },
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
    waived: 100, // Waived counts as complete
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
  userId: string
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

  // Create all 50+ checkpoints for this compliance record
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

  // Log creation
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
  reason: string
): Promise<void> {
  const payload = await getPayload({ config });

  const compliance = await payload.findByID({
    collection: "ghg-protocol-compliance",
    id: complianceId,
    where: {
      organisation: { equals: organisationId },
    },
  });

  if (!compliance) {
    throw new Error("Compliance record not found");
  }

  if (compliance.isLocked) {
    throw new Error("Compliance already locked; cannot be modified");
  }

  await payload.update({
    collection: "ghg-protocol-compliance",
    id: complianceId,
    data: {
      isLocked: true,
      isVerified: true,
      verifiedBy: userId,
      verifiedAt: new Date(),
      lockedBy: userId,
      lockedAt: new Date(),
    },
  });

  // Log lock
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
  userId: string
): Promise<void> {
  const payload = await getPayload({ config });

  const compliance = await payload.findByID({
    collection: "ghg-protocol-compliance",
    id: complianceId,
    where: {
      organisation: { equals: organisationId },
    },
  });

  if (!compliance) {
    throw new Error("Compliance record not found");
  }

  if (compliance.isLocked) {
    throw new Error("Cannot modify locked compliance record");
  }

  // Validate emissions are reasonable
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

  // Log update
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
  userId: string
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

  // Log assessment
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
