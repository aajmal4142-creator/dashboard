import { sanitizeConnectorError } from "@/lib/database/encrypt";

/**
 * Redact secrets from provider / connector errors before logging or persisting.
 * Never log raw API tokens.
 */
export function sanitizeWorkTrackerError(err: unknown): string {
  const base = sanitizeConnectorError(err);
  return base
    .replace(/\bBearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/\bBasic\s+\S+/gi, "Basic [redacted]")
    .replace(
      /\b(token|api[_-]?key|apikey|password|secret|authorization)[=:\s]+\S+/gi,
      "$1=[redacted]",
    )
    .replace(/v1:[A-Za-z0-9+/=._-]+/g, "[redacted-ciphertext]")
    .slice(0, 500);
}
