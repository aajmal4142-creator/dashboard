/**

- PHASE 1B — MetricDefinition seed
-
- PROVENANCE: Every metric below is derived from an input required by the BUILD_PLAN §5
- calculation engine. Nothing here is transcribed or inferred from ESRS/BRSR text.
-
- frameworkMappings is deliberately EMPTY on every row. It stays empty until the real
- EFRAG IG 3 workbook and the SEBI BRSR annexure are in /docs and parsed in Phase 1c.
- An empty mapping is honest. A guessed mapping is a legal liability that silently
- propagates into every gap analysis and every published PDF.
-
- DO NOT POPULATE frameworkMappings BY HAND. DO NOT ASK A MODEL TO INFER THEM.
-
- Regulatory context (verified 16 Jul 2026):
- - Directive (EU) 2026/470 (Omnibus) in force 18 Mar 2026; CSRD transposition due 19 Mar 2027
- - ESRS Set 1 (Delegated Reg. 2023/2772) remains live for Wave 1 until the Simplified
-     ESRS delegated act takes effect (adoption expected ~mid-2026 — CHECK CURRENT STATUS)
- - Simplified ESRS: reduced datapoint count, voluntary disclosures eliminated
- - Wave 2 -> FY2027 (report 2028); Wave 3 -> FY2028 (report 2029)
- => framework enum must carry BOTH 'CSRD_SET1' and 'CSRD_SIMPLIFIED', each mapping
-      carrying validFrom/validUntil. Regulation versions exactly like emission factors do.

*/

export type MetricCategory = 'E' | 'S' | 'G'
export type MetricInputType = 'number' | 'boolean' | 'select'

export interface FrameworkMapping {
framework: 'CSRD_SET1' | 'CSRD_SIMPLIFIED' | 'BRSR' | 'VSME' | 'GRI'
datapointRef: string
required: boolean
validFrom?: string
validUntil?: string
}

export interface MetricDefinitionSeed {
key: string
label: string
description: string
unit: string | null
category: MetricCategory
inputType: MetricInputType
helpText: string
exampleSource: string
calcRole: string // which §5 formula term this feeds — the provenance record
frameworkMappings: FrameworkMapping[]
}

export const metricDefinitions: MetricDefinitionSeed[] = [
// ─── ENVIRONMENT ────────────────────────────────────────────────────────────
// Feeds: Scope 2 = electricity_kWh × factor(grid, region, year) / 1000
{
key: 'electricity_kwh',
label: 'Electricity consumed',
description: 'Total grid electricity purchased across all sites for the reporting period.',
unit: 'kWh',
category: 'E',
inputType: 'number',
helpText:
'Add up every electricity bill for the period. If a site is leased and the landlord bills you a share, use your share. Meter readings are measured; landlord estimates are estimated.',
exampleSource: 'Annual electricity invoices, or the yearly summary on your supplier portal',
calcRole: 'scope2.electricity',
frameworkMappings: [],
},
{
key: 'electricity_renewable_pct',
label: 'Renewable share of electricity',
description:
'Percentage of electricity backed by a renewable tariff, REGO/GO certificates, or on-site generation.',
unit: '%',
category: 'E',
inputType: 'number',
helpText:
'Only count what you can evidence with a certificate or a contract. A supplier marketing claim is not evidence — mark it estimated if that is all you have.',
exampleSource: 'REGO/GO certificates, green tariff contract, on-site solar generation meter',
calcRole: 'score.E.renewablePct',
frameworkMappings: [],
},
{
key: 'diesel_litres',
label: 'Diesel consumed',
description: 'Diesel burned in owned or leased vehicles, generators, and plant.',
unit: 'L',
category: 'E',
inputType: 'number',
helpText:
'Include fleet vehicles you own or lease, backup generators, and site machinery. Exclude employee personal cars — those are Scope 3.',
exampleSource: 'Fuel card statements, bulk fuel delivery notes',
calcRole: 'scope1.diesel',
frameworkMappings: [],
},
{
key: 'natural_gas_m3',
label: 'Natural gas consumed',
description: 'Natural gas burned on site for heating or process use.',
unit: 'm³',
category: 'E',
inputType: 'number',
helpText:
'From your gas bills. If billed in kWh, the unit converter will handle it — enter the unit shown on the bill.',
exampleSource: 'Annual gas invoices',
calcRole: 'scope1.gas',
frameworkMappings: [],
},
{
key: 'petrol_litres',
label: 'Petrol consumed',
description: 'Petrol burned in owned or leased vehicles.',
unit: 'L',
category: 'E',
inputType: 'number',
helpText: 'Owned or leased vehicles only. Employee commuting is Scope 3, not Scope 1.',
exampleSource: 'Fuel card statements',
calcRole: 'scope1.petrol',
frameworkMappings: [],
},
{
key: 'district_heat_kwh',
label: 'District heating or cooling purchased',
description: 'Purchased heat, steam, or cooling from a district network.',
unit: 'kWh',
category: 'E',
inputType: 'number',
helpText: 'Leave blank if you have no district network connection. Blank is not zero.',
exampleSource: 'District heating invoices',
calcRole: 'scope2.districtHeat',
frameworkMappings: [],
},

// ─── SOCIAL ─────────────────────────────────────────────────────────────────
// Feeds: E denominator (carbonPerEmployee) AND S numerator (diversityPct)
{
key: 'employees_total',
label: 'Total employees',
description: 'Headcount at the end of the reporting period.',
unit: 'FTE',
category: 'S',
inputType: 'number',
helpText:
'Full-time equivalent, not raw headcount. Two half-time people count as one FTE. This figure drives your carbon intensity, so it affects your E score as well as your S score.',
exampleSource: 'Payroll system, HR export',
calcRole: 'score.E.carbonPerEmployee (denominator) + score.S.diversityPct (denominator)',
frameworkMappings: [],
},
{
key: 'employees_women',
label: 'Women employees',
description: 'Number of women in the total workforce.',
unit: 'FTE',
category: 'S',
inputType: 'number',
helpText: 'FTE, on the same basis as total employees.',
exampleSource: 'HR system diversity report',
calcRole: 'score.S.diversityPct (numerator)',
frameworkMappings: [],
},
{
key: 'injuries_recordable',
label: 'Recordable work-related injuries',
description: 'Count of recordable work-related injuries during the period.',
unit: 'count',
category: 'S',
inputType: 'number',
helpText:
'Zero is a valid and meaningful answer — enter 0 if you had none. Leaving this blank means "not tracked", which is a different thing and will lower your data quality score.',
exampleSource: 'Accident book, RIDDOR reports, H&S incident log',
calcRole: 'score.S.injuryRate (numerator)',
frameworkMappings: [],
},
{
key: 'hours_worked_total',
label: 'Total hours worked',
description: 'Aggregate hours worked by all employees during the period.',
unit: 'hours',
category: 'S',
inputType: 'number',
helpText:
'Needed to turn the injury count into a comparable rate. If you do not track hours, FTE × 1,800 is a reasonable estimate — mark it estimated.',
exampleSource: 'Payroll or time-tracking export',
calcRole: 'score.S.injuryRate (denominator)',
frameworkMappings: [],
},
{
key: 'training_hours_total',
label: 'Training hours delivered',
description: 'Total hours of training delivered to employees during the period.',
unit: 'hours',
category: 'S',
inputType: 'number',
helpText: 'All formal training. Feeds the training bonus in your S score.',
exampleSource: 'L&D records, LMS export',
calcRole: 'score.S.trainingBonus',
frameworkMappings: [],
},

// ─── GOVERNANCE ─────────────────────────────────────────────────────────────
{
key: 'board_size',
label: 'Board members',
description: 'Total number of directors on the board.',
unit: 'count',
category: 'G',
inputType: 'number',
helpText: 'If you have no formal board, use your senior decision-making body.',
exampleSource: 'Companies House filing, board minutes, articles of association',
calcRole: 'score.G.boardIndependencePct (denominator)',
frameworkMappings: [],
},
{
key: 'board_independent',
label: 'Independent directors',
description: 'Number of directors who are independent and non-executive.',
unit: 'count',
category: 'G',
inputType: 'number',
helpText:
'Independent means no employment, ownership, or material commercial relationship with the company beyond the directorship.',
exampleSource: 'Board composition record, annual report',
calcRole: 'score.G.boardIndependencePct (numerator)',
frameworkMappings: [],
},
{
key: 'policy_anti_corruption',
label: 'Anti-corruption policy in force',
description: 'A written anti-bribery and anti-corruption policy is adopted and current.',
unit: null,
category: 'G',
inputType: 'boolean',
helpText:
'Yes only if it is written, approved, and current. Upload it as evidence — an unevidenced yes will be flagged in the report.',
exampleSource: 'The policy document itself',
calcRole: 'score.G.policyToggleScore',
frameworkMappings: [],
},
{
key: 'policy_whistleblower',
label: 'Whistleblower channel in place',
description: 'A confidential reporting channel is available to workers.',
unit: null,
category: 'G',
inputType: 'boolean',
helpText: 'Yes only if workers can actually reach it and it is confidential.',
exampleSource: 'Policy document, provider contract, intranet page',
calcRole: 'score.G.policyToggleScore',
frameworkMappings: [],
},
{
key: 'policy_data_privacy',
label: 'Data privacy policy in force',
description: 'A written data protection policy is adopted and current.',
unit: null,
category: 'G',
inputType: 'boolean',
helpText: 'Yes only if written, approved, and current.',
exampleSource: 'The policy document itself',
calcRole: 'score.G.policyToggleScore',
frameworkMappings: [],
},

// ─── SCOPE 3 (Phase 7 dependency) ───────────────────────────────────────────
{
key: 'supplier_spend_total',
label: 'Total supplier spend',
description: 'Total spend with suppliers during the period, used for spend-based Scope 3.',
unit: 'currency',
category: 'E',
inputType: 'number',
helpText:
'Spend-based Scope 3 is the roughest method available. Every supplier who responds to a request replaces a slice of this estimate with real data, and your data quality score rises.',
exampleSource: 'Accounts payable ledger, purchase report by category',
calcRole: 'scope3.spendBased',
frameworkMappings: [],
},
{
key: 'business_travel_km',
label: 'Business travel distance',
description: 'Distance travelled for business by air, rail, and non-owned road vehicles.',
unit: 'km',
category: 'E',
inputType: 'number',
helpText: 'Travel in vehicles you do not own or lease. Fleet fuel belongs in Scope 1.',
exampleSource: 'Travel agency report, expense system export',
calcRole: 'scope3.businessTravel',
frameworkMappings: [],
},
]

/**

- PHASE 1C — parse EFRAG IG 3 (Excel) + SEBI BRSR annexure from /docs and populate
- frameworkMappings against these keys. IG 3 already carries a unique DP identifier per
- datapoint, so the mapping is a join, not an interpretation.
-
- Blocking rule for Phase 1c: if a metric has no defensible mapping in the source document,
- it gets NO mapping. A gap in coverage is a product limitation the user can see and work
- around. A wrong mapping is a filing error they cannot.
  */
