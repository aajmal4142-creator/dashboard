/** Normalize for case-insensitive whitelist comparison. */
export function normalizeEmailAddress(raw: string): string {
  return raw.trim().toLowerCase();
}

/**
 * Extract bare address from `Name <user@host>` or plain `user@host`.
 */
export function extractEmailAddress(fromHeader: string): string {
  const angle = /<([^>]+)>/.exec(fromHeader);
  if (angle?.[1]) return normalizeEmailAddress(angle[1]);
  return normalizeEmailAddress(fromHeader);
}

/**
 * Only whitelisted senders may submit inbound CSVs.
 * Empty whitelist → reject all (fail closed).
 */
export function isSenderWhitelisted(
  fromHeader: string,
  whitelist: Array<string | { email?: string | null } | null | undefined>,
): boolean {
  const sender = extractEmailAddress(fromHeader);
  if (!sender || !sender.includes("@")) return false;

  const allowed = new Set<string>();
  for (const entry of whitelist) {
    if (!entry) continue;
    const email = typeof entry === "string" ? entry : entry.email;
    if (email?.trim()) allowed.add(normalizeEmailAddress(email));
  }
  if (allowed.size === 0) return false;
  return allowed.has(sender);
}
