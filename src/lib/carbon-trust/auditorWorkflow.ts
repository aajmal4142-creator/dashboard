import type { Payload } from "payload";

type ChecklistItemStatus =
  | "not_started"
  | "in_progress"
  | "submitted"
  | "additional_info_requested"
  | "approved"
  | "not_applicable";

type CertificationStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "additional_info_requested"
  | "approved"
  | "rejected"
  | "certified"
  | "expired";

interface AuditTrailEntry {
  action: string;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  description: string;
}

export class AuditorWorkflow {
  constructor(private payload: Payload) {}

  async submitCertificationForReview(
    certificationId: string,
    organisationId: string,
    userId: string,
  ): Promise<void> {
    // Verify certification exists and belongs to org
    const cert = await this.payload.findByID({
      collection: "carbon-trust-certifications",
      id: certificationId,
    });

    if (!cert || (cert.organisation as { id: string }).id !== organisationId) {
      throw new Error("Certification not found or access denied");
    }

    const currentStatus = cert.status as CertificationStatus;
    if (!["draft", "additional_info_requested"].includes(currentStatus)) {
      throw new Error(`Cannot submit certification in ${currentStatus} status`);
    }

    // Update certification to submitted
    await this.payload.update({
      collection: "carbon-trust-certifications",
      id: certificationId,
      data: {
        status: "submitted",
        submittedAt: new Date().toISOString(),
      },
    });

    // Log audit trail
    await this.logAuditTrail(
      certificationId,
      organisationId,
      userId,
      "certification_submitted",
      "certification",
      {
        before: currentStatus,
        after: "submitted",
      },
      "Organization submitted certification for auditor review",
    );
  }

  async assignAuditor(
    certificationId: string,
    organisationId: string,
    auditorName: string,
    auditorEmail: string,
    auditorUserId: string,
    assignedBy: string,
  ): Promise<void> {
    const cert = await this.payload.findByID({
      collection: "carbon-trust-certifications",
      id: certificationId,
    });

    if (!cert || (cert.organisation as { id: string }).id !== organisationId) {
      throw new Error("Certification not found or access denied");
    }

    await this.payload.update({
      collection: "carbon-trust-certifications",
      id: certificationId,
      data: {
        status: "under_review",
        auditor: {
          name: auditorName,
          email: auditorEmail,
          userId: auditorUserId,
        },
      },
    });

    await this.logAuditTrail(
      certificationId,
      organisationId,
      assignedBy,
      "auditor_assigned",
      "certification",
      {
        before: null,
        after: { name: auditorName, email: auditorEmail },
      },
      `Auditor ${auditorName} assigned to certification`,
    );
  }

  async reviewChecklistItem(
    checklistItemId: string,
    certificationId: string,
    organisationId: string,
    auditorId: string,
    feedback: string,
    approved: boolean,
  ): Promise<void> {
    const item = await this.payload.findByID({
      collection: "carbon-trust-checklist-items",
      id: checklistItemId,
    });

    if (!item || (item.certification as { id: string }).id !== certificationId) {
      throw new Error("Checklist item not found");
    }

    const newStatus = approved ? "approved" : "additional_info_requested";
    const currentStatus = item.status as ChecklistItemStatus;

    await this.payload.update({
      collection: "carbon-trust-checklist-items",
      id: checklistItemId,
      data: {
        status: newStatus,
        auditorFeedback: feedback,
        auditorApprovedAt: approved ? new Date().toISOString() : undefined,
      },
    });

    await this.logAuditTrail(
      certificationId,
      organisationId,
      auditorId,
      approved ? "checklist_item_approved" : "checklist_item_review_feedback",
      "checklist_item",
      {
        before: currentStatus,
        after: newStatus,
      },
      `${approved ? "Approved" : "Requested additional info for"} requirement: ${item.requirementName}`,
    );
  }

  async approveCertification(
    certificationId: string,
    organisationId: string,
    auditorId: string,
    reviewNotes?: string,
  ): Promise<void> {
    const cert = await this.payload.findByID({
      collection: "carbon-trust-certifications",
      id: certificationId,
    });

    if (!cert || (cert.organisation as { id: string }).id !== organisationId) {
      throw new Error("Certification not found or access denied");
    }

    const currentStatus = cert.status as CertificationStatus;

    // Verify all critical items are approved
    const checklistItems = await this.payload.find({
      collection: "carbon-trust-checklist-items",
      where: {
        certification: { equals: certificationId },
        severity: { in: ["critical", "high"] },
      },
      limit: 1000,
    });

    const allApproved = checklistItems.docs.every(
      (item) => item.status === "approved" || item.status === "not_applicable",
    );

    if (!allApproved) {
      throw new Error("Cannot approve: critical/high severity items still pending");
    }

    await this.payload.update({
      collection: "carbon-trust-certifications",
      id: certificationId,
      data: {
        status: "approved",
        approvedAt: new Date().toISOString(),
        reviewNotes,
      },
    });

    await this.logAuditTrail(
      certificationId,
      organisationId,
      auditorId,
      "certification_approved",
      "certification",
      {
        before: currentStatus,
        after: "approved",
      },
      "Auditor approved certification",
    );
  }

  async rejectCertification(
    certificationId: string,
    organisationId: string,
    auditorId: string,
    rejectionReason: string,
  ): Promise<void> {
    const cert = await this.payload.findByID({
      collection: "carbon-trust-certifications",
      id: certificationId,
    });

    if (!cert || (cert.organisation as { id: string }).id !== organisationId) {
      throw new Error("Certification not found or access denied");
    }

    const currentStatus = cert.status as CertificationStatus;

    await this.payload.update({
      collection: "carbon-trust-certifications",
      id: certificationId,
      data: {
        status: "rejected",
        rejectionReason,
      },
    });

    await this.logAuditTrail(
      certificationId,
      organisationId,
      auditorId,
      "certification_rejected",
      "certification",
      {
        before: currentStatus,
        after: "rejected",
      },
      `Certification rejected: ${rejectionReason}`,
    );
  }

  async calculateCompletionPercentage(certificationId: string): Promise<number> {
    const items = await this.payload.find({
      collection: "carbon-trust-checklist-items",
      where: {
        certification: { equals: certificationId },
      },
      limit: 1000,
    });

    if (items.docs.length === 0) return 0;

    const completed = items.docs.filter(
      (item) => item.status === "approved" || item.status === "not_applicable",
    ).length;

    return Math.round((completed / items.docs.length) * 100);
  }

  async getAuditTrail(
    certificationId: string,
    limit: number = 100,
  ): Promise<AuditTrailEntry[]> {
    const result = await this.payload.find({
      collection: "carbon-trust-audit-trail",
      where: {
        certification: { equals: certificationId },
      },
      sort: "-createdAt",
      limit,
    });

    return result.docs.map((entry) => ({
      action: entry.action as string,
      entityType: entry.entityType as string,
      entityId: entry.entityId as string,
      before: entry.before,
      after: entry.after,
      description: entry.description as string,
    }));
  }

  private async logAuditTrail(
    certificationId: string,
    organisationId: string,
    userId: string,
    action: string,
    entityType: string,
    changes: { before?: unknown; after?: unknown },
    description: string,
  ): Promise<void> {
    await this.payload.create({
      collection: "carbon-trust-audit-trail",
      data: {
        certification: certificationId,
        organisation: organisationId,
        actor: userId,
        action,
        entityType,
        entityId: certificationId,
        before: changes.before,
        after: changes.after,
        description,
      },
    });
  }
}

export function createAuditorWorkflow(payload: Payload): AuditorWorkflow {
  return new AuditorWorkflow(payload);
}
