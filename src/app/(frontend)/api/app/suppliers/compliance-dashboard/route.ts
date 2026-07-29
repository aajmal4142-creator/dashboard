import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import { requirePermission } from "@/lib/policy/protect";
import {
  getResponseStatus,
  detectIssues,
  calculateComplianceScore,
  calculateOrgComplianceSummary,
  identifyRemindersNeeded,
  SLA_TARGETS,
} from "@/lib/suppliers/complianceTracker";
import config from "@/payload.config";

export async function GET() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) {
    return NextResponse.json({ error: "No active organisation" }, { status: 403 });
  }

  const allowed = await requirePermission(
    ctx.user.id,
    ctx.activeOrg.id,
    "view",
    "supplier",
    ctx.activeOrg.id,
    "organisation",
  );
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = await getPayload({ config });
  const suppliers = await payload.find({
    collection: "suppliers",
    where: { organisation: { equals: ctx.activeOrg.id } },
    limit: 500,
    sort: "-updatedAt",
    overrideAccess: true,
  });

  // Build compliance data for each supplier
  const complianceData = suppliers.docs.map((s) => {
    const riskMetrics = s.riskMetrics as Record<string, unknown>;
    const esgData = s.esgData as Record<string, unknown>;

    const responseStatus = getResponseStatus(
      {
        respondedAt: s.respondedAt ? new Date(s.respondedAt) : undefined,
        sentAt: s.sentAt ? new Date(s.sentAt) : undefined,
        lastReminderAt: s.lastReminderAt ? new Date(s.lastReminderAt) : undefined,
      },
      SLA_TARGETS.tier_1 || 30,
    );

    const rawTier = riskMetrics?.tier;
    const riskTier =
      rawTier === "low" ||
      rawTier === "medium" ||
      rawTier === "high" ||
      rawTier === "critical"
        ? rawTier
        : undefined;

    const rawCerts = esgData?.certifications;
    const certifications = Array.isArray(rawCerts)
      ? rawCerts.map((cert) => {
          if (cert && typeof cert === "object" && "expiryDate" in cert) {
            const expiry = (cert as { expiryDate?: unknown }).expiryDate;
            return {
              expiryDate: typeof expiry === "string" ? expiry : undefined,
            };
          }
          return {};
        })
      : [];

    const issues = detectIssues({
      id: String(s.id),
      name: s.name,
      riskScore: typeof riskMetrics?.score === "number" ? riskMetrics.score : undefined,
      riskTier,
      dataCompleteness:
        typeof esgData?.dataCompletionPercent === "number"
          ? esgData.dataCompletionPercent
          : 0,
      unGcSignatory: Boolean(esgData?.unGcSignatory),
      certifications,
      lastDataUpdateAt: esgData?.lastDataUpdateAt
        ? new Date(String(esgData.lastDataUpdateAt))
        : undefined,
      respondedAt: s.respondedAt ? new Date(s.respondedAt) : undefined,
      sentAt: s.sentAt ? new Date(s.sentAt) : undefined,
    });

    const dataCompleteness =
      typeof esgData?.dataCompletionPercent === "number"
        ? esgData.dataCompletionPercent
        : 0;

    const complianceScore = calculateComplianceScore({
      responseStatus,
      dataCompleteness,
      issueCount: issues.length,
    });

    return {
      id: String(s.id),
      name: s.name,
      category: s.category,
      annualSpend: s.annualSpend,
      responseStatus,
      dataCompleteness,
      complianceScore,
      issueCount: issues.length,
      issues: issues.map((i) => ({
        type: i.type,
        severity: i.severity,
        message: i.message,
      })),
      lastDataUpdate: esgData?.lastDataUpdateAt
        ? new Date(String(esgData.lastDataUpdateAt))
        : null,
      respondedAt: s.respondedAt ? new Date(s.respondedAt) : null,
      sentAt: s.sentAt ? new Date(s.sentAt) : null,
      daysSinceContact: s.sentAt
        ? Math.floor(
            (new Date().getTime() - new Date(s.sentAt).getTime()) / (1000 * 60 * 60 * 24),
          )
        : null,
    };
  });

  const summary = calculateOrgComplianceSummary(
    complianceData.map((s) => ({
      supplierId: s.id,
      supplierName: s.name,
      lastDataUpdate: s.lastDataUpdate,
      lastResponseDate: s.respondedAt,
      lastContacted: s.sentAt,
      responseStatus: s.responseStatus,
      dataCompleteness: s.dataCompleteness,
      issueCount: s.issueCount,
      flags: s.issues.map((i) => i.type),
    })),
  );

  const reminders = identifyRemindersNeeded(
    complianceData.map((s) => ({
      id: s.id,
      name: s.name,
      lastContacted: s.sentAt ?? undefined,
      responseStatus: s.responseStatus,
    })),
  );

  return NextResponse.json({
    suppliers: complianceData,
    summary,
    reminders,
  });
}
