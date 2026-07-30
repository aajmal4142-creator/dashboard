/**
 * Standalone seed for the assurance partner directory.
 *
 * Usage: pnpm seed:assurance-partners
 *
 * Idempotent — skips firms that already exist by firmName.
 * Demo contacts use @example.com; websites are public firm domains.
 */

import "dotenv/config";

import { getPayload } from "payload";

import { ensureAssurancePartners } from "../lib/assurancePartners";
import config from "../payload.config";

async function main() {
  const payload = await getPayload({ config });
  const result = await ensureAssurancePartners(payload);
  console.log(
    `Assurance partners seed: created ${result.created.length}, existing ${result.existing.length}`,
  );
  if (result.created.length > 0) {
    console.log("Created:", result.created.join(", "));
  }
  process.exit(0);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
