# Payload collections — append-only protocol (F0a)

Feature chats must **append** new collection imports and one `collections` array entry.
Never reorder, rename, or reformat unrelated entries in [`src/payload.config.ts`](../src/payload.config.ts).

## Rules

1. Prefer **field-extend** on an existing collection over inventing a duplicate.
2. New collections: add import next to related domain imports, then append to the `collections` array.
3. One chat owns one config commit when parallelizing — serialize `payload.config.ts` merges.
4. After adding a collection, regenerate types if the project workflow requires it (`payload generate:types` / build).

## Collision board (16-feature plan)

| Chat          | May touch                                                                                                       | Mode                                                                                                                       |
| ------------- | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| F1            | `WebhookRegistrations`, `WebhookLogs` (or append `DataImportLogs`)                                              | extend / append                                                                                                            |
| F2            | `Reports`, maybe `ReportTemplates`                                                                              | field extend                                                                                                               |
| F3            | `EmissionFactors`, `Organisations` (standard setting)                                                           | field extend                                                                                                               |
| F4            | `Scenarios`                                                                                                     | field extend                                                                                                               |
| F5            | `IoTDevices`, append `IoTDataStreams` if needed                                                                 | append / extend                                                                                                            |
| F6            | `BenchmarkStats`                                                                                                | extend only                                                                                                                |
| F7            | `SpendBasedEmissions` / custom factors                                                                          | extend / append                                                                                                            |
| F8            | TCFD/ISSB collections                                                                                           | **append only**                                                                                                            | `tcfd-disclosures`, `issb-disclosures` |
| F9            | `DatabaseConnections`, `DatabaseSyncLogs`                                                                       | **append only**                                                                                                            |
| F10           | `Suppliers` fields                                                                                              | extend                                                                                                                     |
| F11           | API keys collection if needed                                                                                   | append                                                                                                                     |
| F12           | `SupplierPortalConfig`                                                                                          | append                                                                                                                     |
| F13           | `ReportTemplates` + assessments                                                                                 | extend / append                                                                                                            |
| F14           | `EmailDataCollectionForms`, `EmailImportLogs`                                                                   | extend / append                                                                                                            |
| F15           | none (theme cookie)                                                                                             | no payload                                                                                                                 |
| F16           | `DatapointVersions`; maybe `Datapoints`                                                                         | append / extend                                                                                                            |
| Bonus         | `AssurancePartners`                                                                                             | seed + extend (`firmType`, `countries[]`; `pnpm seed:assurance-partners`)                                                  |
| S6.2          | `RegulatoryDeadlines`                                                                                           | field extend (catalog + applicability; `pnpm seed:regulatory-deadlines`)                                                   |
| S6.3          | `ScheduledReports`                                                                                              | **append only**                                                                                                            |
| S6.4          | `ComplianceObligations`                                                                                         | field extend (`checklistStatus`, `owner`, `evidenceLink`)                                                                  |
| S6.5          | `TrendForecasts` + `Organisations.expectedRevenueGrowth`                                                        | field extend                                                                                                               |
| S7.1          | `AccountingConnections` + `IntegrationSyncLogs`                                                                 | field extend (Wave, encrypted tokens, mapping, sandbox mode)                                                               |
| S7.2          | `SbtiTargets` + `Organisations.sbti`                                                                            | **append** `SbtiTargets`; field-extend Organisations                                                                       |
| S7.3          | `DecarbonizationPathways`                                                                                       | field extend (`milestones`, `feasibility`, `timeline`, `costEstimate`)                                                     |
| S8.1          | `SupplyChainNetworks`                                                                                           | field extend (`networkKey`, `scope`, `location`, `estimated`, tiers 1–5)                                                   |
| S8.2          | `ISO14064Compliance`                                                                                            | field extend (`sections` Part1/2, `verifierAssigned`, review dates; seed 30)                                               |
| S8.3          | `SupplierQuestionnaire` + `Suppliers.emailConsent`                                                              | field extend (statuses, publicToken, startedAt, notes, customSections)                                                     |
| S9.1          | `GreenTaxonomyAssessments`                                                                                      | **append only** (NACE + 6 objectives + DNSH; bundled NACE Rev. 2)                                                          |
| S9.2          | `Suppliers` + `Scope3Activities`                                                                                | field-extend (`tier`, `directSpend`, `estimatedEmissions`, `estimationMethod`, `naceCode`; Scope3 `supplier`+`supplyTier`) |
| S9.3          | `Organisations`                                                                                                 | field-extend (`parentOrganisation`, `consolidationMethod`, `ownershipPercent`) — distinct from consultancy `parentOrg`     |
| S10.1 / S10.3 | `ReportEmbedTokens`                                                                                             | **append only** (opaque UUID share/embed tokens; usageCount; revoke; 7-day default)                                        |
| S10.2         | `IoTGateways`                                                                                                   | **append only**; field-extend `IoTDevices.gateway`                                                                         |
| S10.6         | none (reads `reports`, `tcfd-disclosures`, `issb-disclosures`, `materiality-assessments`, `compliance-targets`) | no payload change — multi-framework assembly in `lib/reports/multiFramework`                                               |

## Currently registered (do not reorder casually)

See `collections: [...]` in `src/payload.config.ts`. Key slugs already present for this plan: `webhook-registrations`, `webhook-logs`, `emission-factors`, `scenarios`, `iot-devices`, `iot-gateways`, `benchmark-stats`, `spend-based-emissions`, `custom-emission-factors`, `report-templates`, `email-data-collection-forms`, `assurance-partners`, `product-level-footprinting`, `tcfd-disclosures`, `issb-disclosures`, `database-connections`, `database-sync-logs`, `bi-api-keys`, `supplier-portal-config`, `compliance-assessments`, `email-import-logs`, `datapoint-versions`, `scheduled-reports`, `sbti-targets`, `decarbonization-pathways`, `supply-chain-networks`, `iso-14064-compliance`, `green-taxonomy-assessments`, `report-embed-tokens`.
