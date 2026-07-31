import type { Payload } from "payload";

import { writeAuditLog } from "@/lib/audit/write";

import { runAutomationActions } from "./actions";
import { cronMatches, sameCronMinute } from "./cronMatch";
import { matchAutomationRule } from "./match";
import {
  mapAutomationDoc,
  normalizeActions,
  normalizeConditions,
  orgIdFromDoc,
} from "./query";
import { createAutomationRun, findAutomations, updateAutomation } from "./store";
import type {
  ActionRunResult,
  AutomationDoc,
  AutomationEventContext,
  AutomationRunStatus,
  AutomationSummary,
  AutomationTriggerType,
} from "./types";

export type AutomationEngineResult = {
  automationId: string;
  name: string;
  matched: boolean;
  skipped: "disabled" | "trigger" | "conditions" | null;
  reason: string;
  status: AutomationRunStatus;
  actionsRun: ActionRunResult[];
  actionsSkipped: ActionRunResult[];
};

export type RunAutomationsResult = {
  evaluated: number;
  matched: number;
  results: AutomationEngineResult[];
};

function deriveStatus(
  matched: boolean,
  run: ActionRunResult[],
  skipped: ActionRunResult[],
): AutomationRunStatus {
  if (!matched) return "skipped";
  if (run.length === 0 && skipped.length > 0) return "failed";
  if (run.length > 0 && skipped.length > 0) return "partial";
  if (run.length > 0) return "success";
  return "failed";
}

async function processAutomation(args: {
  payload: Payload;
  doc: AutomationDoc;
  event: AutomationEventContext;
  actorId?: string | null;
  dryRun?: boolean;
}): Promise<AutomationEngineResult> {
  const name = (args.doc.name ?? "").trim() || "Untitled";
  const summary = mapAutomationDoc(args.doc);

  if (args.doc.enabled === false) {
    return {
      automationId: args.doc.id,
      name,
      matched: false,
      skipped: "disabled",
      reason: "Automation disabled.",
      status: "skipped",
      actionsRun: [],
      actionsSkipped: [],
    };
  }

  const triggerType = summary?.triggerType ?? args.doc.triggerType;
  if (
    triggerType !== "datapoint_approved" &&
    triggerType !== "alert_triggered" &&
    triggerType !== "schedule"
  ) {
    return {
      automationId: args.doc.id,
      name,
      matched: false,
      skipped: "trigger",
      reason: "Invalid trigger type.",
      status: "skipped",
      actionsRun: [],
      actionsSkipped: [],
    };
  }

  const conditions = normalizeConditions(args.doc.conditions);
  const match = matchAutomationRule({
    triggerType,
    conditions,
    event: args.event,
  });

  if (!match.matched) {
    const skippedKind =
      match.reason.includes("Trigger") && match.reason.includes("≠")
        ? "trigger"
        : "conditions";
    return {
      automationId: args.doc.id,
      name,
      matched: false,
      skipped: skippedKind,
      reason: match.reason,
      status: "skipped",
      actionsRun: [],
      actionsSkipped: [],
    };
  }

  const actions = normalizeActions(args.doc.actions);
  if (actions.length === 0) {
    return {
      automationId: args.doc.id,
      name,
      matched: true,
      skipped: null,
      reason: match.reason,
      status: "failed",
      actionsRun: [],
      actionsSkipped: [
        {
          type: "create_notification",
          ok: false,
          detail: "No valid actions configured.",
        },
      ],
    };
  }

  if (args.dryRun) {
    return {
      automationId: args.doc.id,
      name,
      matched: true,
      skipped: null,
      reason: `Dry run: ${match.reason}`,
      status: "success",
      actionsRun: actions.map((a) => ({
        type: a.type,
        ok: true,
        detail: "Would run (dry run)",
      })),
      actionsSkipped: [],
    };
  }

  const actionResult = await runAutomationActions({
    payload: args.payload,
    automationId: args.doc.id,
    automationName: name,
    organisationId: args.event.organisationId,
    actions,
    event: args.event,
  });

  const status = deriveStatus(true, actionResult.run, actionResult.skipped);
  const now = new Date().toISOString();
  const nextCount = (typeof args.doc.runCount === "number" ? args.doc.runCount : 0) + 1;

  try {
    await updateAutomation(args.payload, args.doc.id, {
      runCount: nextCount,
      lastRunAt: now,
      lastRunStatus: status,
    });
  } catch (err) {
    console.error("[automations] update run stats failed", err);
  }

  try {
    await createAutomationRun(args.payload, {
      organisation: args.event.organisationId,
      automation: args.doc.id,
      triggerType: args.event.triggerType,
      status,
      matched: true,
      actionsRun: actionResult.run,
      actionsSkipped: actionResult.skipped,
      context: {
        summary: args.event.summary,
        fields: args.event.fields,
        resourceType: args.event.resourceType,
        resourceId: args.event.resourceId,
      },
    });
  } catch (err) {
    console.error("[automations] create run log failed", err);
  }

  try {
    await writeAuditLog(args.payload, {
      organisationId: args.event.organisationId,
      actorId: args.actorId ?? null,
      action: "automation.ran",
      entityType: "automation",
      entityId: args.doc.id,
      after: {
        reason: match.reason,
        status,
        actionsRun: actionResult.run,
        actionsSkipped: actionResult.skipped,
      },
    });
  } catch (err) {
    console.error("[automations] audit log failed", err);
  }

  return {
    automationId: args.doc.id,
    name,
    matched: true,
    skipped: null,
    reason: match.reason,
    status,
    actionsRun: actionResult.run,
    actionsSkipped: actionResult.skipped,
  };
}

/**
 * Evaluate enabled org automations for an event and run matching actions.
 * Never throws to callers — logs internally.
 */
export async function runAutomationsForEvent(
  payload: Payload,
  event: AutomationEventContext,
  options?: {
    automationIds?: string[];
    actorId?: string | null;
    dryRun?: boolean;
  },
): Promise<RunAutomationsResult> {
  try {
    const listed = await findAutomations(payload, {
      where: {
        and: [
          { organisation: { equals: event.organisationId } },
          { triggerType: { equals: event.triggerType } },
        ],
      },
      sort: "-updatedAt",
      limit: 200,
    });

    let docs = listed.docs;
    if (options?.automationIds?.length) {
      const want = new Set(options.automationIds);
      docs = docs.filter((d) => want.has(d.id));
    }

    const results: AutomationEngineResult[] = [];
    let matched = 0;

    for (const doc of docs) {
      if (orgIdFromDoc(doc) !== event.organisationId) continue;
      const result = await processAutomation({
        payload,
        doc,
        event,
        actorId: options?.actorId,
        dryRun: options?.dryRun,
      });
      if (result.matched) matched += 1;
      results.push(result);
    }

    return {
      evaluated: results.length,
      matched,
      results,
    };
  } catch (err) {
    console.error("[automations] engine failed", err);
    return { evaluated: 0, matched: 0, results: [] };
  }
}

/**
 * Run enabled schedule-trigger automations whose cronExpression matches `now`.
 * Debounces to at most one run per calendar minute via lastRunAt.
 */
export async function runScheduledAutomations(
  payload: Payload,
  organisationId: string,
  options?: { actorId?: string | null; dryRun?: boolean; now?: Date },
): Promise<RunAutomationsResult> {
  const now = options?.now ?? new Date();
  const listed = await findAutomations(payload, {
    where: {
      and: [
        { organisation: { equals: organisationId } },
        { triggerType: { equals: "schedule" } },
        { enabled: { equals: true } },
      ],
    },
    limit: 200,
  });

  const results: AutomationEngineResult[] = [];
  let matched = 0;

  for (const doc of listed.docs) {
    const name = (doc.name ?? "").trim() || "Untitled";
    const cron = (doc.cronExpression ?? "").trim();

    if (!cron) {
      results.push({
        automationId: doc.id,
        name,
        matched: false,
        skipped: "trigger",
        reason: "No cronExpression configured.",
        status: "skipped",
        actionsRun: [],
        actionsSkipped: [],
      });
      continue;
    }

    if (!cronMatches(cron, now)) {
      results.push({
        automationId: doc.id,
        name,
        matched: false,
        skipped: "trigger",
        reason: `Cron '${cron}' does not match current time.`,
        status: "skipped",
        actionsRun: [],
        actionsSkipped: [],
      });
      continue;
    }

    if (sameCronMinute(doc.lastRunAt, now)) {
      results.push({
        automationId: doc.id,
        name,
        matched: false,
        skipped: "trigger",
        reason: "Already ran in this minute.",
        status: "skipped",
        actionsRun: [],
        actionsSkipped: [],
      });
      continue;
    }

    const event: AutomationEventContext = {
      triggerType: "schedule",
      organisationId,
      fields: {
        cron,
      },
      summary: `Scheduled automation '${name}' (${cron})`,
      resourceType: "automation",
      resourceId: doc.id,
    };

    const one = await processAutomation({
      payload,
      doc,
      event,
      actorId: options?.actorId,
      dryRun: options?.dryRun,
    });
    results.push(one);
    if (one.matched) matched += 1;
  }

  return {
    evaluated: results.length,
    matched,
    results,
  };
}

export function listMappedAutomations(docs: AutomationDoc[]): AutomationSummary[] {
  return docs
    .map((d) => mapAutomationDoc(d))
    .filter((r): r is AutomationSummary => r !== null);
}

export function buildDatapointApprovedEvent(args: {
  organisationId: string;
  datapointId: string;
  metricKey: string;
  value?: number | null;
  approvalState: string;
  actorName?: string;
}): AutomationEventContext {
  const metric = args.metricKey.trim() || "datapoint";
  return {
    triggerType: "datapoint_approved",
    organisationId: args.organisationId,
    fields: {
      metricKey: metric,
      status: args.approvalState,
      value: args.value ?? null,
      datapointId: args.datapointId,
    },
    summary: args.actorName
      ? `${args.actorName} approved '${metric}'`
      : `Datapoint '${metric}' approved`,
    resourceType: "datapoint",
    resourceId: args.datapointId,
  };
}

export function buildAlertTriggeredEvent(args: {
  organisationId: string;
  ruleId: string;
  ruleName: string;
  reason: string;
}): AutomationEventContext {
  return {
    triggerType: "alert_triggered",
    organisationId: args.organisationId,
    fields: {
      alertRuleId: args.ruleId,
      alertRuleName: args.ruleName,
      reason: args.reason,
    },
    summary: `Alert '${args.ruleName}': ${args.reason}`,
    resourceType: "alert",
    resourceId: args.ruleId,
  };
}

export type { AutomationTriggerType };
