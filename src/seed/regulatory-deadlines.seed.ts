/**
 * Standalone seed for regulatory deadline catalog.
 *
 * Usage: pnpm seed:regulatory-deadlines
 *
 * Idempotent — skips catalog rows that already exist by catalogKey.
 */

import "dotenv/config";

import { getPayload } from "payload";

import { ensureRegulatoryDeadlines } from "../lib/compliance/deadlineSeed";
import config from "../payload.config";

async function main() {
  const payload = await getPayload({ config });
  const result = await ensureRegulatoryDeadlines(payload);
  console.log(
    `Regulatory deadlines seed: created ${result.created.length}, existing ${result.existing.length} (catalog total target ${result.created.length + result.existing.length})`,
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
