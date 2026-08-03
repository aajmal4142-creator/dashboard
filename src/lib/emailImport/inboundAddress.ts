/**
 * Build the public inbound address / subject token for a collection form.
 * Domain defaults to inbound.clearesg.com when EMAIL_IMPORT_INBOUND_DOMAIN is unset.
 */

export function getInboundEmailDomain(): string {
  const fromEnv = process.env.EMAIL_IMPORT_INBOUND_DOMAIN?.trim();
  return fromEnv && fromEnv.length > 0 ? fromEnv : "inbound.clearesg.com";
}

export function buildInboundAddress(token: string): string {
  const clean = token.trim();
  if (!clean) return "";
  return `import+${clean}@${getInboundEmailDomain()}`;
}

export function buildSubjectTokenHint(token: string): string {
  const clean = token.trim();
  if (!clean) return "";
  return `[ClearESG:${clean}]`;
}
