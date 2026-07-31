/**
 * Standalone verification that the ISO 14064 checklist seed catalog is intact.
 * Checklist rows are copied into each org document on POST create — this script
 * validates the catalog (no DB writes required for the catalog itself).
 *
 * Usage: pnpm seed:iso-14064
 */

import "dotenv/config";

import {
  buildSeededSections,
  ISO_14064_CHECKLIST_COUNT,
  ISO_14064_CHECKLIST_SEEDS,
} from "../lib/compliance/iso14064Seed";

function main() {
  const sections = buildSeededSections();
  const part1 = ISO_14064_CHECKLIST_SEEDS.filter((s) => s.part === "part1");
  const part2 = ISO_14064_CHECKLIST_SEEDS.filter((s) => s.part === "part2");
  const keys = new Set(ISO_14064_CHECKLIST_SEEDS.map((s) => s.itemKey));

  if (ISO_14064_CHECKLIST_SEEDS.length !== 30) {
    throw new Error(`Expected 30 seed items, got ${ISO_14064_CHECKLIST_SEEDS.length}`);
  }
  if (sections.length !== ISO_14064_CHECKLIST_COUNT) {
    throw new Error("buildSeededSections length mismatch");
  }
  if (keys.size !== 30) {
    throw new Error("Duplicate itemKey in ISO 14064 seed catalog");
  }

  console.log(
    `ISO 14064 checklist seed OK: ${ISO_14064_CHECKLIST_COUNT} items (Part 1: ${part1.length}, Part 2: ${part2.length})`,
  );
  console.log(
    "Org checklists are created via POST /api/app/compliance/iso-14064 (copies this catalog).",
  );
  process.exit(0);
}

main();
