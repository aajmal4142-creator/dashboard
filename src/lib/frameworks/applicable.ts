import type { ObligationStandard } from "@/lib/obligations/types";

import type { FrameworkId } from "./types";

export type ApplicableFrameworksInput = {
  /** Distinct standardVersion values from compliance-obligations rows. */
  standardVersions: ObligationStandard[];
  /** True when the org is not in mandatory scope (Phase 1 voluntary). */
  voluntary: boolean;
};

/**
 * Frameworks surfaced in Data chips + coverage for this org.
 * Voluntary orgs get the voluntary set only — never the mandatory CSRD wall.
 * CSRD-scope also sees ISSB + GRI + EU Taxonomy eligibility hooks.
 */
export function applicableFrameworks(input: ApplicableFrameworksInput): FrameworkId[] {
  const versions = input.standardVersions;
  const hasCsrd = versions.some((v) => v === "CSRD_SET1" || v === "CSRD_SIMPLIFIED");
  const hasBrsr = versions.some((v) => v === "BRSR");

  if (input.voluntary && !hasCsrd && !hasBrsr) {
    return ["VSME", "GRI"];
  }

  const out = new Set<FrameworkId>();

  for (const v of versions) {
    out.add(v);
  }

  if (hasCsrd) {
    out.add("ISSB_S1");
    out.add("ISSB_S2");
    out.add("GRI");
    out.add("EU_TAXONOMY");
  }

  if (hasBrsr) {
    out.add("GRI");
  }

  // Never leave an empty applicable set — fall back to voluntary.
  if (out.size === 0) {
    return ["VSME", "GRI"];
  }

  return [...out];
}
