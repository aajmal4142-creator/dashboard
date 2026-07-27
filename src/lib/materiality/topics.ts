/**
 * ESRS topical standards used for double materiality (Set 1).
 * Scores are 0–5 per axis; materiality threshold defaults to 2.5 on either axis.
 */
export type EsrsPillar = "E" | "S" | "G";

export type EsrsTopic = {
  id: string;
  pillar: EsrsPillar;
  label: string;
  description: string;
};

export const ESRS_TOPICS: EsrsTopic[] = [
  {
    id: "E1",
    pillar: "E",
    label: "Climate change",
    description: "GHG emissions, energy, transition plans, climate risks.",
  },
  {
    id: "E2",
    pillar: "E",
    label: "Pollution",
    description: "Air, water, soil pollution and substances of concern.",
  },
  {
    id: "E3",
    pillar: "E",
    label: "Water and marine resources",
    description: "Water consumption, withdrawal, and marine impacts.",
  },
  {
    id: "E4",
    pillar: "E",
    label: "Biodiversity and ecosystems",
    description: "Impacts on habitats, species, and ecosystem services.",
  },
  {
    id: "E5",
    pillar: "E",
    label: "Circular economy",
    description: "Resource inflows/outflows, waste, and circular design.",
  },
  {
    id: "S1",
    pillar: "S",
    label: "Own workforce",
    description: "Working conditions, equal treatment, health and safety.",
  },
  {
    id: "S2",
    pillar: "S",
    label: "Workers in the value chain",
    description: "Labour conditions and rights in the upstream/downstream chain.",
  },
  {
    id: "S3",
    pillar: "S",
    label: "Affected communities",
    description: "Impacts on communities near operations or in the value chain.",
  },
  {
    id: "S4",
    pillar: "S",
    label: "Consumers and end-users",
    description: "Product safety, privacy, access, and responsible marketing.",
  },
  {
    id: "G1",
    pillar: "G",
    label: "Business conduct",
    description:
      "Corporate culture, anti-corruption, political engagement, payment practices.",
  },
];

export const MATERIALITY_THRESHOLD = 2.5;
