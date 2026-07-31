/**
 * EU Green Taxonomy — 6 environmental objectives + technical screening + DNSH.
 * Criteria are a practical ClearESG questionnaire derived from Regulation (EU) 2020/852
 * and the Climate / Environmental Delegated Acts (simplified yes/no screening).
 */

import type {
  DnshAnswer,
  ObjectiveAnswer,
  TaxonomyObjectiveDef,
  TaxonomyObjectiveId,
} from "./types";

function c(id: string, label: string, prompt: string) {
  return { id, label, prompt };
}

export const TAXONOMY_OBJECTIVES: TaxonomyObjectiveDef[] = [
  {
    id: "climate_mitigation",
    label: "Climate change mitigation",
    shortLabel: "Mitigation",
    description:
      "Substantial contribution to climate change mitigation — reducing or avoiding GHG emissions, or enhancing removals.",
    criteria: [
      c(
        "cm-01",
        "GHG inventory",
        "Does your company measure Scope 1 and Scope 2 GHG emissions?",
      ),
      c(
        "cm-02",
        "Scope 3 coverage",
        "Do you quantify material Scope 3 categories relevant to your activity?",
      ),
      c(
        "cm-03",
        "Decarbonisation targets",
        "Do you have time-bound absolute or intensity GHG reduction targets?",
      ),
      c(
        "cm-04",
        "Science alignment",
        "Are targets aligned with a 1.5°C or well-below-2°C pathway (e.g. SBTi or equivalent)?",
      ),
      c(
        "cm-05",
        "Energy monitoring",
        "Do you monitor energy consumption by source (renewable vs fossil)?",
      ),
      c(
        "cm-06",
        "Renewable share",
        "Is a material share of electricity from renewable sources, or do you have a documented transition plan?",
      ),
      c(
        "cm-07",
        "Efficiency measures",
        "Have you implemented energy-efficiency measures in the last reporting period?",
      ),
      c(
        "cm-08",
        "Low-carbon tech",
        "Does the activity use low-carbon technologies that meet EU Taxonomy technical screening thresholds for your sector?",
      ),
      c(
        "cm-09",
        "Avoided emissions",
        "Can you demonstrate avoided or reduced emissions attributable to the activity (with methodology)?",
      ),
      c(
        "cm-10",
        "Transition plan",
        "Is there a board-approved climate transition plan covering CapEx/OpEx alignment?",
      ),
      c(
        "cm-11",
        "Carbon lock-in",
        "Does the activity avoid locking in carbon-intensive assets beyond their useful life?",
      ),
      c(
        "cm-12",
        "Verification",
        "Have GHG figures been independently verified or assured (limited or reasonable)?",
      ),
    ],
    dnsh: [
      c(
        "cm-dnsh-01",
        "Adaptation DNSH",
        "Have you assessed physical climate risks and adapted where material?",
      ),
      c(
        "cm-dnsh-02",
        "Water DNSH",
        "Does the activity avoid significant harm to water resources and marine ecosystems?",
      ),
      c(
        "cm-dnsh-03",
        "Circular DNSH",
        "Are waste and circular-economy requirements met (maximise reuse/recycle)?",
      ),
      c(
        "cm-dnsh-04",
        "Pollution DNSH",
        "Does the activity comply with pollution prevention and control best practices?",
      ),
      c(
        "cm-dnsh-05",
        "Biodiversity DNSH",
        "Have you screened for biodiversity/ecosystem impacts and avoided significant harm?",
      ),
    ],
  },
  {
    id: "climate_adaptation",
    label: "Climate change adaptation",
    shortLabel: "Adaptation",
    description:
      "Substantial contribution to climate change adaptation — reducing material physical climate risks.",
    criteria: [
      c(
        "ca-01",
        "Risk assessment",
        "Have you conducted a physical climate risk assessment for material assets and activities?",
      ),
      c(
        "ca-02",
        "Hazard coverage",
        "Does the assessment cover acute and chronic hazards relevant to your locations (heat, flood, drought, wind, etc.)?",
      ),
      c(
        "ca-03",
        "Scenario analysis",
        "Do you use climate scenarios (e.g. RCP/SSP pathways) consistent with EU Taxonomy guidance?",
      ),
      c(
        "ca-04",
        "Vulnerability",
        "Have you identified vulnerable assets, operations, and value-chain nodes?",
      ),
      c(
        "ca-05",
        "Adaptation solutions",
        "Have you implemented adaptation solutions that substantially reduce identified material risks?",
      ),
      c(
        "ca-06",
        "Nature-based",
        "Where feasible, do adaptation measures prefer nature-based or hybrid solutions?",
      ),
      c(
        "ca-07",
        "Maladaptation check",
        "Have you assessed that solutions do not increase risk elsewhere (maladaptation)?",
      ),
      c(
        "ca-08",
        "Monitoring",
        "Is there ongoing monitoring of climate risk indicators and adaptation performance?",
      ),
      c(
        "ca-09",
        "CapEx linkage",
        "Is adaptation CapEx/OpEx tracked and disclosed for the activity?",
      ),
      c(
        "ca-10",
        "Insurance / continuity",
        "Do business continuity and insurance programmes reflect assessed climate risks?",
      ),
      c(
        "ca-11",
        "Stakeholder engagement",
        "Have affected communities or stakeholders been considered in adaptation planning where material?",
      ),
      c(
        "ca-12",
        "Documentation",
        "Is the climate risk and adaptation assessment documented and available for assurance?",
      ),
    ],
    dnsh: [
      c(
        "ca-dnsh-01",
        "Mitigation DNSH",
        "Does the activity avoid significant increase in GHG emissions relative to the baseline alternative?",
      ),
      c(
        "ca-dnsh-02",
        "Water DNSH",
        "Do adaptation measures avoid significant harm to water bodies?",
      ),
      c(
        "ca-dnsh-03",
        "Circular DNSH",
        "Are materials used in adaptation works consistent with circular-economy principles?",
      ),
      c(
        "ca-dnsh-04",
        "Pollution DNSH",
        "Do works avoid significant pollution to air, water, or soil?",
      ),
      c(
        "ca-dnsh-05",
        "Biodiversity DNSH",
        "Have biodiversity impacts of adaptation measures been assessed and mitigated?",
      ),
    ],
  },
  {
    id: "water",
    label: "Sustainable use and protection of water and marine resources",
    shortLabel: "Water",
    description:
      "Substantial contribution to sustainable use and protection of water and marine resources.",
    criteria: [
      c(
        "wa-01",
        "Water inventory",
        "Do you measure freshwater withdrawal and consumption by source?",
      ),
      c(
        "wa-02",
        "Water stress",
        "Have you assessed whether operations are in water-stressed basins?",
      ),
      c(
        "wa-03",
        "Efficiency targets",
        "Do you have time-bound water-use efficiency or reduction targets?",
      ),
      c(
        "wa-04",
        "Reuse / recycle",
        "Do you reuse or recycle process water where technically feasible?",
      ),
      c(
        "wa-05",
        "Wastewater treatment",
        "Is wastewater treated to meet applicable discharge standards before release?",
      ),
      c(
        "wa-06",
        "Marine protection",
        "Where relevant, do you prevent marine pollution and protect coastal/marine ecosystems?",
      ),
      c(
        "wa-07",
        "Leakage control",
        "Do you monitor and remediate leaks in water distribution or process systems?",
      ),
      c(
        "wa-08",
        "Stormwater",
        "Are stormwater management measures in place to prevent contamination runoff?",
      ),
      c(
        "wa-09",
        "Supplier water",
        "Do you engage material suppliers on water stewardship in high-risk basins?",
      ),
      c(
        "wa-10",
        "Quality monitoring",
        "Do you monitor water quality parameters for withdrawals and discharges?",
      ),
      c(
        "wa-11",
        "Permits",
        "Are all required water abstraction and discharge permits current and complied with?",
      ),
      c(
        "wa-12",
        "Disclosure",
        "Is water performance disclosed in line with recognised frameworks (e.g. ESRS E3)?",
      ),
    ],
    dnsh: [
      c(
        "wa-dnsh-01",
        "Mitigation DNSH",
        "Does water management avoid significant GHG penalty vs alternatives?",
      ),
      c(
        "wa-dnsh-02",
        "Adaptation DNSH",
        "Are water assets resilient to climate-related hydrological risks?",
      ),
      c(
        "wa-dnsh-03",
        "Circular DNSH",
        "Are sludge and treatment by-products managed consistent with circular principles?",
      ),
      c(
        "wa-dnsh-04",
        "Pollution DNSH",
        "Do discharges meet Best Available Techniques (BAT) pollution limits?",
      ),
      c(
        "wa-dnsh-05",
        "Biodiversity DNSH",
        "Have aquatic ecosystem impacts been assessed and mitigated?",
      ),
    ],
  },
  {
    id: "circular_economy",
    label: "Transition to a circular economy",
    shortLabel: "Circular",
    description:
      "Substantial contribution to the transition to a circular economy — resource efficiency, reuse, recycling, and design for longevity.",
    criteria: [
      c(
        "ce-01",
        "Material inventory",
        "Do you track primary raw material inputs by type and mass?",
      ),
      c(
        "ce-02",
        "Recycled content",
        "Do products or processes incorporate recycled or secondary materials where feasible?",
      ),
      c(
        "ce-03",
        "Design for durability",
        "Are products designed for durability, repairability, or upgradeability?",
      ),
      c(
        "ce-04",
        "Design for recycling",
        "Are products designed for disassembly and high-quality recycling at end of life?",
      ),
      c(
        "ce-05",
        "Waste hierarchy",
        "Do you apply the waste hierarchy (prevent → reuse → recycle → recover → dispose)?",
      ),
      c(
        "ce-06",
        "Waste diversion",
        "Is a material share of operational waste diverted from landfill?",
      ),
      c(
        "ce-07",
        "Hazardous waste",
        "Is hazardous waste minimised and managed by authorised operators?",
      ),
      c(
        "ce-08",
        "Take-back",
        "Do you offer take-back, remanufacturing, or product-as-a-service models where relevant?",
      ),
      c(
        "ce-09",
        "Packaging",
        "Have you reduced packaging intensity and increased recyclable/reusable packaging?",
      ),
      c(
        "ce-10",
        "Supplier circularity",
        "Do procurement criteria prefer circular materials and suppliers?",
      ),
      c(
        "ce-11",
        "Digital product passport",
        "Where applicable, do you maintain material/composition data to support circularity?",
      ),
      c(
        "ce-12",
        "Targets",
        "Do you have time-bound circularity or waste-reduction targets with progress tracking?",
      ),
    ],
    dnsh: [
      c(
        "ce-dnsh-01",
        "Mitigation DNSH",
        "Does circular activity avoid significant net GHG increase?",
      ),
      c(
        "ce-dnsh-02",
        "Adaptation DNSH",
        "Are circular facilities adapted to material climate risks?",
      ),
      c("ce-dnsh-03", "Water DNSH", "Does the activity avoid significant water harm?"),
      c(
        "ce-dnsh-04",
        "Pollution DNSH",
        "Are recycling/recovery processes controlled for emissions to air, water, and soil?",
      ),
      c(
        "ce-dnsh-05",
        "Biodiversity DNSH",
        "Have land-use and biodiversity impacts of material sourcing been assessed?",
      ),
    ],
  },
  {
    id: "pollution",
    label: "Pollution prevention and control",
    shortLabel: "Pollution",
    description:
      "Substantial contribution to pollution prevention and control — reducing emissions to air, water, and soil.",
    criteria: [
      c(
        "po-01",
        "Emissions inventory",
        "Do you inventory material pollutant emissions to air, water, and soil?",
      ),
      c(
        "po-02",
        "BAT alignment",
        "Do processes align with Best Available Techniques (BAT) conclusions where applicable?",
      ),
      c(
        "po-03",
        "Air pollutants",
        "Have you reduced NOx, SOx, PM, VOCs, or other material air pollutants vs a baseline?",
      ),
      c(
        "po-04",
        "Water pollutants",
        "Have you reduced material water pollutants (COD, heavy metals, nutrients, etc.)?",
      ),
      c(
        "po-05",
        "Soil protection",
        "Are measures in place to prevent soil contamination from operations and spills?",
      ),
      c(
        "po-06",
        "Substances of concern",
        "Do you track and phase down substances of very high concern (SVHC) where used?",
      ),
      c(
        "po-07",
        "Spill response",
        "Is there an incident/spill response plan with drills and corrective actions?",
      ),
      c(
        "po-08",
        "Noise / odour",
        "Where material, are noise and odour impacts managed to local standards?",
      ),
      c(
        "po-09",
        "Supplier chemicals",
        "Do you require suppliers to disclose and control hazardous substances?",
      ),
      c(
        "po-10",
        "Monitoring",
        "Is continuous or periodic pollution monitoring in place for material sources?",
      ),
      c(
        "po-11",
        "Permits",
        "Are environmental permits current and is there no material non-compliance?",
      ),
      c(
        "po-12",
        "Improvement plan",
        "Is there a documented pollution-reduction improvement plan with owners and dates?",
      ),
    ],
    dnsh: [
      c(
        "po-dnsh-01",
        "Mitigation DNSH",
        "Do pollution controls avoid significant GHG trade-offs without justification?",
      ),
      c(
        "po-dnsh-02",
        "Adaptation DNSH",
        "Are pollution-control assets resilient to climate extremes?",
      ),
      c(
        "po-dnsh-03",
        "Water DNSH",
        "Do pollution measures protect water and marine resources?",
      ),
      c(
        "po-dnsh-04",
        "Circular DNSH",
        "Are captured pollutants/waste handled consistent with circular hierarchy?",
      ),
      c(
        "po-dnsh-05",
        "Biodiversity DNSH",
        "Have pollution impacts on ecosystems been assessed and mitigated?",
      ),
    ],
  },
  {
    id: "biodiversity",
    label: "Protection and restoration of biodiversity and ecosystems",
    shortLabel: "Biodiversity",
    description:
      "Substantial contribution to protection and restoration of biodiversity and ecosystems.",
    criteria: [
      c(
        "bd-01",
        "Impact screening",
        "Have you screened sites and activities for biodiversity and ecosystem impacts?",
      ),
      c(
        "bd-02",
        "Protected areas",
        "Do you avoid operating in or adversely affecting protected areas / Natura 2000 without mitigation hierarchy?",
      ),
      c(
        "bd-03",
        "Critical habitats",
        "Have you assessed proximity to critical habitats and endangered species?",
      ),
      c(
        "bd-04",
        "Mitigation hierarchy",
        "Do you apply avoid → minimise → restore → offset for residual impacts?",
      ),
      c(
        "bd-05",
        "Land use",
        "Is land-use change monitored and minimised for the activity?",
      ),
      c(
        "bd-06",
        "Restoration",
        "Have you implemented habitat restoration or nature-positive measures where material?",
      ),
      c(
        "bd-07",
        "Invasive species",
        "Are controls in place to prevent introduction/spread of invasive alien species?",
      ),
      c(
        "bd-08",
        "Supply chain",
        "Do material commodity suppliers follow deforestation-free / biodiversity criteria?",
      ),
      c(
        "bd-09",
        "Soil / ecosystems",
        "Do agricultural or land-based activities maintain soil health and ecosystem functions?",
      ),
      c(
        "bd-10",
        "Monitoring",
        "Is biodiversity performance monitored with indicators appropriate to the activity?",
      ),
      c(
        "bd-11",
        "Targets",
        "Do you have biodiversity-related targets or commitments with progress tracking?",
      ),
      c(
        "bd-12",
        "Disclosure",
        "Is biodiversity performance disclosed (e.g. ESRS E4 or equivalent)?",
      ),
    ],
    dnsh: [
      c(
        "bd-dnsh-01",
        "Mitigation DNSH",
        "Do biodiversity measures avoid significant GHG increase?",
      ),
      c(
        "bd-dnsh-02",
        "Adaptation DNSH",
        "Are nature-based solutions resilient under climate scenarios?",
      ),
      c("bd-dnsh-03", "Water DNSH", "Do biodiversity measures protect water resources?"),
      c(
        "bd-dnsh-04",
        "Circular DNSH",
        "Are materials for restoration/works consistent with circular principles?",
      ),
      c(
        "bd-dnsh-05",
        "Pollution DNSH",
        "Do activities avoid significant pollution harm to ecosystems?",
      ),
    ],
  },
];

export const TAXONOMY_OBJECTIVE_IDS: TaxonomyObjectiveId[] = TAXONOMY_OBJECTIVES.map(
  (o) => o.id,
);

const byId = new Map(TAXONOMY_OBJECTIVES.map((o) => [o.id, o]));

export function getObjectiveDef(
  id: TaxonomyObjectiveId,
): TaxonomyObjectiveDef | undefined {
  return byId.get(id);
}

export function getObjectiveLabel(id: TaxonomyObjectiveId): string {
  return byId.get(id)?.label ?? id;
}

/** Empty answer scaffolding for a new assessment. */
export function buildEmptyObjectiveAnswers(): ObjectiveAnswer[] {
  return TAXONOMY_OBJECTIVES.map((obj) => ({
    objective: obj.id,
    applicable: "unanswered" as const,
    answers: obj.criteria.map((crit) => ({
      criteriaId: crit.id,
      met: "unanswered" as const,
    })),
  }));
}

export function buildEmptyDnshAnswers(): DnshAnswer[] {
  const rows: DnshAnswer[] = [];
  for (const obj of TAXONOMY_OBJECTIVES) {
    for (const d of obj.dnsh) {
      rows.push({
        objective: obj.id,
        criteriaId: d.id,
        compliant: "unanswered",
      });
    }
  }
  return rows;
}
