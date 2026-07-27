import { randomBytes } from "node:crypto";

import type { Payload } from "payload";

import type { Report } from "@/payload-types";

/**
 * Published reports created before Phase 4 lack assuranceToken.
 * Mint once so Reports + /a/[token] share the same frozen snapshot.
 */
export async function ensureAssuranceToken(
  payload: Payload,
  report: Report,
): Promise<string | null> {
  if (report.status !== "published") return report.assuranceToken ?? null;
  if (report.assuranceToken) return report.assuranceToken;

  const assuranceToken = randomBytes(18).toString("base64url");
  await payload.update({
    collection: "reports",
    id: report.id,
    data: { assuranceToken },
    overrideAccess: true,
  });
  return assuranceToken;
}
