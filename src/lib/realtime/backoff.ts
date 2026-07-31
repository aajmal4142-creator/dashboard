/**
 * Exponential reconnect backoff for the dashboard stream client.
 * Pure — no I/O. Suitable for unit tests.
 */

export type BackoffOptions = {
  /** Initial delay in ms (default 1000) */
  initialMs?: number;
  /** Cap delay in ms (default 30_000) */
  maxMs?: number;
  /** Multiplier per attempt (default 2) */
  factor?: number;
  /** Random jitter fraction 0–1 applied as ±jitter (default 0.2) */
  jitter?: number;
  /** Optional RNG for deterministic tests */
  random?: () => number;
};

/**
 * Delay before attempt `attempt` (0-based: first reconnect → attempt 0).
 * Formula: min(maxMs, initialMs * factor^attempt) ± jitter.
 */
export function reconnectDelayMs(attempt: number, options: BackoffOptions = {}): number {
  const initialMs = options.initialMs ?? 1000;
  const maxMs = options.maxMs ?? 30_000;
  const factor = options.factor ?? 2;
  const jitter = options.jitter ?? 0.2;
  const random = options.random ?? Math.random;

  const safeAttempt = Math.max(0, Math.floor(attempt));
  const base = Math.min(maxMs, initialMs * factor ** safeAttempt);

  if (jitter <= 0) return Math.round(base);

  const spread = base * jitter;
  const offset = (random() * 2 - 1) * spread;
  return Math.max(0, Math.round(base + offset));
}

/** Next attempt index after a successful connection (resets to 0). */
export function resetAttempt(): number {
  return 0;
}

/** Increment attempt after a failed connection or unexpected close. */
export function nextAttempt(attempt: number): number {
  return Math.max(0, Math.floor(attempt)) + 1;
}
