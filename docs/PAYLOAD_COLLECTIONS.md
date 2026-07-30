# Payload collections — append-only protocol (F0a)

Feature chats must **append** new collection imports and one `collections` array entry.
Never reorder, rename, or reformat unrelated entries in [`src/payload.config.ts`](../src/payload.config.ts).

## Rules

1. Prefer **field-extend** on an existing collection over inventing a duplicate.
2. New collections: add import next to related domain imports, then append to the `collections` array.
3. One chat owns one config commit when parallelizing — serialize `payload.config.ts` merges.
4. After adding a collection, regenerate types if the project workflow requires it (`payload generate:types` / build).

## Collision board (16-feature plan)

| Chat  | May touch                                                          | Mode                                                                      |
| ----- | ------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| F1    | `WebhookRegistrations`, `WebhookLogs` (or append `DataImportLogs`) | extend / append                                                           |
| F2    | `Reports`, maybe `ReportTemplates`                                 | field extend                                                              |
| F3    | `EmissionFactors`, `Organisations` (standard setting)              | field extend                                                              |
| F4    | `Scenarios`                                                        | field extend                                                              |
| F5    | `IoTDevices`, append `IoTDataStreams` if needed                    | append / extend                                                           |
| F6    | `BenchmarkStats`                                                   | extend only                                                               |
| F7    | `SpendBasedEmissions` / custom factors                             | extend / append                                                           |
| F8    | TCFD/ISSB collections                                              | **append only**                                                           | `tcfd-disclosures`, `issb-disclosures` |
| F9    | `DatabaseConnections`, `DatabaseSyncLogs`                          | **append only**                                                           |
| F10   | `Suppliers` fields                                                 | extend                                                                    |
| F11   | API keys collection if needed                                      | append                                                                    |
| F12   | `SupplierPortalConfig`                                             | append                                                                    |
| F13   | `ReportTemplates` + assessments                                    | extend / append                                                           |
| F14   | `EmailDataCollectionForms`, `EmailImportLogs`                      | extend / append                                                           |
| F15   | none (theme cookie)                                                | no payload                                                                |
| F16   | `DatapointVersions`; maybe `Datapoints`                            | append / extend                                                           |
| Bonus | `AssurancePartners`                                                | seed + extend (`firmType`, `countries[]`; `pnpm seed:assurance-partners`) |

## Currently registered (do not reorder casually)

See `collections: [...]` in `src/payload.config.ts`. Key slugs already present for this plan: `webhook-registrations`, `webhook-logs`, `emission-factors`, `scenarios`, `iot-devices`, `benchmark-stats`, `spend-based-emissions`, `custom-emission-factors`, `report-templates`, `email-data-collection-forms`, `assurance-partners`, `product-level-footprinting`, `tcfd-disclosures`, `issb-disclosures`, `database-connections`, `database-sync-logs`, `bi-api-keys`, `supplier-portal-config`, `compliance-assessments`, `email-import-logs`, `datapoint-versions`.
