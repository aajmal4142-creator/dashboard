/**
 * Fan-out helper for the alert-evaluation cron: find every organisation with
 * at least one enabled alert rule, then evaluate that org's rules.
 */
import type { Payload } from "payload";

import { orgIdFromDoc } from "./query";
import { findAlertRules } from "./store";
import { evaluateOrganisationAlerts } from "./trigger";

export type EvaluateAllOrganisationsResult = {
  organisations: number;
  results: Array<{
    organisationId: string;
    evaluated: number;
    triggered: number;
    error?: string;
  }>;
};

/**
 * Evaluate enabled alert rules for every organisation that has at least one.
 * Never throws for a single org's failure — records the error and continues.
 */
export async function evaluateAllOrganisationAlerts(
  payload: Payload,
  options?: { now?: Date },
): Promise<EvaluateAllOrganisationsResult> {
  const listed = await findAlertRules(payload, {
    where: { enabled: { equals: true } },
    limit: 500,
  });

  const orgIds = new Set<string>();
  for (const doc of listed.docs) {
    const orgId = orgIdFromDoc(doc);
    if (orgId) orgIds.add(orgId);
  }

  const results: EvaluateAllOrganisationsResult["results"] = [];

  for (const organisationId of orgIds) {
    try {
      const result = await evaluateOrganisationAlerts(payload, organisationId, {
        now: options?.now,
        actorId: null,
      });
      results.push({
        organisationId,
        evaluated: result.evaluated,
        triggered: result.triggered,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Alert evaluation failed";
      results.push({ organisationId, evaluated: 0, triggered: 0, error: message });
    }
  }

  return {
    organisations: orgIds.size,
    results,
  };
}
