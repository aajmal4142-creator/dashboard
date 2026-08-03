/**
 * Optional bridge into datapoint approval (F13).
 * Internal-request reviewStatus is independent — this only suggests a follow-up
 * call into `/api/app/datapoints/approve` when F13 is present. Does not mutate
 * datapoint approvalState itself.
 */
export type DatapointApprovalHook = {
  organisationId: string;
  periodId: string;
  metricKeys: string[];
  reviewStatus: "approved" | "rejected";
  reason?: string;
};

/**
 * Returns a descriptive payload for the caller / future worker.
 * Intentionally a no-op side-effect helper — F13 owns the state machine.
 */
export function buildDatapointApprovalFollowUp(input: DatapointApprovalHook): {
  action: "noop_hook";
  suggestedEndpoint: "/api/app/datapoints/approve";
  hint: string;
  metricKeys: string[];
  organisationId: string;
  periodId: string;
  reviewStatus: "approved" | "rejected";
  reason?: string;
} {
  return {
    action: "noop_hook",
    suggestedEndpoint: "/api/app/datapoints/approve",
    hint: "Request review recorded. Call datapoint approve/reject per metric when F13 wiring is enabled.",
    metricKeys: input.metricKeys,
    organisationId: input.organisationId,
    periodId: input.periodId,
    reviewStatus: input.reviewStatus,
    reason: input.reason,
  };
}
