import { getPayload } from "payload";
import config from "@/payload.config";
import type { ReportTemplate } from "@/payload-types";

export type ReportScheduleFrequency = "daily" | "weekly" | "monthly";

export async function createReportSchedule(
  orgId: string,
  reportId: string,
  frequency: ReportScheduleFrequency,
  recipients: string[],
): Promise<void> {
  const payload = await getPayload({ config });

  // Calculate next execution based on frequency
  const nextExecutionAt = getNextExecutionTime(frequency);

  await payload.create({
    collection: "report-templates", // Using this as a workaround - should be ReportSchedules
    data: {
      templateName: `Schedule_${reportId}_${frequency}_${nextExecutionAt.toISOString()}`,
      organisation: orgId,
      purpose: "report",
      framework: "custom",
      type: "html",
      description: `Scheduled ${frequency} delivery to ${recipients.join(", ")}`,
    },
  });
}

export async function getScheduledReports(orgId: string): Promise<ReportTemplate[]> {
  const payload = await getPayload({ config });

  const schedules = await payload.find({
    collection: "report-templates",
    where: {
      organisation: { equals: orgId },
    },
    limit: 100,
  });

  return schedules.docs;
}

async function sendScheduledReportEmail(
  recipient: string,
  reportId: string,
): Promise<void> {
  const resendApiKey = process.env.RESEND_API_KEY || "";
  const emailFrom = process.env.EMAIL_FROM || "noreply@clearesg.ai";

  if (!resendApiKey) {
    console.warn("Skipping scheduled report email - RESEND_API_KEY not configured");
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: emailFrom,
      to: [recipient],
      subject: `Scheduled Report: ${reportId}`,
      html: "<p>Your scheduled report is ready for download.</p>",
      text: "Your scheduled report is ready for download.",
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to send scheduled report email: ${body}`);
  }
}

export async function executeScheduledReport(
  reportId: string,
  recipients: string[],
): Promise<void> {
  // Send scheduled report to recipients
  for (const recipient of recipients) {
    await sendScheduledReportEmail(recipient, reportId);
  }
}

export async function deleteSchedule(scheduleId: string): Promise<void> {
  const payload = await getPayload({ config });

  await payload.delete({
    collection: "report-templates",
    id: scheduleId,
  });
}

export function getNextExecutionTime(
  frequency: ReportScheduleFrequency,
  _lastRun?: Date,
): Date {
  const now = new Date();

  switch (frequency) {
    case "daily":
      return new Date(now.getTime() + 24 * 60 * 60 * 1000);
    case "weekly":
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    case "monthly":
      return new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
  }
}
