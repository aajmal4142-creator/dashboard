import type { FrameworkId } from "./types";

/** Shared Payload select options for frameworkMappings.framework. */
export const FRAMEWORK_SELECT_OPTIONS: { label: string; value: FrameworkId }[] = [
  { label: "CSRD Set 1", value: "CSRD_SET1" },
  { label: "CSRD Simplified", value: "CSRD_SIMPLIFIED" },
  { label: "BRSR", value: "BRSR" },
  { label: "VSME", value: "VSME" },
  { label: "GRI", value: "GRI" },
  { label: "ISSB S1", value: "ISSB_S1" },
  { label: "ISSB S2", value: "ISSB_S2" },
  { label: "EU Taxonomy", value: "EU_TAXONOMY" },
];

export const FRAMEWORK_DISPLAY: Record<FrameworkId, string> = {
  CSRD_SET1: "CSRD Set 1",
  CSRD_SIMPLIFIED: "CSRD Simplified",
  BRSR: "BRSR",
  VSME: "VSME",
  GRI: "GRI",
  ISSB_S1: "ISSB S1",
  ISSB_S2: "ISSB S2",
  EU_TAXONOMY: "EU Taxonomy",
};
