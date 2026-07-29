import { randomBytes } from "node:crypto";
import type { Payload } from "payload";
import type { Report } from "@/payload-types";

/**
 * Batch ensure assurance tokens for multiple reports.
 * Optimized to avoid N+1 updates.
 */
export async function ensureAssuranceTokens(
  payload: Payload,
  reports: Report[],
): Promise<Map<string, string | null>> {
  const result = new Map<string, string | null>();

  // Reports that need token generation
  const needsToken = reports.filter((r) => r.status === "published" && !r.assuranceToken);

  // Generate tokens for all at once
  const updates = needsToken.map(async (r) => {
    const token = randomBytes(18).toString("base64url");
    await payload.update({
      collection: "reports",
      id: r.id,
      data: { assuranceToken: token },
      overrideAccess: true,
    });
    return { reportId: r.id, token };
  });

  // Execute updates in parallel
  const updated = await Promise.all(updates);
  const tokenMap = new Map(updated.map((u) => [u.reportId, u.token]));

  // Build final result
  for (const r of reports) {
    if (r.status !== "published") {
      result.set(r.id, null);
    } else if (r.assuranceToken) {
      result.set(r.id, r.assuranceToken);
    } else {
      result.set(r.id, tokenMap.get(r.id) ?? null);
    }
  }

  return result;
}
