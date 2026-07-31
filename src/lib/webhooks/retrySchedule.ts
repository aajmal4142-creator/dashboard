/**
 * Pure retry-schedule helpers for outbound webhook delivery.
 * Zero I/O — safe for Vitest without Payload/Next.
 */

export const DEFAULT_WEBHOOK_MAX_RETRIES = 3;
export const DEFAULT_WEBHOOK_RETRY_DELAY_MS = 1000;
export const DEFAULT_WEBHOOK_TIMEOUT_MS = 30_000;

export type WebhookRetryPolicyResolved = {
  maxRetries: number;
  retryDelayMs: number;
  exponentialBackoff: boolean;
};

/**
 * Normalise stored retry_policy JSON (or missing) into a concrete policy.
 * maxRetries = retries after the first attempt (total attempts = maxRetries + 1).
 */
export function resolveRetryPolicy(raw: unknown): WebhookRetryPolicyResolved {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      maxRetries: DEFAULT_WEBHOOK_MAX_RETRIES,
      retryDelayMs: DEFAULT_WEBHOOK_RETRY_DELAY_MS,
      exponentialBackoff: true,
    };
  }
  const obj = raw as Record<string, unknown>;
  const maxRetries =
    typeof obj.maxRetries === "number" &&
    Number.isFinite(obj.maxRetries) &&
    obj.maxRetries >= 0
      ? Math.min(10, Math.floor(obj.maxRetries))
      : DEFAULT_WEBHOOK_MAX_RETRIES;
  const retryDelayMs =
    typeof obj.retryDelayMs === "number" &&
    Number.isFinite(obj.retryDelayMs) &&
    obj.retryDelayMs >= 0
      ? Math.min(120_000, Math.floor(obj.retryDelayMs))
      : DEFAULT_WEBHOOK_RETRY_DELAY_MS;
  const exponentialBackoff =
    typeof obj.exponentialBackoff === "boolean" ? obj.exponentialBackoff : true;
  return { maxRetries, retryDelayMs, exponentialBackoff };
}

/**
 * Backoff after a failed attempt.
 * attemptNumber is 1-based (the attempt that just failed).
 * attempt 1 → delayMs, 2 → 2×, 3 → 4× when exponential.
 */
export function computeRetryBackoffMs(
  attemptNumber: number,
  policy: Pick<WebhookRetryPolicyResolved, "retryDelayMs" | "exponentialBackoff">,
): number {
  const n = Math.max(1, Math.floor(attemptNumber));
  if (!policy.exponentialBackoff) return policy.retryDelayMs;
  return policy.retryDelayMs * Math.pow(2, n - 1);
}

/** Total HTTP attempts including the initial try. */
export function totalAttemptsFromPolicy(
  policy: Pick<WebhookRetryPolicyResolved, "maxRetries">,
): number {
  return Math.max(1, policy.maxRetries + 1);
}

/** True when another attempt should run after this failed attemptNumber. */
export function shouldRetryAfterAttempt(
  attemptNumber: number,
  policy: Pick<WebhookRetryPolicyResolved, "maxRetries">,
): boolean {
  return attemptNumber < totalAttemptsFromPolicy(policy);
}

/** ISO timestamp for the next scheduled retry after a failed attempt. */
export function computeNextRetryAtIso(
  attemptNumber: number,
  policy: Pick<WebhookRetryPolicyResolved, "retryDelayMs" | "exponentialBackoff">,
  nowMs: number = Date.now(),
): string {
  const delayMs = computeRetryBackoffMs(attemptNumber, policy);
  return new Date(nowMs + delayMs).toISOString();
}

/** Dead-letter = terminal failed delivery (exhausted retries). */
export function isDeadLetterStatus(status: string): boolean {
  return status === "failed";
}

/**
 * Build the ordered delay schedule (ms) between attempts for display/tests.
 * Length = maxRetries (delays after each failed attempt before the next).
 */
export function buildRetryDelaySchedule(policy: WebhookRetryPolicyResolved): number[] {
  const delays: number[] = [];
  for (let attempt = 1; attempt <= policy.maxRetries; attempt++) {
    delays.push(computeRetryBackoffMs(attempt, policy));
  }
  return delays;
}
