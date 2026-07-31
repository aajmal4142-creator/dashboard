# ClearESG Sprints 6–10 — Living Plan

**Source of truth:** `docs/SPRINT_6_10_IMPLEMENTATION_PROMPTS.md`  
**Also honor:** `BUILD_PLAN.md`, `.cursor/rules/clearesg.mdc`, `docs/PAYLOAD_COLLECTIONS.md`  
**Mode:** gap-fill / complete / enhance per feature prompt  
**Order:** S6 → S7 → S8 → S9 → S10 (no skips). Features sequential within sprint unless prompt says independent.

**Quality bar:** tokens only · Membership ABAC on mutations · pure `lib/calc` (no I/O) · cookie `clearesg-theme` · zero `any` · no `prefers-color-scheme`

**Out of scope:** mobile/offline · paid APIs · force-push · commits without explicit ask

---

## Status legend

| Status        | Meaning                         |
| ------------- | ------------------------------- |
| `pending`     | Not started                     |
| `in_progress` | Subagent / orchestrator working |
| `done`        | DONE WHEN verified              |
| `blocked`     | Blocked — see notes             |

---

## Sprint 6 — Quick Wins (36h)

| ID   | Feature                          | Status | Files touched                                                                                                                                                                                             | Notes                                                                                                          |
| ---- | -------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| S6.1 | Intensity Metrics                | `done` | `consumptionIntensity.ts` (+test), intensity API/route, `ConsumptionIntensity.tsx`, `analytics/intensity/page.tsx`, `RunwayIntensityCard.tsx`, `RunwayView.tsx`, Organisations fields, `payload-types.ts` | Gap-fill complete. Null-on-zero denom; all types + YoY + peer median; 18 tests; build clean.                   |
| S6.2 | Regulatory Calendar              | `done` | `RegulatoryDeadlines.ts`, `deadlineApplicability.ts` (+test), `deadlineSeed.ts`, deadlines APIs (list/upcoming/status), calendar UI, seed script, `payload-types`                                         | Rules + 33 seeds; days/urgent server-side; 13 tests. Run `pnpm seed:regulatory-deadlines` on live DB.          |
| S6.3 | Scheduled Report Delivery        | `done` | `ScheduledReports` collection, `scheduleMath.ts` (+test), `reportScheduler.ts`, cron `/api/cron/reports/send-scheduled`, schedule APIs, `ScheduleDeliveryModal`, email template, `vercel.json` cron       | Pure UTC nextRunAt; retry 3× backoff; idempotent claims; Resend optional (console fallback).                   |
| S6.4 | Compliance Checklist Export      | `done` | `checklistExport.ts` (+test), Excel/PDF builders, export route, `ExportChecklistButton`, ComplianceObligations fields (`checklistStatus`, `owner`, `evidenceLink`)                                        | Confirmed-only export; PDF sections by category; Excel auto-filter/freeze/status colours; 12 tests; tsc clean. |
| S6.5 | Predictive Forecasting UI        | `done` | `forecast.ts` (+test), `loadEmissionsByPeriod.ts`, TrendForecasts fields, Organisations.`expectedRevenueGrowth`, calculate API, `TrendForecasting.tsx`, report snapshot/PDF forecast                      | Linear regression + scenarios; CI required; 13 unit tests; PDF via `buildReportForecastSection`.               |
| S6.6 | Real-time Dashboards (WebSocket) | `done` | `src/lib/realtime/*` (hub/SSE/backoff/broadcast), `/api/ws/dashboard` SSE, `/api/app/realtime/kpis` REST, Datapoints afterChange + reports emit, `useDashboardRealtime`, `RunwayRealtimeClient`           | SSE (not WS) for Vercel; in-process hub; 10 unit tests; build clean.                                           |

**Sprint 6 build:** `pnpm build` clean (orchestrator re-verified 2026-07-30)

---

## Sprint 7 — Integrations & Targets

| ID   | Feature                  | Status | Files touched                                                                                                                                                                                          | Notes                                                                         |
| ---- | ------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| S7.1 | Accounting Connectors    | `done` | `lib/integrations/accounting/*`, AccountingConnections enhance, accounting APIs + AccountingClient, categoryMapping tests                                                                              | OAuth+sandbox for QB/Xero/Wave; AES-GCM tokens; spend→emissions; 21 tests     |     |
| S7.2 | SBTi Target Tracking     | `done` | `SbtiTargets`, Organisations.`sbti`, `sbtiProgress.ts` (+test), `sbtiService.ts`, APIs `/api/app/compliance/sbti*`, `/compliance/sbti-tracking`, nav + analytics `?tab=`                               | Wizard + progress ring/timeline + scenario projections; 17 tests; build clean |
| S7.3 | Decarbonization Pathways | `done` | `pathwayPlanner.ts` (+test), `pathwayService.ts`, DecarbonizationPathways field-extend (milestones/feasibility/timeline), APIs POST/GET/[id]/milestones/feasibility, `PathwayPlanner.tsx` wizard+chart | Pure calc + feasibility >15% warn; 15 tests; build clean                      |

**Sprint 7 build:** S7.1–S7.3 build clean (2026-07-30)

---

## Sprint 8 — Supply Chain & ISO

| ID   | Feature                       | Status | Files touched                                                                                                                                                                                                                                                   | Notes                                                                                               |
| ---- | ----------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| S8.1 | Supply Chain Mapping          | `done` | `SupplyChainNetworks` field-extend, `supplyChainMap.ts` (+test), `supplyChainService.ts`, APIs create/get/tiers/export + map, SVG `SupplyChainMapClient`, nav                                                                                                   | Radial SVG (no D3); Tier 1 from Suppliers + Tier 2/3 estimates; scope tokens; 12 tests; build clean |
| S8.2 | ISO 14064 Checklist           | `done` | `ISO14064Compliance` field-extend (`sections`, verifier), `iso14064Seed` (30), progress/service (+test), APIs create/get/items/progress/verifier, `/compliance/iso-14064` UI                                                                                    | Seed catalog; evidence required to complete; Part1/Part2 collapsible; verifier notice               |
| S8.3 | Supplier Engagement Workflows | `done` | `SupplierQuestionnaire` field-extend (statuses/publicToken/startedAt/notes), `Suppliers.emailConsent`, `engagementWorkflow` (+test), `engagementService`, APIs send/public get/submit/review/list, `/s/q/[token]`, `/suppliers/engagement`, cron reminders 7/14 | Consent-gated email; public fill; review notes; 14 unit tests                                       |

**Sprint 8 build:** S8.1–S8.3 build clean (2026-07-30)

---

## Sprint 9 — Taxonomy & Consolidation

| ID   | Feature                        | Status | Files touched                                                                                                                                                                                                                                                      | Notes                                                                                            |
| ---- | ------------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| S9.1 | Green Taxonomy Compliance      | `done` | `GreenTaxonomyAssessments`, `lib/compliance/greenTaxonomy/*` (NACE Rev.2 + 6 objectives/DNSH + pure alignment + PDF), APIs list/create/get/answers/report/pdf, `/compliance/green-taxonomy` wizard, nav                                                            | Non-applicable excluded from overall %; bundled NACE catalog; unit tests; build clean            |
| S9.2 | Tier 2/3 Supplier Emissions    | `done` | `tier2Emissions.ts` (+test), `industryIntensity.ts`, `tier2EmissionsService.ts`, Suppliers+Scope3Activities field-extend, APIs tier-2-estimate/emissions/survey + category-1-breakdown, `/suppliers/[id]/tier-emissions`, `/scope3/category-1`, map tier breakdown | Hybrid actual                                                                                    | industry | top_down; no double-count; NACE never assumed; confidence always shown |
| S9.3 | Multi-Org Consolidated Reports | `done` | `Organisations` field-extend (`parentOrganisation`, `consolidationMethod`, `ownershipPercent`), `lib/consolidation/*` (+test), APIs consolidated/hierarchy, OrgSwitcher tree, `/settings/org-hierarchy`, Reports include-subsidiaries + CSV                        | Explicit parent only; circular reject; Membership-gated; ownership path multiply; 14+ unit tests |

**Sprint 9 build:** `pnpm build` clean (orchestrator 2026-07-30 / 2026-07-31)

---

## Sprint 10 — Reports & Delivery

| ID    | Feature                              | Status | Files touched                                                                                                                                                                                                           | Notes                                                                                            |
| ----- | ------------------------------------ | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| S10.1 | Interactive HTML Reports             | `done` | `ReportEmbedTokens`, `htmlReport.ts` (+test), `htmlReportShare.ts`, `InteractiveHtmlReport.tsx`, `/reports/[id]/html`, `/r/html/[token]`, APIs html/embedded/share-link, `ReportExportModal`, next.config embed headers | Recharts interactive; 7-day tokens + audit; print CSS; 11 tests; build clean                     |
| S10.2 | IoT Gateway Management               | `done` | `IoTGateways`, `IoTDevices.gateway`, `gatewayHealth.ts` (+test), gateways CRUD/status/assign APIs, `/integrations/iot/gateways` + devices UI                                                                            | Encrypted credentials; online/offline/stale; failover peer; 12 tests; build clean                |
| S10.3 | Embed Reports in Websites            | `done` | ReportEmbedTokens enhance, embed-token POST/GET/DELETE APIs, `/public/reports/embed/[token]`, ShareReportModal (link+QR+embed+revoke), CSP frame-ancestors, htmlReport helpers (+test)                                  | Opaque UUID; 7-day default TTL; rate-limited; 14 tests; build clean                              |
| S10.4 | JSON/XML Export                      | `done` | `machineExport.ts` (+test), `GET /api/app/reports/[id]/export?format=json\|xml\|csv`, ReportExportModal + ReportsClient links, ScheduledReports xml                                                                     | Confirmed datapoints only; schema field names; esg: XML ns; 8 tests; build clean                 |
| S10.5 | API Report Delivery                  | `done` | `reportDelivery.ts` (+test), `POST/GET /api/app/webhooks`, `/reports/[id]/deliver` + `/deliveries`, publish auto-fire, register headers/retry                                                                           | report.generated; 3× exponential retry; auth headers masked in logs; published-only; build clean |
| S10.6 | Multi-Framework Consolidated Reports | `done` | `multiFramework/` assemble+load+PDF (+test), `GET /api/app/reports/multi-framework/[period]`, MultiFrameworkReportPanel                                                                                                 | Skip incomplete; single emissions owner + cross-refs; up to 4 frameworks; 12 tests; build clean  |

**Sprint 10 build:** `pnpm build` clean (orchestrator final gate 2026-07-31)

---

## Orchestrator log

| When       | Event                                                                                                                                                                                                                   |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-07-30 | Plan created. Kickoff S6.1 Intensity Metrics.                                                                                                                                                                           |
| 2026-07-30 | S6.1 done — verified DONE WHEN + 18 tests. Kickoff S6.2.                                                                                                                                                                |
| 2026-07-30 | S6.2 done — verified routes/seed/tests. Kickoff S6.3.                                                                                                                                                                   |
| 2026-07-30 | S6.3 done — ScheduledReports + cron + APIs + UI + 14 tests. Kickoff S6.4.                                                                                                                                               |
| 2026-07-30 | S6.4 done — obligations checklist PDF/Excel export + field extend + 12 tests. Kickoff S6.5.                                                                                                                             |
| 2026-07-30 | S6.5 done — linear regression + scenarios; CI required; 13 unit tests; PDF via `buildReportForecastSection`. Kickoff S6.6.                                                                                              |
| 2026-07-30 | S6.6 done — authenticated SSE at `/api/ws/dashboard` + REST KPI fallback; in-process hub; runway live KPIs; 10 tests; build clean.                                                                                      |
| 2026-07-30 | **Sprint 6 GATE: `pnpm build` clean.** All S6.1–S6.6 done. Kickoff S7.1.                                                                                                                                                |
| 2026-07-30 | **S7.1 done.** QB/Xero/Wave connectors with encrypted tokens, sandbox OAuth, category mapping wizard, spend-based sync. Kickoff S7.2.                                                                                   |
| 2026-07-30 | **S7.2 done.** SbtiTargets + pure progress (reduction %, on-track bands) + wizard/dashboard + scenario recalculation; 17 tests; build clean. Kickoff S7.3.                                                              |
| 2026-07-30 | **S7.3 done.** Pathway model + pure calculator (milestones/feasibility/actual comparison) + wizard UI + timeline chart; APIs create/get/milestones/feasibility; 15 tests; build clean.                                  |
| 2026-07-30 | **Sprint 7 GATE: `pnpm build` clean.** S7.1–S7.3 done. Kickoff S8.1.                                                                                                                                                    |
| 2026-07-30 | **S8.1 done.** Supply chain radial SVG map + network APIs (create/get/tiers/export); Tier 1 auto + Tier 2/3 estimates; 12 unit tests; build clean. Kickoff S8.2.                                                        |
| 2026-07-30 | **S8.2 done.** ISO14064Compliance sections (Part1/2), 30-item seed catalog, progress APIs + evidence gate, verifier assign + notice, checklist UI; unit tests; build clean. Kickoff S8.3.                               |
| 2026-07-30 | **S8.3 done.** Supplier engagement workflows: consent-gated send, public `/s/q/[token]`, submit/review APIs, day-7/14 cron reminders, engagement UI; unit tests; build clean.                                           |
| 2026-07-30 | **S9.1 done.** GreenTaxonomyAssessments + NACE Rev.2 catalog + 6 objectives/DNSH questionnaire + pure alignment (non-applicable excluded) + wizard/results/PDF; unit tests; build clean.                                |
| 2026-07-30 | **Sprint 8 GATE: `pnpm build` clean** (orchestrator re-verified). Kickoff S9.2.                                                                                                                                         |
| 2026-07-30 | **S9.2 done.** Hybrid Tier 2/3 estimator (actual                                                                                                                                                                        | industry_avg | top_down); Suppliers+Scope3Activities field-extend; Cat1 breakdown API/UI; map tier split; 14 unit tests; build clean. Kickoff S9.3. |
| 2026-07-31 | **S9.3 done.** Org hierarchy + pure consolidation (ownership path) + circular reject + Membership APIs/UI + CSV; 15 tests; build clean.                                                                                 |
| 2026-07-31 | **Sprint 8 & 9 GATE: `pnpm build` clean.** Kickoff S10.1.                                                                                                                                                               |
| 2026-07-30 | **S9.3 done.** Multi-org consolidation: Organisations hierarchy fields; pure consolidate (path ownership, circular reject); APIs; OrgSwitcher indent; settings page; Reports toggle+CSV; unit tests.                    |
| 2026-07-31 | **S10.1 done.** Interactive HTML reports + embed tokens; Recharts filters/sort; 7-day share; print CSS; 11 tests; build clean. Kickoff S10.2.                                                                           |
| 2026-07-31 | **S10.2 done.** IoTGateways multi-gateway + encrypted credentials + device assign/CSV + health/failover; 12 tests; build clean. Kickoff S10.3.                                                                          |
| 2026-07-31 | **S10.3 done.** Embed tokens mint/list/revoke; public iframe embed; Share modal with QR; CSP; 14 tests; build clean. Kickoff S10.4.                                                                                     |
| 2026-07-31 | **S10.4 done.** JSON/XML machine export from report snapshot + confirmed datapoints; schema field names; Membership export route; 8 tests; build clean. Kickoff S10.5.                                                  |
| 2026-07-31 | **S10.5 done.** report.generated webhooks; deliver/deliveries APIs; publish auto-fire; retry/backoff + masked auth logs; unit tests; build clean. Kickoff S10.6.                                                        |
| 2026-07-31 | **S10.6 done.** Multi-framework consolidated report (CSRD/TCFD/ISSB/GRI); skip incomplete; emissions dedup + cross-refs; PDF + JSON API; unit tests; build clean.                                                       |
| 2026-07-31 | **Sprint 10 GATE: `pnpm build` clean.** All S6–S10 (31 features) complete.                                                                                                                                              |
| 2026-07-31 | **QA pass:** rebuilt stale `next start` on :3010; seeded 33 regulatory deadlines; fixed urgency overdue filter, nav gaps, forecast copy, accounting step labels; 271 unit tests green; browser E2E across S6–S10 pages. |
