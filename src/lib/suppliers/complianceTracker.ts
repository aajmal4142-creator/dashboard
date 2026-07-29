/**
 * Supplier Compliance Tracking & SLA Monitoring
 * Tracks data freshness, response rates, and issues
 */

export interface ComplianceStatus {
  supplierId: string;
  supplierName: string;
  lastDataUpdate: Date | null;
  lastResponseDate: Date | null;
  lastContacted: Date | null;
  responseStatus: "responded" | "pending" | "overdue" | "never_contacted";
  dataCompleteness: number; // 0-100
  issueCount: number;
  flags: string[];
}

export interface SLATarget {
  tier: string;
  targetDays: number;
}

export const SLA_TARGETS: Record<string, number> = {
  tier_1: 30,
  tier_2: 45,
  tier_3: 60,
  tier_4: 90,
};

/**
 * Determine response status based on dates
 */
export function getResponseStatus(
  supplier: {
    respondedAt?: Date;
    sentAt?: Date;
    lastReminderAt?: Date;
  },
  slaTargetDays: number,
): "responded" | "pending" | "overdue" | "never_contacted" {
  if (supplier.respondedAt) {
    return "responded";
  }

  if (!supplier.sentAt) {
    return "never_contacted";
  }

  const now = new Date();
  const daysSinceSent = Math.floor(
    (now.getTime() - supplier.sentAt.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (daysSinceSent > slaTargetDays) {
    return "overdue";
  }

  return "pending";
}

/**
 * Detect issues for a supplier
 */
export interface ComplianceIssue {
  type: string;
  severity: "low" | "medium" | "high" | "critical";
  message: string;
  recommendation: string;
}

export function detectIssues(supplier: {
  id: string;
  name: string;
  riskScore?: number;
  riskTier?: "low" | "medium" | "high" | "critical";
  dataCompleteness: number;
  unGcSignatory: boolean;
  certifications?: Array<{ expiryDate?: string }>;
  lastDataUpdateAt?: Date;
  respondedAt?: Date;
  sentAt?: Date;
}): ComplianceIssue[] {
  const issues: ComplianceIssue[] = [];
  const today = new Date();

  // High risk
  if (supplier.riskScore !== undefined && supplier.riskScore > 75) {
    issues.push({
      type: "high_risk",
      severity: "critical",
      message: `Supplier has critical risk score (${supplier.riskScore}/100)`,
      recommendation:
        "Escalate to procurement and sustainability teams for immediate engagement",
    });
  }

  // Missing data
  if (supplier.dataCompleteness < 30) {
    issues.push({
      type: "missing_data",
      severity: "high",
      message: `ESG data ${supplier.dataCompleteness}% complete`,
      recommendation:
        "Request complete questionnaire response with detailed emissions data",
    });
  }

  if (supplier.dataCompleteness < 50) {
    issues.push({
      type: "incomplete_data",
      severity: "medium",
      message: `ESG data only ${supplier.dataCompleteness}% complete`,
      recommendation: "Send follow-up questionnaire to fill data gaps",
    });
  }

  // Stale data
  if (supplier.lastDataUpdateAt) {
    const daysSinceUpdate = Math.floor(
      (today.getTime() - supplier.lastDataUpdateAt.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (daysSinceUpdate > 90) {
      issues.push({
        type: "stale_data",
        severity: "medium",
        message: `ESG data is ${daysSinceUpdate} days old`,
        recommendation: "Request updated data to ensure accuracy",
      });
    }
  }

  // Expired certifications
  if (supplier.certifications) {
    for (const cert of supplier.certifications) {
      if (cert.expiryDate) {
        const expiryDate = new Date(cert.expiryDate);
        const daysUntilExpiry = Math.floor(
          (expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
        );

        if (daysUntilExpiry < 0) {
          issues.push({
            type: "expired_cert",
            severity: "high",
            message: `Certification expired ${Math.abs(daysUntilExpiry)} days ago`,
            recommendation: "Request renewal of expired certification",
          });
        } else if (daysUntilExpiry < 30) {
          issues.push({
            type: "expiring_cert",
            severity: "medium",
            message: `Certification expires in ${daysUntilExpiry} days`,
            recommendation: "Proactively request renewal before expiration",
          });
        }
      }
    }
  }

  // Never contacted
  if (!supplier.respondedAt && !supplier.sentAt) {
    issues.push({
      type: "never_contacted",
      severity: "medium",
      message: "Supplier has never been contacted",
      recommendation: "Send initial questionnaire invitation",
    });
  }

  // Overdue response
  if (supplier.sentAt && !supplier.respondedAt) {
    const daysSinceSent = Math.floor(
      (today.getTime() - supplier.sentAt.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (daysSinceSent > 30) {
      issues.push({
        type: "overdue_response",
        severity: "high",
        message: `Response overdue for ${daysSinceSent} days`,
        recommendation: "Send escalation reminder, consider alternative contact method",
      });
    } else if (daysSinceSent > 14) {
      issues.push({
        type: "pending_response",
        severity: "medium",
        message: `Awaiting response for ${daysSinceSent} days`,
        recommendation: "Send friendly reminder if not recently contacted",
      });
    }
  }

  return issues;
}

/**
 * Calculate compliance score (0-100, higher = better)
 */
export function calculateComplianceScore(supplier: {
  responseStatus: "responded" | "pending" | "overdue" | "never_contacted";
  dataCompleteness: number;
  issueCount: number;
}): number {
  let score = 50; // Base score

  // Response status
  if (supplier.responseStatus === "responded") score += 25;
  else if (supplier.responseStatus === "pending") score += 10;
  else if (supplier.responseStatus === "overdue") score -= 10;
  else score -= 20;

  // Data completeness
  score += (supplier.dataCompleteness / 100) * 20;

  // Issues
  score -= Math.min(20, supplier.issueCount * 3);

  return Math.max(0, Math.min(100, score));
}

/**
 * Batch calculate compliance for all suppliers in org
 */
export interface ComplianceSummary {
  totalSuppliers: number;
  responded: number;
  pending: number;
  overdue: number;
  neverContacted: number;
  avgDataCompleteness: number;
  avgComplianceScore: number;
  suppliersWithIssues: number;
}

export function calculateOrgComplianceSummary(
  suppliers: ComplianceStatus[],
): ComplianceSummary {
  const total = suppliers.length;
  if (total === 0) {
    return {
      totalSuppliers: 0,
      responded: 0,
      pending: 0,
      overdue: 0,
      neverContacted: 0,
      avgDataCompleteness: 0,
      avgComplianceScore: 0,
      suppliersWithIssues: 0,
    };
  }

  const responded = suppliers.filter((s) => s.responseStatus === "responded").length;
  const pending = suppliers.filter((s) => s.responseStatus === "pending").length;
  const overdue = suppliers.filter((s) => s.responseStatus === "overdue").length;
  const neverContacted = suppliers.filter(
    (s) => s.responseStatus === "never_contacted",
  ).length;

  const avgDataCompleteness =
    suppliers.reduce((sum, s) => sum + s.dataCompleteness, 0) / total;
  const avgComplianceScore =
    suppliers.reduce((sum, s) => {
      return (
        sum +
        calculateComplianceScore({
          responseStatus: s.responseStatus,
          dataCompleteness: s.dataCompleteness,
          issueCount: s.issueCount,
        })
      );
    }, 0) / total;

  const suppliersWithIssues = suppliers.filter((s) => s.issueCount > 0).length;

  return {
    totalSuppliers: total,
    responded,
    pending,
    overdue,
    neverContacted,
    avgDataCompleteness: Math.round(avgDataCompleteness),
    avgComplianceScore: Math.round(avgComplianceScore),
    suppliersWithIssues,
  };
}

/**
 * Identify suppliers needing reminders
 */
export function identifyRemindersNeeded(
  suppliers: Array<{
    id: string;
    name: string;
    lastContacted?: Date;
    responseStatus: "responded" | "pending" | "overdue" | "never_contacted";
  }>,
): Array<{
  supplierId: string;
  supplierName: string;
  reminderType: "first" | "friendly" | "urgent";
  reason: string;
}> {
  const today = new Date();
  const reminders: Array<{
    supplierId: string;
    supplierName: string;
    reminderType: "first" | "friendly" | "urgent";
    reason: string;
  }> = [];

  for (const supplier of suppliers) {
    if (supplier.responseStatus === "responded") {
      continue; // No reminder needed
    }

    if (!supplier.lastContacted) {
      reminders.push({
        supplierId: supplier.id,
        supplierName: supplier.name,
        reminderType: "first",
        reason: "Never contacted - send initial invitation",
      });
      continue;
    }

    const daysSinceContact = Math.floor(
      (today.getTime() - supplier.lastContacted.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (daysSinceContact >= 30) {
      reminders.push({
        supplierId: supplier.id,
        supplierName: supplier.name,
        reminderType: "urgent",
        reason: `No response for ${daysSinceContact} days - send urgent reminder`,
      });
    } else if (daysSinceContact >= 21) {
      reminders.push({
        supplierId: supplier.id,
        supplierName: supplier.name,
        reminderType: "friendly",
        reason: `Awaiting response for ${daysSinceContact} days - send friendly reminder`,
      });
    } else if (daysSinceContact >= 14) {
      reminders.push({
        supplierId: supplier.id,
        supplierName: supplier.name,
        reminderType: "friendly",
        reason: `Pending for ${daysSinceContact} days - consider follow-up`,
      });
    }
  }

  return reminders;
}
