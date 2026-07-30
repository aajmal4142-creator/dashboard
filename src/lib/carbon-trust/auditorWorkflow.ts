import type { Payload } from "payload";
import {
  generateCertificatePDF,
  generateCertificateNumber,
} from "./certificateGenerator";
import { randomUUID } from "crypto";

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

    await this.payload.update({
      collection: "carbon-trust-certifications",
      id: certificationId,
      data: {
        status: "submitted",
        submittedAt: new Date().toISOString(),
      },
    });

    await this.logAuditTrail(
      certificationId,
      organisationId,
      userId,
      "certification_submitted",
      "certification",
      { before: currentStatus, after: "submitted" },
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
        auditor: { name: auditorName, email: auditorEmail, userId: auditorUserId },
      },
    });

    await this.logAuditTrail(
      certificationId,
      organisationId,
      assignedBy,
      "auditor_assigned",
      "certification",
      { before: null, after: { name: auditorName, email: auditorEmail } },
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
      { before: currentStatus, after: newStatus },
      `${approved ? "Approved" : "Requested additional info for"} requirement: ${item.requirementName}`,
    );
  }

  async requestAdditionalInfo(
    checklistItemId: string,
    certificationId: string,
    organisationId: string,
    auditorId: string,
    reason: string,
  ): Promise<void> {
    await this.reviewChecklistItem(
      checklistItemId,
      certificationId,
      organisationId,
      auditorId,
      reason,
      false,
    );
  }

  async batchApproveItems(
    certificationId: string,
    itemIds: string[],
    organisationId: string,
    auditorId: string,
  ): Promise<void> {
    for (const itemId of itemIds) {
      const item = await this.payload.findByID({
        collection: "carbon-trust-checklist-items",
        id: itemId,
      });

      if ((item.certification as { id: string }).id === certificationId) {
        await this.payload.update({
          collection: "carbon-trust-checklist-items",
          id: itemId,
          data: {
            status: "approved",
            auditorApprovedAt: new Date().toISOString(),
            auditorFeedback: "Approved by auditor (batch operation)",
          },
        });
      }
    }

    await this.logAuditTrail(
      certificationId,
      organisationId,
      auditorId,
      "batch_items_approved",
      "certification",
      { before: null, after: { count: itemIds.length } },
      `Batch approved ${itemIds.length} items`,
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
      { before: currentStatus, after: "approved" },
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
      data: { status: "rejected", rejectionReason },
    });

    await this.logAuditTrail(
      certificationId,
      organisationId,
      auditorId,
      "certification_rejected",
      "certification",
      { before: currentStatus, after: "rejected" },
      `Certification rejected: ${rejectionReason}`,
    );
  }

  async finalizeCertification(
    certificationId: string,
    organisationId: string,
    auditorId: string,
  ): Promise<string> {
    const cert = await this.payload.findByID({
      collection: "carbon-trust-certifications",
      id: certificationId,
    });

    if (!cert || (cert.organisation as { id: string }).id !== organisationId) {
      throw new Error("Certification not found or access denied");
    }

    if (cert.status !== "approved") {
      throw new Error("Only approved certifications can be finalized");
    }

    const org = await this.payload.findByID({
      collection: "organisations",
      id: organisationId,
    });

    const certificateNumber = generateCertificateNumber(organisationId, new Date());
    const verificationToken = randomUUID();
    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt);
    expiresAt.setFullYear(expiresAt.getFullYear() + 3);

    await generateCertificatePDF({
      certificateNumber,
      organisationName: org.name,
      issuedDate: issuedAt,
      expiresDate: expiresAt,
      scope: "all",
      auditorName: (cert.auditor as { name?: string })?.name || "ClearESG Auditor",
      baselineYear: new Date().getFullYear() - 1,
      verifiedEmissions: 0,
    });

    await this.payload.create({
      collection: "carbon-trust-certificates",
      data: {
        organisation: organisationId,
        certification: certificationId,
        certificateNumber,
        issuedAt: issuedAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
        status: "active",
        verificationToken,
        verificationUrl: `/verify-certificate/${verificationToken}`,
        scope: "all",
        publiclyListed: true,
        createdBy: auditorId,
        pdfUrl: `https://certificates.clearesg.local/${certificateNumber}.pdf`,
        pdfS3Key: `certificates/${certificateNumber}.pdf`,
      },
    });

    await this.payload.update({
      collection: "carbon-trust-certifications",
      id: certificationId,
      data: {
        status: "certified",
        validityPeriod: {
          issuedAt: issuedAt.toISOString(),
          expiresAt: expiresAt.toISOString(),
        },
      },
    });

    await this.logAuditTrail(
      certificationId,
      organisationId,
      auditorId,
      "certified",
      "certification",
      { before: "approved", after: "certified" },
      `Certificate finalized: ${certificateNumber}. Audit trail locked.`,
    );

    return certificateNumber;
  }

  async calculateCompletionPercentage(certificationId: string): Promise<number> {
    const items = await this.payload.find({
      collection: "carbon-trust-checklist-items",
      where: { certification: { equals: certificationId } },
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
      where: { certification: { equals: certificationId } },
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
    changes: {
      before?: { [k: string]: unknown } | unknown[] | string | number | boolean | null;
      after?: { [k: string]: unknown } | unknown[] | string | number | boolean | null;
    },
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
