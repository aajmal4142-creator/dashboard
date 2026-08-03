/**
 * PHASE 1B — MetricDefinition seed
 *
 * PROVENANCE: Every metric below is derived from an input required by the BUILD_PLAN §5
 * calculation engine. Nothing here is transcribed or inferred from ESRS/BRSR text.
 *
 * frameworkMappings is deliberately EMPTY on every row. It stays empty until the real
 * EFRAG IG 3 workbook and the SEBI BRSR annexure are in /docs and parsed in Phase 1c.
 * An empty mapping is honest. A guessed mapping is a legal liability.
 *
 * DO NOT POPULATE frameworkMappings BY HAND. DO NOT ASK A MODEL TO INFER THEM.
 */

export type MetricCategory = "E" | "S" | "G";
export type MetricInputType = "number" | "boolean" | "select";

export interface FrameworkMapping {
  framework:
    | "CSRD_SET1"
    | "CSRD_SIMPLIFIED"
    | "BRSR"
    | "SECR"
    | "VSME"
    | "GRI"
    | "ISSB_S1"
    | "ISSB_S2"
    | "EU_TAXONOMY";
  /** Disclosure code (product alias: disclosureCode). */
  datapointRef: string;
  label?: string;
  required: boolean;
  contributionOnly?: boolean;
  validFrom?: string;
  validUntil?: string;
}

export interface MetricDefinitionSeed {
  key: string;
  label: string;
  description: string;
  unit: string | null;
  category: MetricCategory;
  inputType: MetricInputType;
  helpText: string;
  exampleSource: string;
  calcRole: string;
  frameworkMappings: FrameworkMapping[];
}

export const metricDefinitions: MetricDefinitionSeed[] = [
  {
    key: "electricity_kwh",
    label: "Electricity consumed",
    description:
      "Total grid electricity purchased across all sites for the reporting period.",
    unit: "kWh",
    category: "E",
    inputType: "number",
    helpText:
      "Add up every electricity bill for the period. If a site is leased and the landlord bills you a share, use your share. Meter readings are measured; landlord estimates are estimated.",
    exampleSource:
      "Annual electricity invoices, or the yearly summary on your supplier portal",
    calcRole: "scope2.electricity",
    frameworkMappings: [],
  },
  {
    key: "electricity_renewable_pct",
    label: "Renewable share of electricity",
    description:
      "Percentage of electricity backed by a renewable tariff, REGO/GO certificates, or on-site generation.",
    unit: "%",
    category: "E",
    inputType: "number",
    helpText:
      "Only count what you can evidence with a certificate or a contract. A supplier marketing claim is not evidence — mark it estimated if that is all you have.",
    exampleSource:
      "REGO/GO certificates, green tariff contract, on-site solar generation meter",
    calcRole: "score.E.renewablePct",
    frameworkMappings: [],
  },
  {
    key: "diesel_litres",
    label: "Diesel consumed",
    description: "Diesel burned in owned or leased vehicles, generators, and plant.",
    unit: "L",
    category: "E",
    inputType: "number",
    helpText:
      "Include fleet vehicles you own or lease, backup generators, and site machinery. Exclude employee personal cars — those are Scope 3.",
    exampleSource: "Fuel card statements, bulk fuel delivery notes",
    calcRole: "scope1.diesel",
    frameworkMappings: [],
  },
  {
    key: "natural_gas_m3",
    label: "Natural gas consumed",
    description: "Natural gas burned on site for heating or process use.",
    unit: "m³",
    category: "E",
    inputType: "number",
    helpText:
      "From your gas bills. If billed in kWh, the unit converter will handle it — enter the unit shown on the bill.",
    exampleSource: "Annual gas invoices",
    calcRole: "scope1.gas",
    frameworkMappings: [],
  },
  {
    key: "petrol_litres",
    label: "Petrol consumed",
    description: "Petrol burned in owned or leased vehicles.",
    unit: "L",
    category: "E",
    inputType: "number",
    helpText:
      "Owned or leased vehicles only. Employee commuting is Scope 3, not Scope 1.",
    exampleSource: "Fuel card statements",
    calcRole: "scope1.petrol",
    frameworkMappings: [],
  },
  {
    key: "district_heat_kwh",
    label: "District heating or cooling purchased",
    description: "Purchased heat, steam, or cooling from a district network.",
    unit: "kWh",
    category: "E",
    inputType: "number",
    helpText:
      "Leave blank if you have no district network connection. Blank is not zero.",
    exampleSource: "District heating invoices",
    calcRole: "scope2.districtHeat",
    frameworkMappings: [],
  },
  {
    key: "employees_total",
    label: "Total employees",
    description: "Headcount at the end of the reporting period.",
    unit: "FTE",
    category: "S",
    inputType: "number",
    helpText:
      "Full-time equivalent, not raw headcount. Two half-time people count as one FTE. This figure drives your carbon intensity, so it affects your E score as well as your S score.",
    exampleSource: "Payroll system, HR export",
    calcRole:
      "score.E.carbonPerEmployee (denominator) + score.S.diversityPct (denominator)",
    frameworkMappings: [],
  },
  {
    key: "employees_women",
    label: "Women employees",
    description: "Number of women in the total workforce.",
    unit: "FTE",
    category: "S",
    inputType: "number",
    helpText: "FTE, on the same basis as total employees.",
    exampleSource: "HR system diversity report",
    calcRole: "score.S.diversityPct (numerator)",
    frameworkMappings: [],
  },
  {
    key: "injuries_recordable",
    label: "Recordable work-related injuries",
    description: "Count of recordable work-related injuries during the period.",
    unit: "count",
    category: "S",
    inputType: "number",
    helpText:
      'Zero is a valid and meaningful answer — enter 0 if you had none. Leaving this blank means "not tracked", which is a different thing and will lower your data quality score.',
    exampleSource: "Accident book, RIDDOR reports, H&S incident log",
    calcRole: "score.S.injuryRate (numerator)",
    frameworkMappings: [],
  },
  {
    key: "hours_worked_total",
    label: "Total hours worked",
    description: "Aggregate hours worked by all employees during the period.",
    unit: "hours",
    category: "S",
    inputType: "number",
    helpText:
      "Needed to turn the injury count into a comparable rate. If you do not track hours, FTE × 1,800 is a reasonable estimate — mark it estimated.",
    exampleSource: "Payroll or time-tracking export",
    calcRole: "score.S.injuryRate (denominator)",
    frameworkMappings: [],
  },
  {
    key: "training_hours_total",
    label: "Training hours delivered",
    description: "Total hours of training delivered to employees during the period.",
    unit: "hours",
    category: "S",
    inputType: "number",
    helpText: "All formal training. Feeds the training bonus in your S score.",
    exampleSource: "L&D records, LMS export",
    calcRole: "score.S.trainingBonus",
    frameworkMappings: [],
  },
  {
    key: "board_size",
    label: "Board members",
    description: "Total number of directors on the board.",
    unit: "count",
    category: "G",
    inputType: "number",
    helpText: "If you have no formal board, use your senior decision-making body.",
    exampleSource: "Companies House filing, board minutes, articles of association",
    calcRole: "score.G.boardIndependencePct (denominator)",
    frameworkMappings: [],
  },
  {
    key: "board_independent",
    label: "Independent directors",
    description: "Number of directors who are independent and non-executive.",
    unit: "count",
    category: "G",
    inputType: "number",
    helpText:
      "Independent means no employment, ownership, or material commercial relationship with the company beyond the directorship.",
    exampleSource: "Board composition record, annual report",
    calcRole: "score.G.boardIndependencePct (numerator)",
    frameworkMappings: [],
  },
  {
    key: "policy_anti_corruption",
    label: "Anti-corruption policy in force",
    description:
      "A written anti-bribery and anti-corruption policy is adopted and current.",
    unit: null,
    category: "G",
    inputType: "boolean",
    helpText:
      "Yes only if it is written, approved, and current. Upload it as evidence — an unevidenced yes will be flagged in the report.",
    exampleSource: "The policy document itself",
    calcRole: "score.G.policyToggleScore",
    frameworkMappings: [],
  },
  {
    key: "policy_whistleblower",
    label: "Whistleblower channel in place",
    description: "A confidential reporting channel is available to workers.",
    unit: null,
    category: "G",
    inputType: "boolean",
    helpText: "Yes only if workers can actually reach it and it is confidential.",
    exampleSource: "Policy document, provider contract, intranet page",
    calcRole: "score.G.policyToggleScore",
    frameworkMappings: [],
  },
  {
    key: "policy_data_privacy",
    label: "Data privacy policy in force",
    description: "A written data protection policy is adopted and current.",
    unit: null,
    category: "G",
    inputType: "boolean",
    helpText: "Yes only if written, approved, and current.",
    exampleSource: "The policy document itself",
    calcRole: "score.G.policyToggleScore",
    frameworkMappings: [],
  },
  {
    key: "supplier_spend_total",
    label: "Total supplier spend",
    description:
      "Total spend with suppliers during the period, used for spend-based Scope 3.",
    unit: "currency",
    category: "E",
    inputType: "number",
    helpText:
      "Spend-based Scope 3 is the roughest method available. Every supplier who responds to a request replaces a slice of this estimate with real data, and your data quality score rises.",
    exampleSource: "Accounts payable ledger, purchase report by category",
    calcRole: "scope3.spendBased",
    frameworkMappings: [],
  },
  {
    key: "business_travel_km",
    label: "Business travel distance",
    description:
      "Distance travelled for business by air, rail, and non-owned road vehicles.",
    unit: "km",
    category: "E",
    inputType: "number",
    helpText:
      "Legacy aggregate for Scope 3 Cat 6. Prefer mode-split metrics (air / rail / car / hotel) when available — the calc engine uses mode-split when any mode is present.",
    exampleSource: "Travel agency report, expense system export",
    calcRole: "scope3.businessTravel",
    frameworkMappings: [],
  },
  {
    key: "business_travel_air_short_km",
    label: "Business travel — air short haul",
    description:
      "Passenger-km on short-haul flights for business travel (Scope 3 Cat 6).",
    unit: "km",
    category: "E",
    inputType: "number",
    helpText: "Typically flights under ~3,700 km. Exclude personal travel.",
    exampleSource: "Travel agency report, booking system export",
    calcRole: "scope3.businessTravel.airShort",
    frameworkMappings: [],
  },
  {
    key: "business_travel_air_long_km",
    label: "Business travel — air long haul",
    description: "Passenger-km on long-haul flights for business travel (Scope 3 Cat 6).",
    unit: "km",
    category: "E",
    inputType: "number",
    helpText: "Typically flights over ~3,700 km. Exclude personal travel.",
    exampleSource: "Travel agency report, booking system export",
    calcRole: "scope3.businessTravel.airLong",
    frameworkMappings: [],
  },
  {
    key: "business_travel_rail_km",
    label: "Business travel — rail",
    description: "Passenger-km on rail for business travel (Scope 3 Cat 6).",
    unit: "km",
    category: "E",
    inputType: "number",
    helpText: "National and international rail. Exclude commuting (Cat 7).",
    exampleSource: "Expense system, rail booking export",
    calcRole: "scope3.businessTravel.rail",
    frameworkMappings: [],
  },
  {
    key: "business_travel_car_km",
    label: "Business travel — car",
    description:
      "Vehicle-km in cars not owned or leased by the organisation (Scope 3 Cat 6).",
    unit: "km",
    category: "E",
    inputType: "number",
    helpText:
      "Hire cars, taxis, and employee personal cars used for business. Fleet fuel belongs in Scope 1.",
    exampleSource: "Expense mileage, hire-car invoices",
    calcRole: "scope3.businessTravel.car",
    frameworkMappings: [],
  },
  {
    key: "business_travel_hotel_nights",
    label: "Business travel — hotel nights",
    description: "Room-nights in hotels for business travel (Scope 3 Cat 6).",
    unit: "nights",
    category: "E",
    inputType: "number",
    helpText: "Count room-nights, not guests. Exclude personal stays.",
    exampleSource: "Expense system, hotel booking export",
    calcRole: "scope3.businessTravel.hotel",
    frameworkMappings: [],
  },
  {
    key: "employee_commute_car_km",
    label: "Employee commute — car",
    description: "Employee home-to-work distance by car (Scope 3 Cat 7).",
    unit: "km",
    category: "E",
    inputType: "number",
    helpText: "Survey-based or badge-derived period total. Not business travel.",
    exampleSource: "Commuting survey, HR export",
    calcRole: "scope3.employeeCommute.car",
    frameworkMappings: [],
  },
  {
    key: "employee_commute_public_km",
    label: "Employee commute — public transport",
    description:
      "Employee home-to-work distance by bus, rail, metro, or similar (Scope 3 Cat 7).",
    unit: "km",
    category: "E",
    inputType: "number",
    helpText: "Survey-based period total across public modes.",
    exampleSource: "Commuting survey, HR export",
    calcRole: "scope3.employeeCommute.public",
    frameworkMappings: [],
  },
  {
    key: "employee_commute_bicycle_km",
    label: "Employee commute — bicycle",
    description: "Employee home-to-work distance by bicycle (Scope 3 Cat 7).",
    unit: "km",
    category: "E",
    inputType: "number",
    helpText: "Factor is typically zero; enter distance for completeness and audits.",
    exampleSource: "Commuting survey, HR export",
    calcRole: "scope3.employeeCommute.bicycle",
    frameworkMappings: [],
  },
  {
    key: "freight_upstream_road_tkm",
    label: "Upstream freight — road",
    description:
      "Tonne-km of inbound / company-paid road freight (Scope 3 Cat 4 upstream transportation).",
    unit: "tkm",
    category: "E",
    inputType: "number",
    helpText:
      "Enter tonne-km (tonnes × km). Cat 4 covers freight paid or controlled by the reporting company.",
    exampleSource: "TMS export, carrier invoices, logistics ledger",
    calcRole: "scope3.freight.upstream.road",
    frameworkMappings: [],
  },
  {
    key: "freight_upstream_rail_tkm",
    label: "Upstream freight — rail",
    description: "Tonne-km of inbound / company-paid rail freight (Scope 3 Cat 4).",
    unit: "tkm",
    category: "E",
    inputType: "number",
    helpText: "Tonne-km for Cat 4 rail. Exclude passenger rail (Cat 6).",
    exampleSource: "TMS export, rail freight invoices",
    calcRole: "scope3.freight.upstream.rail",
    frameworkMappings: [],
  },
  {
    key: "freight_upstream_sea_tkm",
    label: "Upstream freight — sea",
    description: "Tonne-km of inbound / company-paid ocean freight (Scope 3 Cat 4).",
    unit: "tkm",
    category: "E",
    inputType: "number",
    helpText: "Tonne-km for Cat 4 sea / ocean container and bulk.",
    exampleSource: "Ocean bill of lading summary, freight forwarder report",
    calcRole: "scope3.freight.upstream.sea",
    frameworkMappings: [],
  },
  {
    key: "freight_upstream_air_tkm",
    label: "Upstream freight — air",
    description: "Tonne-km of inbound / company-paid air freight (Scope 3 Cat 4).",
    unit: "tkm",
    category: "E",
    inputType: "number",
    helpText: "Tonne-km for Cat 4 air cargo. Distinct from passenger air travel (Cat 6).",
    exampleSource: "Air waybill summary, courier freight report",
    calcRole: "scope3.freight.upstream.air",
    frameworkMappings: [],
  },
  {
    key: "freight_downstream_road_tkm",
    label: "Downstream freight — road",
    description: "Tonne-km of sold-product road distribution after sale (Scope 3 Cat 9).",
    unit: "tkm",
    category: "E",
    inputType: "number",
    helpText:
      "Cat 9 covers transportation of sold products paid by the customer or other third parties.",
    exampleSource: "Distributor reports, customer logistics estimates",
    calcRole: "scope3.freight.downstream.road",
    frameworkMappings: [],
  },
  {
    key: "freight_downstream_rail_tkm",
    label: "Downstream freight — rail",
    description: "Tonne-km of sold-product rail distribution after sale (Scope 3 Cat 9).",
    unit: "tkm",
    category: "E",
    inputType: "number",
    helpText: "Tonne-km for Cat 9 rail distribution of sold goods.",
    exampleSource: "Distributor reports, rail freight estimates",
    calcRole: "scope3.freight.downstream.rail",
    frameworkMappings: [],
  },
  {
    key: "freight_downstream_sea_tkm",
    label: "Downstream freight — sea",
    description:
      "Tonne-km of sold-product ocean distribution after sale (Scope 3 Cat 9).",
    unit: "tkm",
    category: "E",
    inputType: "number",
    helpText: "Tonne-km for Cat 9 sea / ocean distribution of sold goods.",
    exampleSource: "Export logistics, customer freight estimates",
    calcRole: "scope3.freight.downstream.sea",
    frameworkMappings: [],
  },
  {
    key: "freight_downstream_air_tkm",
    label: "Downstream freight — air",
    description: "Tonne-km of sold-product air distribution after sale (Scope 3 Cat 9).",
    unit: "tkm",
    category: "E",
    inputType: "number",
    helpText: "Tonne-km for Cat 9 air cargo of sold goods.",
    exampleSource: "Express shipping reports, customer estimates",
    calcRole: "scope3.freight.downstream.air",
    frameworkMappings: [],
  },
  {
    key: "cbam_embedded_emissions_total",
    label: "CBAM embedded emissions (period)",
    description:
      "Total embedded emissions (tCO₂e) for CBAM-covered goods in the reporting period, from operator-entered goods lines.",
    unit: "tCO2e",
    category: "E",
    inputType: "number",
    helpText:
      "Sum of quantity × (direct + indirect) specific embedded emissions for CBAM goods. Leave blank when goods data is incomplete — never enter zero as a stand-in for missing lines.",
    exampleSource: "CBAM importer goods register / quarterly draft",
    calcRole: "compliance.cbam.embeddedTotal",
    frameworkMappings: [],
  },
  {
    key: "water_withdrawal_m3",
    label: "Water withdrawal",
    description:
      "Total freshwater withdrawn across all sites for the reporting period (ESRS E3 / BRSR / GRI style operational water).",
    unit: "m³",
    category: "E",
    inputType: "number",
    helpText:
      "Sum metered withdrawal from municipal supply, groundwater, and surface water. Leave blank if not tracked — blank is not zero.",
    exampleSource: "Utility water invoices, site meters, IoT utility_water feeds",
    calcRole: "operational.water.withdrawal",
    frameworkMappings: [],
  },
  {
    key: "water_discharge_m3",
    label: "Water discharge",
    description:
      "Total water discharged to sewer, surface water, or third-party treatment during the period.",
    unit: "m³",
    category: "E",
    inputType: "number",
    helpText:
      "Include treated and untreated discharges you can evidence. Consumption is not derived here — enter discharge separately.",
    exampleSource: "Trade-effluent invoices, discharge meters, treatment plant logs",
    calcRole: "operational.water.discharge",
    frameworkMappings: [],
  },
  {
    key: "waste_generated_tonnes",
    label: "Waste generated",
    description: "Total waste generated in own operations during the period (tonnes).",
    unit: "t",
    category: "E",
    inputType: "number",
    helpText:
      "Preferred generated-waste key. Prefer this over the legacy waste_tonnes aggregate from supplier questionnaires.",
    exampleSource: "Waste contractor manifests, site waste logs",
    calcRole: "operational.waste.generated",
    frameworkMappings: [],
  },
  {
    key: "waste_tonnes",
    label: "Waste (legacy aggregate)",
    description:
      "Legacy total waste tonnes — used by the supplier ESG questionnaire. Prefer waste_generated_tonnes for org reporting.",
    unit: "t",
    category: "E",
    inputType: "number",
    helpText:
      "Kept for backward compatibility with questionnaire responses. Org entry should use waste_generated_tonnes.",
    exampleSource: "Supplier questionnaire, legacy imports",
    calcRole: "operational.waste.generated.legacy",
    frameworkMappings: [],
  },
  {
    key: "waste_recycled_tonnes",
    label: "Waste recycled",
    description:
      "Waste diverted to recycling (tonnes). Optional Scope 3 Cat 5 GHG when a recycling factor is seeded.",
    unit: "t",
    category: "E",
    inputType: "number",
    helpText:
      "Enter recycled tonnes only. Emissions apply only when scope3_waste_recycling is in the factor registry.",
    exampleSource: "Recycling contractor manifests",
    calcRole: "scope3.waste.recycling",
    frameworkMappings: [],
  },
  {
    key: "waste_to_landfill_tonnes",
    label: "Waste to landfill",
    description:
      "Waste sent to landfill (tonnes). Optional Scope 3 Cat 5 GHG when a landfill factor is seeded.",
    unit: "t",
    category: "E",
    inputType: "number",
    helpText:
      "Enter landfill tonnes only. Emissions apply only when scope3_waste_landfill is in the factor registry.",
    exampleSource: "Landfill contractor manifests, duty-of-care notes",
    calcRole: "scope3.waste.landfill",
    frameworkMappings: [],
  },
];
