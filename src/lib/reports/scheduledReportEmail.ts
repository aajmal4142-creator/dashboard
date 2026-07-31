/**
 * Email template + send helper for scheduled report deliveries.
 */

import {
  sendTransactionalEmail,
  type SendEmailAttachment,
  type SendEmailResult,
} from "@/lib/email/send";
import { frameworkLabel } from "@/lib/ui/displayLabels";

export type ScheduledReportEmailInput = {
  to: string;
  orgName: string;
  framework: string;
  periodLabel: string;
  reportDate: Date;
  liveReportUrl: string | null;
  attachment: SendEmailAttachment;
};

export function buildScheduledReportSubject(input: {
  orgName: string;
  framework: string;
  reportDate: Date;
}): string {
  const dateStr = formatDateUtc(input.reportDate);
  const framework = frameworkLabel(input.framework);
  return `[ClearESG] ${framework} Report - ${input.orgName} - ${dateStr}`;
}

export function buildScheduledReportEmailBody(input: {
  orgName: string;
  framework: string;
  periodLabel: string;
  liveReportUrl: string | null;
}): { html: string; text: string } {
  const framework = frameworkLabel(input.framework);
  const linkLine = input.liveReportUrl
    ? `Live report: ${input.liveReportUrl}`
    : "Live report link is unavailable for this version.";

  const text = [
    `${input.orgName}`,
    "",
    `Your scheduled ${framework} report is attached.`,
    `Reporting period: ${input.periodLabel}`,
    linkLine,
    "",
    "—",
    "This message was sent by a ClearESG scheduled delivery.",
  ].join("\n");

  const linkHtml = input.liveReportUrl
    ? `<p><a href="${escapeHtml(input.liveReportUrl)}">Open live report</a></p>`
    : `<p>Live report link is unavailable for this version.</p>`;

  const html = `
<div style="font-family: Georgia, 'Times New Roman', serif; color: #1a1814; line-height: 1.5;">
  <p style="margin: 0 0 12px; font-size: 18px;">${escapeHtml(input.orgName)}</p>
  <p style="margin: 0 0 8px;">Your scheduled ${escapeHtml(framework)} report is attached.</p>
  <p style="margin: 0 0 8px;">Reporting period: ${escapeHtml(input.periodLabel)}</p>
  ${linkHtml}
  <hr style="border: none; border-top: 1px solid #d4cfc4; margin: 24px 0 12px;" />
  <p style="margin: 0; font-size: 12px; color: #6b6560;">
    This message was sent by a ClearESG scheduled delivery.
  </p>
</div>
`.trim();

  return { html, text };
}

export async function sendScheduledReportEmail(
  input: ScheduledReportEmailInput,
): Promise<SendEmailResult> {
  const subject = buildScheduledReportSubject({
    orgName: input.orgName,
    framework: input.framework,
    reportDate: input.reportDate,
  });
  const { html, text } = buildScheduledReportEmailBody({
    orgName: input.orgName,
    framework: input.framework,
    periodLabel: input.periodLabel,
    liveReportUrl: input.liveReportUrl,
  });

  return sendTransactionalEmail({
    to: input.to,
    subject,
    html,
    text,
    attachments: [input.attachment],
  });
}

function formatDateUtc(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
