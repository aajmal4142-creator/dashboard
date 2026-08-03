import type { Payload } from "payload";

import { sendTransactionalEmail } from "@/lib/email/send";
import { postAlertToSlack } from "@/lib/integrations/slack";
import { postAlertToTeams } from "@/lib/integrations/teams";
import { notifyOrganisationMembers } from "@/lib/notifications/createNotification";

import type { ActionRunResult, AutomationAction, AutomationEventContext } from "./types";

async function memberEmails(payload: Payload, organisationId: string): Promise<string[]> {
  const memberships = await payload.find({
    collection: "memberships",
    where: {
      and: [
        { organisation: { equals: organisationId } },
        { status: { equals: "active" } },
      ],
    },
    limit: 100,
    depth: 1,
    overrideAccess: true,
  });

  const emails: string[] = [];
  for (const m of memberships.docs) {
    const user = m.user;
    if (user && typeof user === "object" && "email" in user) {
      const email = (user as { email?: string }).email;
      if (typeof email === "string" && email.includes("@") && !emails.includes(email)) {
        emails.push(email);
      }
    }
  }
  return emails;
}

async function fireWebhook(url: string, body: unknown): Promise<ActionRunResult> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "ClearESG-Automation/1.0",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      return {
        type: "fire_webhook",
        ok: false,
        detail: `HTTP ${res.status}`,
      };
    }
    return {
      type: "fire_webhook",
      ok: true,
      detail: `HTTP ${res.status}`,
    };
  } catch (err) {
    return {
      type: "fire_webhook",
      ok: false,
      detail: err instanceof Error ? err.message : "Webhook failed",
    };
  }
}

/**
 * Execute automation actions. Never throws — returns per-action results.
 */
export async function runAutomationActions(args: {
  payload: Payload;
  automationId: string;
  automationName: string;
  organisationId: string;
  actions: AutomationAction[];
  event: AutomationEventContext;
}): Promise<{ run: ActionRunResult[]; skipped: ActionRunResult[] }> {
  const run: ActionRunResult[] = [];
  const skipped: ActionRunResult[] = [];

  const defaultTitle = `Automation: ${args.automationName}`;
  const defaultMessage = args.event.summary;

  for (const action of args.actions) {
    const title = action.title?.trim() || defaultTitle;
    const message = action.message?.trim() || defaultMessage;

    if (action.type === "create_notification") {
      const count = await notifyOrganisationMembers(args.payload, {
        organisationId: args.organisationId,
        type: "alert_triggered",
        title,
        message,
        resourceType: args.event.resourceType ?? "automation",
        resourceId: args.event.resourceId ?? args.automationId,
      });
      run.push({
        type: "create_notification",
        ok: true,
        detail: `Notified ${count} member(s)`,
      });
      continue;
    }

    if (action.type === "send_email") {
      const recipients = action.emailTo
        ? [action.emailTo]
        : await memberEmails(args.payload, args.organisationId);
      if (recipients.length === 0) {
        skipped.push({
          type: "send_email",
          ok: false,
          detail: "No recipient emails found.",
        });
        continue;
      }
      let sent = 0;
      let failed = 0;
      for (const to of recipients) {
        const result = await sendTransactionalEmail({
          to,
          subject: `[ClearESG] ${title}`,
          html: `<p>${message}</p><p>Automation id: ${args.automationId}</p>`,
          text: `${message}\n\nAutomation id: ${args.automationId}`,
        });
        if (result.delivery === "failed") failed += 1;
        else sent += 1;
      }
      if (sent === 0) {
        skipped.push({
          type: "send_email",
          ok: false,
          detail: `Email failed for ${failed} recipient(s).`,
        });
      } else {
        run.push({
          type: "send_email",
          ok: true,
          detail: `Sent ${sent}; failed ${failed}`,
        });
      }
      continue;
    }

    if (action.type === "post_slack") {
      const slackResult = await postAlertToSlack(args.payload, {
        organisationId: args.organisationId,
        ruleName: args.automationName,
        reason: message,
        ruleId: args.automationId,
      });
      if (slackResult.posted) {
        run.push({
          type: "post_slack",
          ok: true,
          detail: `Posted to ${slackResult.channel}`,
        });
      } else {
        skipped.push({
          type: "post_slack",
          ok: false,
          detail: slackResult.reason,
        });
      }
      continue;
    }

    if (action.type === "post_teams") {
      const teamsResult = await postAlertToTeams(args.payload, {
        organisationId: args.organisationId,
        ruleName: args.automationName,
        reason: message,
        ruleId: args.automationId,
      });
      if (teamsResult.posted) {
        run.push({
          type: "post_teams",
          ok: true,
          detail: teamsResult.channelLabel
            ? `Posted to ${teamsResult.channelLabel}`
            : "Posted to Teams webhook",
        });
      } else {
        skipped.push({
          type: "post_teams",
          ok: false,
          detail: teamsResult.reason,
        });
      }
      continue;
    }

    if (action.type === "fire_webhook") {
      const url = action.webhookUrl?.trim();
      if (!url) {
        skipped.push({
          type: "fire_webhook",
          ok: false,
          detail: "webhookUrl missing.",
        });
        continue;
      }
      const result = await fireWebhook(url, {
        event: "automation.fired",
        automationId: args.automationId,
        automationName: args.automationName,
        organisationId: args.organisationId,
        triggerType: args.event.triggerType,
        summary: args.event.summary,
        fields: args.event.fields,
        resourceType: args.event.resourceType,
        resourceId: args.event.resourceId,
        at: new Date().toISOString(),
      });
      if (result.ok) run.push(result);
      else skipped.push(result);
    }
  }

  return { run, skipped };
}
