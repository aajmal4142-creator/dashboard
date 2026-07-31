import type { Payload } from "payload";

import { writeAuditLog } from "@/lib/audit/write";
import { sendTransactionalEmail } from "@/lib/email/send";
import { postAlertToSlack } from "@/lib/integrations/slack";
import { notifyOrganisationMembers } from "@/lib/notifications/createNotification";

import { evaluateAlertCondition, isAlertMuted } from "./evaluate";
import { mapAlertRuleDoc, normalizeActions, normalizeCondition } from "./query";
import { loadMetricSeries, metricsNeededFromConditions } from "./series";
import { findAlertRules, updateAlertRule } from "./store";
import type { AlertAction, AlertRuleDoc, AlertRuleSummary, MetricSeries } from "./types";

export type TriggerRuleResult = {
  ruleId: string;
  name: string;
  triggered: boolean;
  skipped: "disabled" | "muted" | "no_condition" | null;
  reason: string;
  actionsRun: AlertAction[];
  actionsSkipped: Array<{ action: AlertAction; reason: string }>;
};

export type EvaluateAlertsResult = {
  evaluated: number;
  triggered: number;
  results: TriggerRuleResult[];
  rules: AlertRuleSummary[];
};

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

async function runActions(args: {
  payload: Payload;
  organisationId: string;
  rule: AlertRuleDoc;
  reason: string;
  actions: AlertAction[];
}): Promise<{
  run: AlertAction[];
  skipped: Array<{ action: AlertAction; reason: string }>;
}> {
  const run: AlertAction[] = [];
  const skipped: Array<{ action: AlertAction; reason: string }> = [];
  const title = `Alert: ${args.rule.name ?? "rule"}`;
  const message = args.reason;

  for (const action of args.actions) {
    if (action === "notify_user") {
      await notifyOrganisationMembers(args.payload, {
        organisationId: args.organisationId,
        type: "alert_triggered",
        title,
        message,
        resourceType: "alert",
        resourceId: args.rule.id,
      });
      run.push(action);
      continue;
    }

    if (action === "send_email") {
      const emails = await memberEmails(args.payload, args.organisationId);
      if (emails.length === 0) {
        skipped.push({ action, reason: "No member emails found." });
        continue;
      }
      for (const to of emails) {
        await sendTransactionalEmail({
          to,
          subject: `[ClearESG] ${title}`,
          html: `<p>${message}</p><p>Rule id: ${args.rule.id}</p>`,
          text: `${message}\n\nRule id: ${args.rule.id}`,
        });
      }
      run.push(action);
      continue;
    }

    if (action === "post_slack") {
      const slackResult = await postAlertToSlack(args.payload, {
        organisationId: args.organisationId,
        ruleName: args.rule.name ?? "rule",
        reason: message,
        ruleId: args.rule.id,
      });
      if (slackResult.posted) {
        run.push(action);
      } else {
        skipped.push({ action, reason: slackResult.reason });
      }
    }
  }

  return { run, skipped };
}

/**
 * Evaluate enabled org alert rules against metric series and fire actions.
 */
export async function evaluateOrganisationAlerts(
  payload: Payload,
  organisationId: string,
  options?: {
    seriesOverride?: MetricSeries[];
    ruleIds?: string[];
    now?: Date;
    actorId?: string | null;
  },
): Promise<EvaluateAlertsResult> {
  const now = options?.now ?? new Date();
  const listed = await findAlertRules(payload, {
    where: { organisation: { equals: organisationId } },
    sort: "-updatedAt",
    limit: 200,
  });

  let docs = listed.docs;
  if (options?.ruleIds?.length) {
    const want = new Set(options.ruleIds);
    docs = docs.filter((d) => want.has(d.id));
  }

  const conditions = docs
    .map((d) => normalizeCondition(d.condition))
    .filter((c): c is NonNullable<typeof c> => c !== null);

  const metrics = metricsNeededFromConditions(conditions);
  const series = await loadMetricSeries(
    payload,
    organisationId,
    metrics,
    options?.seriesOverride,
  );

  const results: TriggerRuleResult[] = [];
  let triggeredCount = 0;

  for (const doc of docs) {
    const name = doc.name ?? "Untitled";
    if (doc.enabled === false) {
      results.push({
        ruleId: doc.id,
        name,
        triggered: false,
        skipped: "disabled",
        reason: "Rule disabled.",
        actionsRun: [],
        actionsSkipped: [],
      });
      continue;
    }

    if (isAlertMuted(doc.muted === true, doc.mutedUntil, now)) {
      results.push({
        ruleId: doc.id,
        name,
        triggered: false,
        skipped: "muted",
        reason: "Rule muted.",
        actionsRun: [],
        actionsSkipped: [],
      });
      continue;
    }

    const condition = normalizeCondition(doc.condition);
    if (!condition) {
      results.push({
        ruleId: doc.id,
        name,
        triggered: false,
        skipped: "no_condition",
        reason: "Invalid condition.",
        actionsRun: [],
        actionsSkipped: [],
      });
      continue;
    }

    const evaluation = evaluateAlertCondition(condition, series);
    if (!evaluation.triggered) {
      results.push({
        ruleId: doc.id,
        name,
        triggered: false,
        skipped: null,
        reason: evaluation.reason,
        actionsRun: [],
        actionsSkipped: [],
      });
      continue;
    }

    const actions = normalizeActions(doc.actions);
    const actionResult = await runActions({
      payload,
      organisationId,
      rule: doc,
      reason: evaluation.reason,
      actions,
    });

    const nextCount =
      (typeof doc.triggeredCount === "number" ? doc.triggeredCount : 0) + 1;

    await updateAlertRule(payload, doc.id, {
      triggeredCount: nextCount,
      lastTriggeredAt: now.toISOString(),
      lastTriggeredMessage: evaluation.reason,
    });

    await writeAuditLog(payload, {
      organisationId,
      actorId: options?.actorId ?? null,
      action: "alert.triggered",
      entityType: "alert-rule",
      entityId: doc.id,
      after: {
        reason: evaluation.reason,
        actionsRun: actionResult.run,
        actionsSkipped: actionResult.skipped,
      },
    });

    try {
      const { buildAlertTriggeredEvent, runAutomationsForEvent } =
        await import("@/lib/automations");
      await runAutomationsForEvent(
        payload,
        buildAlertTriggeredEvent({
          organisationId,
          ruleId: doc.id,
          ruleName: name,
          reason: evaluation.reason,
        }),
        { actorId: options?.actorId },
      );
    } catch (err) {
      console.error("[alerts] automation hook failed", err);
    }

    triggeredCount += 1;
    results.push({
      ruleId: doc.id,
      name,
      triggered: true,
      skipped: null,
      reason: evaluation.reason,
      actionsRun: actionResult.run,
      actionsSkipped: actionResult.skipped,
    });
  }

  const refreshed = await findAlertRules(payload, {
    where: { organisation: { equals: organisationId } },
    sort: "-updatedAt",
    limit: 200,
  });

  const rules = refreshed.docs
    .map((d) => mapAlertRuleDoc(d, now))
    .filter((r): r is AlertRuleSummary => r !== null);

  return {
    evaluated: results.length,
    triggered: triggeredCount,
    results,
    rules,
  };
}
