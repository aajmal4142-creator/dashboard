/**
 * ESRS topic → disclosure code crosswalk (structural beachhead).
 * Not counsel-approved legal determinations; chips for workshop guidance only.
 */

export type EsrsCrosswalkEntry = {
  topicId: string;
  disclosureCodes: string[];
  note: string;
};

export const ESRS_DISCLOSURE_CROSSWALK: EsrsCrosswalkEntry[] = [
  {
    topicId: "E1",
    disclosureCodes: ["E1-1", "E1-4", "E1-6", "E1-9"],
    note: "Transition plan, targets, GHG, anticipated financial effects.",
  },
  {
    topicId: "E2",
    disclosureCodes: ["E2-1", "E2-4", "E2-5"],
    note: "Policies, pollutants, substances of concern.",
  },
  {
    topicId: "E3",
    disclosureCodes: ["E3-1", "E3-4"],
    note: "Water policies and consumption metrics.",
  },
  {
    topicId: "E4",
    disclosureCodes: ["E4-1", "E4-5"],
    note: "Biodiversity transition and impact metrics.",
  },
  {
    topicId: "E5",
    disclosureCodes: ["E5-1", "E5-4", "E5-5"],
    note: "Circular resource inflows/outflows and waste.",
  },
  {
    topicId: "S1",
    disclosureCodes: ["S1-1", "S1-8", "S1-14"],
    note: "Own workforce policies, collective bargaining, H&S.",
  },
  {
    topicId: "S2",
    disclosureCodes: ["S2-1", "S2-4"],
    note: "Value-chain workers policies and actions.",
  },
  {
    topicId: "S3",
    disclosureCodes: ["S3-1", "S3-4"],
    note: "Affected communities policies and actions.",
  },
  {
    topicId: "S4",
    disclosureCodes: ["S4-1", "S4-4"],
    note: "Consumers/end-users policies and actions.",
  },
  {
    topicId: "G1",
    disclosureCodes: ["G1-1", "G1-3", "G1-4"],
    note: "Business conduct, anti-corruption, political influence.",
  },
];

export function crosswalkForTopic(topicId: string): EsrsCrosswalkEntry | null {
  return ESRS_DISCLOSURE_CROSSWALK.find((e) => e.topicId === topicId) ?? null;
}
