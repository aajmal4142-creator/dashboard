# ClearESG Implementation Master Prompt File - COMPLETE

**Last Updated**: July 29, 2026  
**Total Features**: 40 non-AI  
**Total Hours**: 246h  
**Format**: Copy feature prompt → Tag chat with Feature ID → I implement

---

# TABLE OF CONTENTS

- [SPRINT 1: CRITICAL FOUNDATION](#sprint-1-critical-foundation-week-1-2)
  - DC-001, CF-001, SM-001, BC-001
- [SPRINT 2: COMPLIANCE & FRAMEWORKS](#sprint-2-compliance--frameworks-week-3-4)
  - SF-001, SF-002, SF-003, SF-004, SF-005
- [SPRINT 3: SUPPLIER ECOSYSTEM](#sprint-3-supplier-ecosystem-week-5-6)
  - SM-002 to SM-007
- [SPRINT 4: ANALYTICS & INSIGHTS](#sprint-4-analytics--insights-week-7-8)
  - AN-001 to AN-005
- [SPRINT 5: INTEGRATIONS PART 1](#sprint-5-integrations-part-1-week-9-10)
  - INT-001 to INT-003
- [SPRINT 6: INTEGRATIONS PART 2](#sprint-6-integrations-part-2-week-11-12)
  - INT-004 to INT-007
- [SPRINT 7: PLATFORM & UX POLISH](#sprint-7-platform--ux-polish-week-13-14)
  - UX-001 to UX-004
- [SPRINT 8: FINAL FEATURES](#sprint-8-final-features-week-15-16)
  - All remaining features

---

---

# SPRINT 1: CRITICAL FOUNDATION (Week 1-2)

## ✅ Status: COMPLETED (Implementation)

**4 Features | 24 Hours | All can run in parallel**

---

## DC-001: API/Webhook Data Ingestion (8h) - ✅ IMPLEMENTED

```
# Implementation Task: API/Webhook Data Ingestion (DC-001)

**Feature ID**: DC-001
**Priority**: 🔴 CRITICAL
**Effort**: 8 hours
**Status**: ✅ IMPLEMENTED
**Target Segments**: Mid-Market, Growth, Enterprise, Specialist

## Task Overview
Implement REST API endpoints and webhook receiver for third-party data ingestion. Enables enterprise customers to push real-time data without manual CSV imports.

## Acceptance Criteria (ALL must be met)
- [x] REST API endpoint: POST /api/app/data/ingest
- [x] Webhook registration: POST /api/app/webhooks/register
- [x] Webhook receiver: POST /api/app/webhooks/events
- [x] Webhook management: GET/DELETE /api/app/webhooks
- [x] Request signature verification (HMAC-SHA256)
- [x] Rate limiting (1000 requests/hour per org)
- [x] Retry logic with exponential backoff (1s, 2s, 5s, 10s)
- [x] Full audit logging for all API calls
- [x] Error handling with meaningful error codes (API-001 to API-050)
- [x] Support for batch payloads (100-1000 items)
- [x] Support for real-time single payloads
- [x] API documentation (OpenAPI 3.0 spec)
- [x] Security: TLS 1.2+, webhook secret rotation, request timeout (30s max)
- [x] ABAC enforcement on all endpoints
- [x] Dead letter queue for failed retries

## Implementation Breakdown

### Task 1: API Route Structure (2 hours)
- `src/app/(frontend)/api/app/data/ingest/route.ts` — POST handler
- `src/app/(frontend)/api/app/webhooks/register/route.ts` — CRUD handler
- `src/app/(frontend)/api/app/webhooks/events/route.ts` — Receiver handler
- Middleware: signature verification, ABAC check, rate limiting
- HTTP status codes: 200, 400, 401, 403, 429, 500

### Task 2: Database Schema (1 hour)
1. **WebhookRegistrations** collection
   - Fields: org_id, webhook_id, endpoint_url, secret (encrypted), events, status, created_at, updated_at, last_triggered_at
   - Indexes: org_id, webhook_id, status

2. **WebhookLogs** collection
   - Fields: webhook_id, event_type, payload, status, response_code, error_message, attempt_number, next_retry_at, timestamp
   - TTL: auto-delete after 90 days
   - Performance: handle 10K+ logs/day

### Task 3: Core Services (3 hours)
1. **webhookService.ts**
   - registerWebhook(), listWebhooks(), deleteWebhook(), triggerWebhook(), rotateSecret()

2. **webhookValidator.ts**
   - verifySignature() using HMAC-SHA256
   - Timestamp validation (reject if >5 min old)

3. **webhookQueue.ts**
   - Bull queue (Redis-backed) for async processing
   - Retry: exponential backoff, max 4 retries
   - Dead letter queue for failures

4. **rateLimiter.ts**
   - Use Upstash Redis
   - Limit: 1000 requests/hour per org
   - Return 429 when exceeded

### Task 4: Data Validation & Ingestion (2 hours)
1. **ingestDatapoint.ts**
   - Validate against Datapoints schema (Zod)
   - Check org quota
   - Auto-categorize if missing
   - Audit log: "webhook_ingest:success"

2. **batchIngest.ts**
   - Accept 1-1000 datapoints
   - Parallel processing (Promise.all, max 10 concurrent)
   - Partial success handling

### Task 5: Error Handling & Logging (1 hour)
- Error codes: API-001 to API-050
- Structured JSON logs (no plain text)
- Never log: payloads, secrets, PII

### Task 6: Security & TLS (1 hour)
- Enforce HTTPS (301 redirect if HTTP)
- TLS 1.2+ validation
- Webhook secret rotation (old + new valid 7 days)
- Max payload: 1MB
- CORS: only registered webhook domains

## Code Quality Standards
✅ TypeScript strict, 0 `any` types
✅ 80%+ test coverage
✅ <100ms p95 latency
✅ ABAC on all endpoints
✅ OpenAPI 3.0 documentation

## Production Readiness
- [ ] All tests passing
- [ ] Load test: 1000 req/min sustained
- [ ] Security audit: OWASP Top 10
- [ ] Monitoring alerts configured
- [ ] Backward compatibility verified

```

---

## CF-001: GHG Protocol 2004 Compliance (8h) - ✅ IMPLEMENTED

```
# Implementation Task: GHG Protocol 2004 Compliance (CF-001)

**Feature ID**: CF-001
**Priority**: 🔴 CRITICAL
**Effort**: 8 hours
**Status**: ✅ IMPLEMENTED

## Task Overview
Implement GHG Protocol 2004/2015 compliance checklist system ensuring emissions calculations meet international standards and are audit-ready.

## Acceptance Criteria
- [x] 50+ GHG Protocol requirements as checklist items
- [x] Scope 1, 2, 3-specific checklists
- [x] Compliance score calculation (0-100%)
- [x] Scope boundary validation (organizational, operational, equity)
- [x] Emissions calculation methodology documentation
- [x] Data quality assessment
- [x] Compliance report generation (audit-ready PDF)
- [x] Evidence linking
- [x] Assurance auditor sign-off capability (locked after signed)
- [x] Framework mapping (CSRD, BRSR, GRI, SASB)
- [x] Regulatory requirement tracking
- [x] Immutable audit trail

## Implementation Breakdown

### Task 1: GHG Protocol Data Model (2 hours)
1. **GhgProtocolCompliance** collection
   - org_id, compliance_year, scope1_total, scope2_total, scope3_total
   - boundary_definition, methodology, data_quality_score, compliance_score
   - is_verified, verified_by, verified_at

2. **ComplianceCheckpoints** collection
   - org_id, compliance_id, checkpoint_id, category, requirement_name
   - requirement_code, status, evidence_link, notes
   - Constraint: immutable after verified_at set

3. **ComplianceHistory** collection (audit trail)

### Task 2: Compliance Checklist Engine (2 hours)
- checklistService.ts: getChecklist(), updateCheckpoint(), verifyCheckpoint(), calculateComplianceScore()
- ghgProtocolRules.ts: 50+ requirements as hardcoded data
- boundaryValidator.ts: validateBoundary() with org/operational checks

### Task 3: Data Quality Assessment (1.5 hours)
- dataQualityAssessor.ts: calculate score (completeness, accuracy, consistency, recency)
- Return: { score, breakdown }

### Task 4: Compliance Report Generator (2 hours)
- reportGenerator.ts: generateComplianceReport() → PDF
- narrativeGenerator.ts: auto-generate narrative text
- Use react-pdf for generation

### Task 5: Framework Mapping (1.5 hours)
- frameworkMapper.ts: map checkpoints to CSRD, BRSR, GRI, SASB

### Task 6: API Routes (1 hour)
- GET /api/app/compliance/checklist
- PATCH /api/app/compliance/checklist/[id]
- POST /api/app/compliance/verify/[id]
- POST /api/app/compliance/lock
- GET /api/app/compliance/report/[id]

### Task 7: UI Components (1 hour)
- /compliance/checklist page
- /compliance/report page

## Code Quality
- Immutable audit trail (cannot delete after verified)
- Timestamp all compliance decisions
- Multi-user approval workflows
- 80%+ test coverage

## Production Readiness
- [ ] All 50+ GHG Protocol requirements coded
- [ ] Compliance score verified manually
- [ ] Report PDF audit-ready
- [ ] Immutability verified
- [ ] External auditor validates logic

```

---

## SM-001: Free Supplier ESG Data Integration (8h) - ✅ IMPLEMENTED

```
# Implementation Task: Free Supplier ESG Data Integration (SM-001)

**Feature ID**: SM-001
**Priority**: 🔴 CRITICAL
**Effort**: 8 hours
**Status**: ✅ IMPLEMENTED

## Task Overview
Build supplier ESG data collection using 100% FREE resources:
1. **Manual questionnaire** (self-reported data from suppliers)
2. **UN Global Compact Database** (free, public data for 10K+ signatory companies)
3. **Public sustainability reports** (scrape company websites for ESG content)
4. **Government data** (EU ETS emissions registry, SEC filings)
5. **Risk scoring** based on data quality + completeness

**NO PAID SERVICES** - completely free, no EcoVadis cost.

## Context
- EcoVadis is paid ($2K-$50K/year) - NOT viable for free MVP
- Alternative: free questionnaire + public data aggregation
- MVP works with incomplete data (better to have partial truth than paid gatekeeping)
- Procurement teams value transparency over ratings anyway
- Production-ready, highly optimized code

## Acceptance Criteria
- [x] Supplier questionnaire (self-reported ESG data, 30+ questions)
- [x] UN Global Compact database sync (free API, ~10K companies)
- [x] Public sustainability report scraping (optional, auto-extract ESG mentions)
- [x] Government data integration (EU ETS emissions, SEC filings)
- [x] Data source tracking (show where each metric comes from)
- [x] Risk scoring from data completeness + quality (0-100)
- [x] Admin UI (manage data sources, manual sync, questionnaire status)
- [x] Data completeness dashboard (what % of supplier data collected)
- [x] Alert system (email when sufficient data for scoring)
- [x] Performance: process 1000 suppliers in <30s
- [x] No external paid API calls

## Implementation Breakdown

### Task 1: Supplier Questionnaire Service (2 hours)
- SupplierQuestionnaire collection: org_id, supplier_id, responses, submitted_at, status
- Questionnaire template: 30-40 questions (Scope 1/2/3, certifications, governance, goals)
- questionnaireService.ts: sendQuestionnaire(), submitQuestionnaire(), getCompletion(), remindSupplier()

### Task 2: UN Global Compact Sync (2 hours)
- UN GC Database: 10K+ free signatory companies
- uncGlobalCompactService.ts: fetchDatabase(), matchSupplier(), sync monthly
- Manual override for company signatory status

### Task 3: Government Data Integration (1.5 hours)
- EU ETS (European Emissions Trading System): 10K EU companies, free download
- SEC EDGAR (US Public Companies): free 10-K filings
- euEtsService.ts & secFilingService.ts: fetch, match, store with source tracking

### Task 4: Risk Scoring from Available Data (2 hours)
- riskScoringEngine.ts: Calculate risk (0-100) based on:
  - Questionnaire Completeness (40%)
  - UN Global Compact Status (20%)
  - Certifications (20%)
  - Government Data Availability (20%)
- Risk tiers: low (<30), medium (30-50), high (50-75), critical (>75)
- riskAlerts.ts: Email alerts when high-risk

### Task 5: Data Source Tracking (1 hour)
- SupplierDataSource: track origin for each metric (questionnaire/un_gc/eu_ets/sec_filing/manual)
- Confidence scores: questionnaire=60%, government=95%, manual=40%
- Show on supplier profile with verification date

### Task 6: Admin UI (1 hour)
- `/integrations/supplier-data/settings`: sync status, manual triggers, response rate
- `/suppliers/questionnaire/[supplier_id]`: completion progress, reminders
- `/suppliers/data-sources/[supplier_id]`: data lineage by source

## Code Quality
✅ TypeScript strict mode, 0 `any` types
✅ Risk score calculation: <100ms per supplier
✅ UN GC sync: 1000 suppliers in <10s
✅ Performance: <30s to process 1000 suppliers

## Production Readiness
- [x] Questionnaire template finalized
- [x] UN GC sync tested (data downloads, matches work)
- [x] Risk scoring validated
- [x] Admin UI functional
- [x] No paid API costs

```

---

## BC-001: Annual Billing with Discount (4h) - ✅ IMPLEMENTED

```
# Implementation Task: Annual Billing with Discount (BC-001)

**Feature ID**: BC-001
**Priority**: 🔴 CRITICAL
**Effort**: 4 hours
**Status**: ✅ IMPLEMENTED

## Task Overview
Add annual billing option with 15-20% discount. Improves cash flow and increases ACV.

## Acceptance Criteria
- [x] Annual billing option at checkout (next to monthly)
- [x] 15-20% discount for annual plans
- [x] Stripe price IDs for annual plans
- [x] Billing cycle toggle in account settings
- [x] Pro-rata calculation for mid-cycle changes
- [x] Automatic renewal on anniversary
- [x] Renewal reminders (60, 30, 7 days)
- [x] Manual renewal management UI
- [x] Invoice shows discount breakdown
- [x] Switch monthly ↔ annual mid-cycle with pro-rata
- [x] Subscription history tracks changes
- [x] Performance: handle 10K+ renewals/month

## Implementation Breakdown

### Task 1: Stripe Setup (1 hour)
Create annual price IDs:
- STRIPE_PRICE_STARTER_ANNUAL = monthly × 12 × 0.8
- STRIPE_PRICE_PROFESSIONAL_ANNUAL
- STRIPE_PRICE_ENTERPRISE_ANNUAL
- STRIPE_PRICE_TRIAL_ANNUAL
Store in .env

### Task 2: Database Schema (0.5 hours)
Add to Subscriptions:
- billing_cycle: 'MONTHLY' | 'ANNUAL'
- next_renewal_date, last_renewal_date
- annual_discount_percentage
- renewal_history array

### Task 3: Billing Logic (1.5 hours)
- stripeService.ts: createAnnualSubscription(), upgradeToAnnual(), downgradeToMonthly(), renew()
- prorataCalculator.ts: calculateProrata() for mid-cycle switches
- renewalScheduler.ts: daily cron to trigger renewals

### Task 4: Frontend (1 hour)
- Checkout: toggle Monthly/Annual with "Save 20%" badge
- Settings: show billing cycle, switch button, pro-rata confirm dialog
- Email templates: 60/30/7 day reminders

### Task 5: Subscription History (0.5 hours)
- SubscriptionHistory collection: subscription_id, action, previous/new cycle/plan, prorata_adjustment

## Code Quality
- All monetary calculations use Decimal (not float)
- Rounding matches Stripe (2 decimals)
- Pro-rata verified by finance
- Audit trail for all discounts

## Production Readiness
- [ ] Annual prices in Stripe
- [ ] Checkout shows both options
- [ ] Pro-rata verified by finance
- [ ] Renewal automation tested
- [ ] Email reminders working
- [ ] Switching cycles works

```

---

---

# SPRINT 2: COMPLIANCE & FRAMEWORKS (Week 3-4)

**5 Features | 40 Hours | Can run in parallel**

**Dependencies**: None (can start immediately after Sprint 1)

---

## SF-001: CSRD/ESRS Reporting (20h)

```
# Implementation Task: CSRD/ESRS Automated Reporting (SF-001)

**Feature ID**: SF-001
**Priority**: 🟠 HIGH
**Effort**: 20 hours
**Status**: ⬜ NOT STARTED

## Task Overview
Generate audit-ready ESRS (European Sustainability Reporting Standards) reports directly from ClearESG data. CSRD mandates ESRS disclosure by April 2026 for certain EU companies.

## Context
- Biggest driver: EU mandate for 500+ headcount companies
- Report must be audit-ready (auditors will review)
- Integration with double materiality assessment (SF-006, future)
- European market opportunity: +50% TAM

## Acceptance Criteria
- [ ] ESRS standard mapping (E1-E4 Environment, S1-S2 Social, G1-G2 Governance)
- [ ] Automated data population from datapoints, suppliers, assurance data
- [ ] ESRS compliance report generation (PDF, 20+ pages, audit-ready)
- [ ] Double materiality assessment integration
- [ ] Narrative auto-generation from framework mappings
- [ ] Data source documentation (which datapoint feeds which metric)
- [ ] External auditor review workflow
- [ ] Report versioning (track changes, attestation)
- [ ] Export to XBRL format (future compatibility)
- [ ] Performance: generate 50-page report in <10 seconds
- [ ] Regulation-specific metrics (GRI G1, GRI G4, ESRS GRI alignment)

## Implementation Breakdown

### Task 1: ESRS Data Model (3 hours)
Create ESRSCompliance collection:
- org_id, year, topics array
- E1: Climate (GHG emissions, scope 1/2/3, targets, decarbonization plan)
- E2: Pollution (air, water, soil, chemicals)
- E3: Water (consumption, stress areas, management)
- E4: Biodiversity (land use, species, restoration)
- S1: Own workforce (diversity, pay, safety, training)
- S2: Value chain (supplier practices, customer privacy, product safety)
- G1: Governance (board diversity, ethics, compliance)
- G2: Business conduct (compliance, lobbying, tax strategy)
- Each topic: disclosure_status, data_source, last_updated, verified_by, verified_at

### Task 2: Data Mapping Engine (5 hours)
Create mappingEngine.ts:
- Map ClearESG datapoints → ESRS metrics
- Example: Scope 1 emissions → E1-1-a (GHG Emissions)
- Use existing double materiality assessment to identify material topics
- Handle missing data: flag for completion with remediation tips
- Auto-calculate disclosure completeness %
- Return: { completeness: 85%, missing_metrics: [...], ready_for_filing: false }

### Task 3: Report Generator (8 hours)
Create reportGenerator.ts:
- React-pdf based report builder
- Sections:
  1. Executive summary (compliance status, material topics)
  2. Material topics identification (double materiality matrix)
  3. E1-E4 metrics with supporting data and sources
  4. S1-S2 metrics with supply chain data
  5. G1-G2 governance disclosures
  6. Appendices (methodology, data sources, external audit)
- PDF format: A4, bookmarked, TOC, page numbers, printable
- Audit-ready styling (formal, professional)
- Language: auto-translate narrative to EN/FR/DE/ES (future)

### Task 4: Narrative Engine (2 hours)
Create narrativeGenerator.ts:
- Auto-generate ESRS narrative based on data:
```

"Organization X has identified [Y] material topics per double materiality assessment.
Climate (E1) identified as most material. Scope 1 emissions: X tCO2e.
Scope 2: Y tCO2e. Scope 3: Z tCO2e. 2030 Target: reduce 50% vs 2024 baseline.
Progress: [current] vs target, on track/off track.

Governance: Board includes X% female, Y% ethnic diversity.
Executive compensation linked to ESG metrics (20% weighting).
[etc.]"

```
- Customize by topic, keep sentences concise

### Task 5: Assurance Integration (2 hours)
Create assuranceIntegration.ts:
- Link to assurance findings (from Days 26-35 work)
- Mark which metrics are assurance-verified (with auditor name, date)
- Lock report after auditor sign-off (immutable)
- Version tracking (report 1.0 → 1.1 after audit comments)
- Audit trail: what changed between versions

## API Routes
- `POST /api/app/esrs/generate` - Generate report
- `GET /api/app/esrs/[id]` - Download PDF
- `GET /api/app/esrs/mappings` - See data mapping
- `PATCH /api/app/esrs/[id]/verify` - Mark verified by auditor
- `GET /api/app/esrs/[id]/versions` - Report version history

## UI Components
- `/esrs/mapping` - Visual mapping of ClearESG data → ESRS metrics
- `/esrs/report/[id]` - Report viewer + download
- `/esrs/checklist` - Completeness tracker (85% complete, X metrics missing)

## Testing
- Unit: 20+ tests (mapping accuracy, narrative generation)
- Integration: Full report generation E2E
- Accuracy: Report data matches source datapoints (verified by manual audit)
- Performance: <10s for 50-page report
- Auditor acceptance: External auditor validates report format/completeness

## Code Quality
- 80%+ test coverage
- <10s report generation
- OpenAPI documentation
- Narrative generation accuracy >95%

## Production Readiness
- [ ] All ESRS E1-G2 topics implemented
- [ ] Report data matches source datapoints (audit verified)
- [ ] External auditor approves format
- [ ] Performance <10s for large orgs
- [ ] Narrative generation accuracy validated
- [ ] Tests: 20+ unit, 5+ integration passing

## Success Metrics
✅ COMPLETED when:
1. CSRD-ready report generates in <10s
2. Report data verified accurate (100% match to source)
3. External auditor can review without questions
4. Narrative auto-generation >95% accurate
5. All tests passing (20+ unit, 5+ integration)

---
```

---

## SF-002: TCFD Framework Support (12h)

```
# Implementation Task: TCFD Framework Support (SF-002)

**Feature ID**: SF-002
**Priority**: 🟠 HIGH
**Effort**: 12 hours
**Status**: ⬜ NOT STARTED

## Task Overview
Implement TCFD (Task Force on Climate-related Financial Disclosures) disclosure framework for public companies and regulated entities. TCFD is becoming de facto standard for investor disclosures.

## Context
- Target: Public companies, regulated entities (insurance, banking)
- 4 Pillars: Governance, Strategy, Risk Management, Metrics & Targets
- Integration with financial data (future: linked to Workiva/SAP)
- Investor relations use case (board-ready presentation)

## Acceptance Criteria
- [ ] TCFD disclosure mapping (Governance, Strategy, Risk, Metrics & Targets)
- [ ] Climate scenario analysis integration (1.5°C, 2°C, >3°C scenarios)
- [ ] Financial impact assessment ($ climate risk exposure)
- [ ] Task Force alignment verification
- [ ] Disclosure report generation (PDF, 10-15 pages)
- [ ] Board-ready presentation format
- [ ] Investor relations export (HTML for website embedding)

## Implementation Breakdown

### Task 1: TCFD Data Model (2 hours)
Create TCFDCompliance collection:
- org_id, year
- Governance: board oversight, management roles, linking pay to climate
- Strategy: business model changes, climate risks/opportunities, financial impact
- Risk Management: identify/assess/integrate climate risks
- Metrics: GHG emissions, transition plan progress, financial metrics (revenue at risk, capex for transition)

### Task 2: Scenario Analysis Engine (5 hours)
Create scenarioAnalyzer.ts:
- 3 climate scenarios: well-below 2°C, 2-3°C, >3°C warming
- For each scenario:
  - Calculate emissions trajectory (linear, exponential decay)
  - Estimate capex needs (renewable transition, facility upgrades)
  - Financial impact: revenue at risk, cost of capital, insurance costs
  - Opportunity: new revenue from green products
- Use IPCC/IEA data for scenario parameters
- Output: { scenario, capex_required, revenue_at_risk, opportunities_value }

### Task 3: Financial Impact Calculator (3 hours)
Create financialImpactCalculator.ts:
- $ exposure to climate risk (stranded assets, transition costs, opportunities)
- Methodology:
  - Stranded asset risk: % revenue from high-carbon products × carbon price trajectory
  - Transition cost: capex to decarbonize / years to target
  - Opportunity: new revenue from green products (% growth projection)
- Output: { total_risk_exposure, transition_cost, opportunity_value, net_impact }
- Sensitivity analysis: vary key assumptions (carbon price, tech cost)

### Task 4: Report Generator (2 hours)
Create tcfdReportGenerator.ts:
- TCFD disclosure report (PDF, 10-15 pages)
- Target audience: investors, regulators, board
- Sections: Governance, Strategy, Risk, Metrics, Financial Impact
- Format: professional, auditable
- Export: PDF + HTML for website

## API Routes
- `POST /api/app/tcfd/generate` - Generate report
- `GET /api/app/tcfd/[id]` - Download PDF
- `POST /api/app/tcfd/scenarios` - Run scenario analysis
- `GET /api/app/tcfd/financial-impact` - Get financial impact summary

## Testing
- Unit: 15+ tests (scenario calculations, financial impact)
- Integration: Full report generation
- Accuracy: Scenario assumptions validated against IPCC data
- Performance: <5s for report generation

## Code Quality
- 80%+ test coverage
- Scenario calculations verified by climate scientist
- <5s generation time

## Production Readiness
- [ ] All 4 TCFD pillars implemented
- [ ] Scenario analysis uses IPCC data
- [ ] Financial impact calculations validated
- [ ] Report PDF investor-ready
- [ ] Tests: 15+ passing

---
```

---

## SF-003: ISSB S1/S2 Standards (12h)

```
# Implementation Task: ISSB S1/S2 Standards Implementation (SF-003)

**Feature ID**: SF-003
**Priority**: 🟠 HIGH
**Effort**: 12 hours
**Status**: ⬜ NOT STARTED

## Task Overview
Implement ISSB (International Sustainability Standards Board) S1 (General) and S2 (Climate) standards. Becoming global baseline for sustainability disclosure (likely mandatory for public companies by 2027).

## Context
- Target: All companies, especially listed entities
- S1: Sustainability issues affecting business
- S2: Climate-specific (emissions, scenario analysis, governance)
- Replaces/supersedes GRI in many contexts (complementary, not competitive)

## Acceptance Criteria
- [ ] S1 (General) mapping: governance, strategy, risk management, metrics
- [ ] S2 (Climate) mapping: climate-specific requirements
- [ ] Materiality threshold assessment (quantitative + qualitative)
- [ ] Climate resilience indicators (1.5°C, 2°C scenarios)
- [ ] Governance structure documentation
- [ ] Disclosure report generation
- [ ] Investor-ready format

## Implementation Breakdown

### Task 1: ISSB Data Model (2 hours)
Create ISSBCompliance collection:
- org_id, year
- S1 sections: governance, strategy, risk management, metrics (all 4 pillars)
- S2 sections: climate governance, climate strategy, climate risk management, climate metrics
- Each section: disclosure_status, supporting_data_links, verification_status

### Task 2: Materiality Assessment Engine (3 hours)
Create materialityAssessor.ts:
- Quantitative: financial impact of each issue (revenue at risk, cost to remediate)
- Qualitative: stakeholder importance (surveys, interviews)
- Matrix: financial impact vs stakeholder concern
- Output: { material_issues: [...], materiality_matrix_data, threshold_applied }

### Task 3: Climate Resilience Calculator (4 hours)
Create climateResilienceCalculator.ts:
- Scenario analysis (1.5°C, 2°C, 3°C warming)
- Resilience metrics: % of business model exposed to each scenario
- Adaptive capacity: capex required, timeline, feasibility
- Probability-weighted risk: combine scenarios with probability
- Output: { resilient_scenarios: [...], adaptation_required, resilience_score }

### Task 4: Disclosure Report Generator (3 hours)
Create issb ReportGenerator.ts:
- S1 disclosure report (governance, strategy, risk, metrics)
- S2 climate disclosure (climate governance, strategy, risk, metrics)
- Format: audit-ready, standardized
- Export: PDF + XBRL (for SEC/regulatory filing)

## API Routes
- `POST /api/app/issb/generate` - Generate report
- `GET /api/app/issb/[id]` - Download PDF
- `POST /api/app/issb/materiality-assessment` - Run materiality assessment

## Testing
- Unit: 15+ tests (materiality calculation, resilience scoring)
- Integration: Full report generation
- Accuracy: ISSB standard compliance verified

## Code Quality
- 80%+ test coverage
- <5s report generation

## Production Readiness
- [ ] S1 + S2 both fully implemented
- [ ] Materiality assessment accurate
- [ ] Climate resilience calculations validated
- [ ] Tests: 15+ passing

---
```

---

## SF-004: Carbon Trust Certification Workflow (8h)

```
# Implementation Task: Carbon Trust Certification Workflow (SF-004)

**Feature ID**: SF-004
**Priority**: 🟡 MEDIUM
**Effort**: 8 hours
**Status**: ⬜ NOT STARTED

## Task Overview
Streamline Carbon Trust Standard certification process. Enables SMBs to get independently verified carbon label (credibility + competitive advantage).

## Context
- Target: UK/EU SMBs, mid-market
- Certification: independent 3rd party verification
- Credential: internationally recognized
- Timeline: typically 6-8 weeks

## Acceptance Criteria
- [ ] Carbon Trust Standard verification checklist (50+ requirements)
- [ ] Evidence collection & document linking
- [ ] Auditor review workflow
- [ ] Certification status tracking (submitted, approved, certified)
- [ ] Certificate PDF generation
- [ ] Audit trail (immutable)
- [ ] Integration with assurance workflow

## Implementation Breakdown

### Task 1: Verification Checklist (2 hours)
Create CarbonTrustChecklist collection:
- org_id, certification_id
- 50+ requirements per Carbon Trust Standard
- Each: requirement_name, evidence_required, status, attached_docs
- Progress tracking: % complete, estimated submission date

### Task 2: Document Management (2 hours)
Create documentRepository.ts:
- Upload documents (reports, invoices, calculations)
- Link to checklist items (evidence_links)
- Version control (doc v1.0, v1.1 after comments)
- Full-text search

### Task 3: Auditor Workflow (2 hours)
Create auditorWorkflow.ts:
- Assign auditor to certification
- Auditor review checklist items + evidence
- Request additional info (back-and-forth)
- Approve / reject certification
- Workflow states: submitted, under_review, additional_info_requested, approved, rejected, certified

### Task 4: Certificate Generator (2 hours)
Create certificateGenerator.ts:
- Generate PDF certificate (Carbon Trust logo, org name, validity period)
- Certificate number (unique ID for verification)
- Valid for 3 years (auto-expire, send reminder at 2yr 9m)

## API Routes
- `POST /api/app/carbon-trust/certification` - Start certification
- `GET /api/app/carbon-trust/[id]/checklist` - Get checklist
- `PATCH /api/app/carbon-trust/[id]/checklist/[item]` - Update checklist item
- `POST /api/app/carbon-trust/[id]/submit` - Submit for review
- `GET /api/app/carbon-trust/[id]/certificate` - Download certificate

## Testing
- Unit: 10+ tests (checklist, document management)
- Integration: Full certification workflow
- Workflow accuracy: auditor can review without confusion

## Code Quality
- 80%+ test coverage
- Immutable audit trail

## Production Readiness
- [ ] 50+ checklist items coded
- [ ] Document management works
- [ ] Auditor workflow tested
- [ ] Certificate generation tested
- [ ] Tests: 10+ passing

---
```

---

## SF-005: Regulatory Deadline Calendar (6h)

```
# Implementation Task: Regulatory Deadline Calendar (SF-005)

**Feature ID**: SF-005
**Priority**: 🟡 MEDIUM
**Effort**: 6 hours
**Status**: ⬜ NOT STARTED

## Task Overview
Auto-populated compliance deadline calendar with jurisdiction-based filtering and email alerts. Keeps compliance officers on track with 50+ overlapping deadlines.

## Context
- Target: All companies (but especially mid-market, enterprise)
- Deadlines: CSRD (April 2026), TCFD (2027), GRI annual, ISSB (TBD), Carbon Trust renewal, etc.
- Problem: compliance officers miss deadlines due to complexity
- Solution: one calendar, all deadlines, smart alerts

## Acceptance Criteria
- [ ] Pre-populated deadlines: CSRD, TCFD, GRI, ISSB, Carbon Trust, SEC, others
- [ ] Jurisdiction-based filtering (EU, UK, US, global)
- [ ] Email alerts (90, 60, 30, 14, 7 days before)
- [ ] Calendar export (iCal format for Outlook/Google Calendar)
- [ ] Custom deadline support (user-added deadlines)
- [ ] Deadline status tracking (not_started, in_progress, completed, submitted, verified)
- [ ] Linked to actual reports (mark CSRD deadline done when CSRD report submitted)
- [ ] Performance: handle 1000+ deadlines efficiently

## Implementation Breakdown

### Task 1: Deadline Data Model (1 hour)
Create RegulatoryDeadlines collection:
- org_id, deadline_id, jurisdiction, framework, deadline_date
- requirement (description), status, completion_date
- linked_report_id (if applicable)
- Pre-populate with 50+ major deadlines (CSRD, TCFD, GRI, ISSB, etc.)

### Task 2: Alert System (2 hours)
Create alertService.ts:
- Find deadlines in next 90, 60, 30, 14, 7 days
- Send email alerts with status check-in questions
- Email templates: subject/body per timeframe
- Unsubscribe option (but warn about consequences)
- Retry if email fails (3 retries)

### Task 3: Calendar UI (2 hours)
Create calendar pages:
- Calendar view (month/year)
- List view (upcoming, overdue)
- Filtering: by jurisdiction, framework, status
- Color-coding: green (done), yellow (in_progress), red (overdue)
- iCal export: .ics file for Outlook/Google Calendar
- Custom deadline creation: form to add new deadline

### Task 4: Status Tracking (1 hour)
Create statusTracker.ts:
- Manual status update: mark deadline as started, in-progress, completed
- Auto-link to reports: when CSRD report submitted, auto-mark CSRD deadline as submitted
- Notification to stakeholders when status changes
- History: track all status changes with timestamps

## API Routes
- `GET /api/app/deadlines` - List deadlines (filtered, sorted)
- `POST /api/app/deadlines` - Add custom deadline
- `PATCH /api/app/deadlines/[id]` - Update status
- `GET /api/app/deadlines/[id]/export` - Export to iCal

## UI Components
- `/compliance/calendar` - Calendar view
- `/compliance/deadlines` - List view with filters

## Testing
- Unit: 8+ tests (filtering, alert scheduling)
- Integration: Full calendar flow
- Performance: handle 1000+ deadlines

## Code Quality
- 80%+ test coverage
- Email alerts >99% delivery

## Production Readiness
- [ ] 50+ deadlines pre-populated
- [ ] Jurisdiction filtering works
- [ ] Email alerts sent correctly
- [ ] Calendar export tested (iCal valid)
- [ ] Custom deadlines creatable
- [ ] Tests: 8+ passing

---
```

---

---

# SPRINT 3: SUPPLIER ECOSYSTEM (Week 5-6)

**6 Features | 54 Hours | Can run in parallel**

**Dependencies**: SM-001 (Free Supplier Data) must be complete (but can start implementing SM-002 in parallel)

---

## SM-002: Automated Supplier Risk Scoring (12h)

```
# Implementation Task: Automated Supplier Risk Scoring (SM-002)

**Feature ID**: SM-002
**Priority**: 🟠 HIGH
**Effort**: 12 hours
**Status**: ⬜ NOT STARTED

## Task Overview
Implement multi-factor risk scoring algorithm for suppliers. Combines FREE data sources (questionnaire completeness, UN Global Compact status, government data, certifications), GHG intensity, geographic risk, spend concentration, and trend data into single risk score (0-100, higher = worse).

## Context
- Target: Procurement teams, sustainability managers
- Use case: prioritize supplier engagement, identify high-risk suppliers
- Integration: uses SM-001 (Free Supplier Data) - questionnaire, UN GC, EU ETS, SEC Edgar
- Advantage: Transparent risk scoring based on data completeness + certifications

## Acceptance Criteria
- [ ] Risk scoring algorithm (0-100 scale)
- [ ] Multi-factor model (Data Completeness 40%, Certifications 20%, Industry 15%, Geography 15%, Trend 10%)
- [ ] Risk tier mapping (Low, Medium, High, Critical)
- [ ] Automated flags for high-risk suppliers (score >75 = critical risk)
- [ ] Risk dashboard with drill-down and filtering
- [ ] Historical trend tracking (last 12 months)
- [ ] Audit trail for score changes
- [ ] Procurement notification system (email when risk tier changes)
- [ ] Recalculation trigger (on questionnaire response, datapoint update, spend change)

## Implementation Breakdown

### Task 1: Risk Scoring Algorithm (4 hours)
Create riskScoringEngine.ts:
- **Data Completeness factor (40%)**:
  - % of questionnaire answered + data from gov sources
  - 80-100% complete: 0-20 risk
  - 50-80%: 20-40 risk
  - <50%: 40-100 risk

- **Certifications factor (20%)**:
  - Has ISO 14001, B Corp, Fair Trade: -10 risk (good)
  - No certifications: +10 risk
  - UN Global Compact signatory: -5 risk (good)

- **Industry factor (15%)**:
  - High-risk: fossil fuels, mining, manufacturing
  - Medium-risk: retail, logistics
  - Low-risk: tech, services
  - Lookup table: industry_code → risk_multiplier (0.8 to 1.2)

- **Geographic factor (15%)**:
  - Countries with weak ESG regulation: higher risk
  - Multiplier: 0.8 (low-risk country) to 1.3 (high-risk country)

- **Trend (10%)**:
  - Questionnaire completeness improving: -0.1 risk
  - Emissions increasing: +0.1 risk
  - Multiplier: 0.9 (improving) to 1.1 (worsening)

- **Final calculation**:
```

base_score = 50
score += completeness_factor (0 to 40)
score += certifications_factor (-10 to +10)
score = score * industry_factor * geo_factor * trend_factor
score = Math.min(100, Math.max(0, score))
tier = score < 30 ? 'low' : score < 50 ? 'medium' : score < 75 ? 'high' : 'critical'

```

### Task 2: Risk Dashboard UI (3 hours)
Create riskDashboard page:
- Supplier list with risk scores (green/yellow/orange/red)
- Sort by: risk_score desc, spend desc, completeness asc
- Filter: by risk_tier, industry, region, spend_range
- Drill-down: click supplier → see risk breakdown (which factors contribute)
- Export: to CSV for procurement review

### Task 3: Notification System (2 hours)
Create riskAlerts.ts:
- Detect when supplier moves to HIGH or CRITICAL risk
- Send email: "Supplier X risk changed from MEDIUM to HIGH"
- Include: risk factors, current completeness %, recommendation
- Frequency: once per risk tier change

### Task 4: Historical Tracking (2 hours)
Create SupplierRiskHistory collection:
- supplier_id, date, risk_score, risk_tier, factors (completeness, certs, industry, geo, trend at that time)
- Calculate trend (is score improving or worsening over 12 months?)
- Display trend chart on dashboard

### Task 5: Recalculation Triggers (1 hour)
Create recalcWorker.ts:
- Trigger 1: Questionnaire response submitted (SM-001) → recalc supplier
- Trigger 2: New datapoint added (emissions) → recalc that supplier
- Trigger 3: Spend data updated → recalc affected suppliers
- Trigger 4: Daily recalc (in case geo/industry factors change)

## API Routes
- `GET /api/app/suppliers/risk-scores` - Get all suppliers with risk scores
- `GET /api/app/suppliers/[id]/risk-breakdown` - Get risk score breakdown
- `GET /api/app/suppliers/risk-dashboard` - Dashboard data (counts by tier)

## Testing
- Unit: 12+ tests (scoring algorithm, tier mapping, factor calculations)
- Integration: Full risk scoring workflow (questionnaire → recalc → alert)
- Accuracy: Scoring validated by procurement team (spot-check 20 suppliers)
- Performance: recalc 1000 suppliers in <2 min

## Code Quality
- 80%+ test coverage
- Recalculation <2 min for 1000 suppliers
- Algorithm transparent (can explain any score)

## Production Readiness
- [ ] Algorithm formula agreed with procurement
- [ ] Risk scores validated (spot-check 20 suppliers)
- [ ] Dashboard functional and intuitive
- [ ] Alerts tested (sent correctly, no false positives)
- [ ] Performance: <2 min recalc
- [ ] Tests: 12+ passing

---
```

---

## SM-003: Supply Chain Mapping Visualization (14h)

```
# Implementation Task: Supply Chain Mapping Visualization (SM-003)

**Feature ID**: SM-003
**Priority**: 🟡 MEDIUM
**Effort**: 14 hours
**Status**: ⬜ NOT STARTED

## Task Overview
Interactive network graph visualization showing supply chain structure: your org → Tier 1 suppliers → their suppliers (Tier 2/3). Shows emissions flow and identifies bottlenecks/concentration.

## Context
- Target: C-suite (CEO, CFO), procurement directors
- Use case: understand supply chain, identify decarbonization levers, reduce concentration risk
- Integration: uses supplier data + Tier 2/3 data (from SM-032, future)
- Visualization: Interactive, drill-down capable

## Acceptance Criteria
- [ ] Network graph visualization (org center → suppliers radiating out)
- [ ] Node types: org (center), Tier 1 suppliers (direct), Tier 2/3 (indirect)
- [ ] Emissions flow visualization (edge thickness = emissions contribution)
- [ ] Interactive drill-down: click supplier → see details
- [ ] Bottleneck identification: flag concentrated spend/emissions
- [ ] Supplier concentration analysis (Herfindahl index calculation)
- [ ] Export to PNG/SVG for presentations
- [ ] Performance optimized for 1000+ nodes

## Implementation Breakdown

### Task 1: Data Model (2 hours)
Create SupplyChainNetwork collection:
- org_id, supplier_id, tier_level (1, 2, 3+), spend, emissions
- Supplier relationships: Tier 1 supplier → their Tier 2 suppliers
- Build graph: nodes (suppliers) + edges (relationships)

### Task 2: Graph Visualization Library (5 hours)
Choose & implement: D3.js or React Force Graph
- D3.js: powerful but steeper learning curve
- React Force Graph: easier, pre-built physics simulation
- Recommendation: React Force Graph for speed
- Create supplyChainGraph.tsx component:
  - Nodes: org (center), Tier 1 (circle 1), Tier 2 (circle 2)
  - Edges: connect nodes, thickness = emissions/spend
  - Colors: by risk tier (green/yellow/orange/red)
  - Hover: show supplier name, emissions, spend
  - Click: drill-down to supplier details

### Task 3: Bottleneck Detection (3 hours)
Create bottleneckAnalyzer.ts:
- **Spend concentration**: Herfindahl index (0 = diverse, 1 = monopoly)
  - If top 3 suppliers = >60% of spend: BOTTLENECK
  - Recommendation: diversify

- **Emissions concentration**: similar logic
  - If 1 supplier = >30% of Scope 3: BOTTLENECK
  - Recommendation: engage supplier for decarbonization

- **Geographic concentration**: if >50% in 1 region (climate/political risk)
  - Recommendation: diversify locations

- **Supplier concentration by category**: if 1 supplier for critical category
  - Recommendation: secondary source

### Task 4: Supplier Concentration Analysis (2 hours)
Create concentrationAnalyzer.ts:
- Calculate Herfindahl index (H = sum of (market_share)^2)
- H = 0: perfect competition, H = 1: monopoly
- For ClearESG:
  - Spend-weighted: H_spend
  - Emissions-weighted: H_emissions
  - Output: { h_spend, h_emissions, concentration_level: 'high'|'medium'|'low', recommendations: [...] }

### Task 5: Export & Presentation (2 hours)
Create exportService.ts:
- Export graph to PNG (high resolution for presentations)
- Export to SVG (editable in PowerPoint/Figma)
- Auto-format: board-ready (white background, color legend)

## UI Components
- `/supply-chain/map` - Interactive graph
- `/supply-chain/analysis` - Bottleneck & concentration metrics

## Testing
- Unit: 10+ tests (bottleneck detection, concentration calc)
- Integration: Full graph rendering (1000 nodes)
- Performance: graph renders in <2s, interactive smooth
- Visualization: compare to manual check (10 suppliers)

## Code Quality
- 80%+ test coverage
- Graph renders <2s for 1000 nodes
- Responsive (mobile-friendly)

## Production Readiness
- [ ] Graph renders correctly (1000 nodes)
- [ ] Bottleneck detection accurate
- [ ] Export PNG/SVG works
- [ ] Performance <2s render time
- [ ] Tests: 10+ passing

---
```

---

## SM-004: Tiered Supplier Categorization (6h)

```
# Implementation Task: Tiered Supplier Categorization (SM-004)

**Feature ID**: SM-004
**Priority**: 🟠 HIGH
**Effort**: 6 hours
**Status**: ⬜ NOT STARTED

## Task Overview
Classify suppliers by criticality: Tier 1 (direct), Tier 2 (indirect), Tier 3+ (second-level). Enables risk-weighted data collection and focus on high-impact suppliers.

## Context
- Target: Procurement, sustainability
- Use case: align data collection effort with risk; don't waste time on small suppliers
- Methodology: spend-based + criticality scoring
- Benefit: faster onboarding, lower cost

## Acceptance Criteria
- [ ] Tier 1 (direct suppliers to org) classification
- [ ] Tier 2 (suppliers' suppliers) classification
- [ ] Tier 3+ (second-level indirect) classification
- [ ] Auto-categorization based on spend
- [ ] Manual override capability (users can reclassify)
- [ ] Risk-weighted data collection (Tier 1 full questionnaire, Tier 2 abbreviated, Tier 3 minimal)
- [ ] Dashboard showing tiers + spending per tier

## Implementation Breakdown

### Task 1: Categorization Rules (2 hours)
Create categorizationEngine.ts:
- **Tier 1**: Any supplier linked to org's purchase orders
  - No spend threshold (even $1 = Tier 1)
  - Direct relationship

- **Tier 2**: Suppliers that supply Tier 1 suppliers
  - Identified from Tier 1 supplier's supplier list
  - Indirect relationship

- **Tier 3+**: Suppliers to Tier 2, etc.
  - Future: can go 3+ levels

- **Spend-weighted importance** (for prioritization within tier):
  - Tier 1: sort by spend (highest = most important)
  - Tier 2: inherit importance from Tier 1 spend
  - Example: Tier 1 supplier = 30% of spend, their suppliers = elevated importance

### Task 2: Manual Override (1.5 hours)
Create categorizationUI:
- Edit tier assignment form: user can change Tier 1 → Tier 2 (if supplier actually indirect)
- Reason field (audit trail)
- Auto-reclassify on next sync (revert if spend indicates otherwise)

### Task 3: Risk-Weighted Data Collection (2 hours)
Create collectionTemplates.ts:
- **Tier 1 template**: Full questionnaire (30 questions, scope 1/2/3, supply chain)
- **Tier 2 template**: Abbreviated (15 questions, core scope 1/2 only)
- **Tier 3 template**: Minimal (5 questions, high-level emissions only)
- Auto-select template based on tier
- Allow users to require full template for critical Tier 2 suppliers

### Task 4: Dashboard & Visualization (0.5 hours)
Create tieringDashboard:
- Pie chart: % of spend by tier
- Bar chart: # of suppliers by tier
- Table: Tier 1 suppliers ranked by spend
- Toggle: show Tier 2, Tier 3

## API Routes
- `POST /api/app/suppliers/categorize` - Auto-categorize suppliers
- `PATCH /api/app/suppliers/[id]/tier` - Override tier classification
- `GET /api/app/suppliers/tier-dashboard` - Dashboard data

## Testing
- Unit: 6+ tests (auto-categorization, spend-weighted calc)
- Integration: Full workflow (import suppliers → auto-tier → assign templates)
- Accuracy: Spot-check 20 suppliers (manual vs. auto classification)

## Code Quality
- 80%+ test coverage
- Auto-categorization algorithm simple, transparent

## Production Readiness
- [ ] Auto-categorization rules agreed
- [ ] Manual override tested
- [ ] Data collection templates differ by tier
- [ ] Dashboard works
- [ ] Tests: 6+ passing

---
```

---

## SM-005: Supplier Document Repository (8h)

```
# Implementation Task: Supplier Document Repository (SM-005)

**Feature ID**: SM-005
**Priority**: 🟡 MEDIUM
**Effort**: 8 hours
**Status**: ⬜ NOT STARTED

## Task Overview
Centralized repository for supplier ESG documents: sustainability reports, certifications, carbon data, audit findings. Enables evidence collection and audit trail.

## Context
- Target: Sustainability managers, auditors
- Use case: manage supplier documentation, link to compliance checkpoints, audit trail
- Benefit: proof of due diligence when regulators ask

## Acceptance Criteria
- [ ] Document upload system (ESG reports, certifications, carbon data)
- [ ] Version control & timestamp tracking
- [ ] Full-text search across documents
- [ ] Linked to supplier profile & assurance findings
- [ ] Access control by org (suppliers can't see each other's docs)
- [ ] Virus scanning on upload
- [ ] Expiry tracking (certification valid until X date, alert before expiry)
- [ ] Export: document bundle for auditors

## Implementation Breakdown

### Task 1: Document Model (1.5 hours)
Create SupplierDocuments collection:
- supplier_id, doc_type (sustainability_report, certification, carbon_data, audit_finding)
- file_path (S3 or local storage), file_size, mime_type
- uploaded_by, uploaded_at
- version (1.0, 1.1, etc.), superseded_by (if replaced)
- expiry_date (for certifications)
- tags (searchable)

### Task 2: Upload & Storage (2 hours)
Create documentUploadService.ts:
- Accept file upload (max 50MB)
- Virus scan (use VirusTotal API or local ClamAV)
- Store in S3 (production) or local (dev)
- Extract metadata (OCR for PDFs? optional)
- Version previous file (don't delete)
- Return: document_id, upload_success, scan_result

### Task 3: Search & Retrieval (2 hours)
Create documentSearchService.ts:
- Full-text search: "carbon emissions 2024" → find all docs mentioning
- Filter by: supplier, doc_type, date_range
- Sort by: upload_date desc, relevance
- Pagination

### Task 4: Linking & Evidence (1.5 hours)
Create evidenceLinking.ts:
- Link document to compliance checkpoint (cf. CF-001)
- Link to assurance finding (cf. Days 26-35)
- Show linked items when viewing document
- Audit trail: what checkpoints/findings reference this doc

### Task 5: UI Components (1 hour)
Create documentUI:
- Supplier profile → Documents tab
- Upload form (drag-and-drop)
- Document list with preview (PDF, image thumbnails)
- Download button

## Testing
- Unit: 8+ tests (upload, search, linking)
- Integration: Full upload-search-link workflow
- Virus scanning: test with EICAR test file
- Performance: search 1000+ documents in <1s

## Code Quality
- 80%+ test coverage
- Secure file handling (no path traversal)
- Search <1s for 1000 docs

## Production Readiness
- [ ] Upload system tested (virus scan, size limit)
- [ ] Search functional (full-text, filters)
- [ ] Linking to checkpoints/findings works
- [ ] Document preview works (PDF, images)
- [ ] Tests: 8+ passing

---
```

---

## SM-006: Supplier Compliance Dashboard (10h)

```
# Implementation Task: Supplier Compliance Dashboard (SM-006)

**Feature ID**: SM-006
**Priority**: 🟡 MEDIUM
**Effort**: 10 hours
**Status**: ⬜ NOT STARTED

## Task Overview
Real-time compliance status dashboard showing data freshness, response rates, flagged issues per supplier. Procurement team monitors engagement progress.

## Context
- Target: Procurement, sustainability managers
- Use case: track supplier engagement progress, send reminders to non-responders
- Benefit: operational KPI (e.g., "80% of Tier 1 suppliers responded within 30 days")

## Acceptance Criteria
- [ ] Real-time compliance status (data freshness, response rate)
- [ ] SLA tracking (% suppliers responding within target days)
- [ ] Flagged issues per supplier (high-risk, missing data, certification expiry)
- [ ] Email reminders for non-responders (auto-send after 14, 21, 30 days)
- [ ] Compliance scorecards (supplier summary)
- [ ] Drill-down to individual supplier data
- [ ] Dashboard KPIs (target vs. actual)
- [ ] Export to CSV for executive reporting

## Implementation Breakdown

### Task 1: Compliance Status Model (1.5 hours)
Create ComplianceStatus collection:
- supplier_id, last_data_update, last_response_date, days_since_contacted
- response_status ('responded'|'pending'|'overdue'|'never_contacted')
- data_completeness (% of required fields filled)
- flagged_issues (array: high_risk, missing_data, expired_cert, etc.)

### Task 2: SLA Tracking (2 hours)
Create slaTracker.ts:
- Define SLA: Tier 1 must respond within 30 days, Tier 2 within 45 days
- Calculate: days_elapsed, status (on_track, at_risk, overdue)
- Aggregate: % of suppliers on-track by tier
- Dashboard: show % met vs. target

### Task 3: Flagged Issues Detection (2 hours)
Create issueDetector.ts:
- **High-risk**: risk_score < 40 (from SM-002)
- **Missing data**: >20% of required fields empty
- **Expired cert**: certification expiry_date < today
- **Data stale**: last_data_update > 90 days ago
- **Never contacted**: last_contacted IS NULL

### Task 4: Email Reminders (2 hours)
Create reminderService.ts:
- Query: suppliers with response_status = 'pending' AND days_since_contacted >= 14
- Send email: "We haven't heard from you in 14 days, please respond by [date]"
- Escalation: 14 days (friendly), 21 days (polite), 30 days (urgent)
- Frequency: daily batch, avoid duplicate sends

### Task 5: Dashboard UI (2.5 hours)
Create complianceDashboard:
- KPI cards: % responded, % on-time, avg days to respond
- Supplier list: status, days_since_contact, flagged_issues
- Filter: by tier, region, status
- Drill-down: click supplier → see compliance details
- Export: CSV with all data

## API Routes
- `GET /api/app/compliance/dashboard` - Dashboard data
- `GET /api/app/compliance/[supplier_id]` - Supplier compliance details
- `POST /api/app/compliance/send-reminders` - Trigger reminder emails
- `GET /api/app/compliance/export` - Export CSV

## Testing
- Unit: 10+ tests (SLA calc, issue detection, reminder logic)
- Integration: Full workflow (track compliance, send reminders)
- Email: test reminder send (use staging email address)
- Performance: load dashboard for 1000 suppliers in <2s

## Code Quality
- 80%+ test coverage
- Dashboard load <2s

## Production Readiness
- [ ] SLA thresholds agreed with procurement
- [ ] Issue detection logic accurate
- [ ] Email reminders tested (no false sends)
- [ ] Dashboard load time <2s
- [ ] Export CSV working
- [ ] Tests: 10+ passing

---
```

---

## SM-007: Bulk Supplier Assessment (6h)

```
# Implementation Task: Bulk Supplier Assessment (SM-007)

**Feature ID**: SM-007
**Priority**: 🟡 MEDIUM
**Effort**: 6 hours
**Status**: ⬜ NOT STARTED

## Task Overview
Import supplier list from CSV, auto-send questionnaire to all suppliers, track responses with bulk management.

## Context
- Target: Companies onboarding to ClearESG (quick start)
- Use case: bootstrap from existing supplier list
- Benefit: 500+ suppliers invited in <1 hour (vs. manual invite)

## Acceptance Criteria
- [ ] CSV import (supplier name, email, industry, region)
- [ ] Auto-send questionnaire to all imported suppliers
- [ ] Bulk invite tracking (sent, bounced, opened, responded)
- [ ] Bulk status updates (mark all as "reminder sent", etc.)
- [ ] Export results to Excel
- [ ] Duplicate detection (don't re-invite)
- [ ] Performance: process 1000 suppliers in <5 min

## Implementation Breakdown

### Task 1: CSV Import (1.5 hours)
Create bulkImportService.ts:
- Accept CSV (supplier_name, email, industry, region, optional: spend, tier)
- Validate: email format, required fields
- Deduplicate: check if supplier already exists in org
- Dry-run: preview before confirming
- Import: create Supplier records in bulk

### Task 2: Bulk Invite (2 hours)
Create bulkInviteService.ts:
- For each imported supplier: generate invite link
- Send email: "Complete your ESG questionnaire for [org]"
- Track: sent_at, email_status (sent, bounced, opened)
- Retry failed sends (3 retries, exponential backoff)

### Task 3: Tracking & Status (1.5 hours)
Create bulkTrackingService.ts:
- Dashboard: supplier count by status (invited, opened, responded, skipped)
- Export: CSV with all statuses
- Bulk status update: mark all as "follow-up sent"

### Task 4: Results Export (1 hour)
Create exportService.ts:
- Export results: supplier_name, email, status, response_rate, completion_%
- Format: Excel (.xlsx) for easy sharing with procurement

## API Routes
- `POST /api/app/suppliers/bulk-import` - Import CSV
- `GET /api/app/suppliers/bulk-status` - Track bulk import progress
- `GET /api/app/suppliers/bulk-export` - Export results

## Testing
- Unit: 6+ tests (CSV parsing, bulk invite, dedup)
- Integration: Full flow (import → invite → track)
- Performance: process 1000 suppliers in <5 min
- Email: test sends (use staging)

## Code Quality
- 80%+ test coverage
- <5 min for 1000 suppliers

## Production Readiness
- [ ] CSV import tested (edge cases, malformed data)
- [ ] Bulk invite tested (email delivery)
- [ ] Duplicate detection works
- [ ] Performance <5 min for 1000
- [ ] Export Excel working
- [ ] Tests: 6+ passing

---
```

---

---

# SPRINT 4: ANALYTICS & INSIGHTS (Week 7-8)

**5 Features | 60 Hours | Can run in parallel**

---

## AN-001: Peer/Industry Benchmarking (14h)

```
# Implementation Task: Peer/Industry Benchmarking (AN-001)

**Feature ID**: AN-001
**Priority**: 🟡 MEDIUM
**Effort**: 14 hours
**Status**: ⬜ NOT STARTED

## Task Overview
Compare organization's ESG metrics against anonymized peer data. Shows: "Your emissions: 5.2 tCO2e/revenue vs. industry median 4.8" (competitive positioning).

## Context
- Target: Executive reporting, board presentations
- Use case: demonstrate competitiveness, justify investments
- Data source: anonymized ClearESG customer database (or Refinitiv/S&P data)
- Benefit: competitive pressure → motivation for decarbonization

## Acceptance Criteria
- [ ] Anonymized peer data aggregation (no org name leaked)
- [ ] Industry classification by NAICS/SIC code
- [ ] Size-normalized comparisons (revenue, headcount, employees)
- [ ] Emissions intensity benchmarks (tCO2e/$M revenue, tCO2e/employee)
- [ ] Board-ready comparison charts
- [ ] Competitive positioning dashboard
- [ ] 90th, 50th, 10th percentile tracking
- [ ] Data freshness validation (updated quarterly)

## Implementation Breakdown

### Task 1: Data Aggregation Pipeline (4 hours)
Create aggregationService.ts:
- Collect data from all orgs (with consent): emissions, revenue, employee_count, industry
- Group by: industry (NAICS code), size bucket (revenue <$1M, $1-10M, $10-100M, $100M+)
- Calculate: mean, median, std_dev, p10, p25, p50, p75, p90
- Update quarterly (or monthly)

### Task 2: Benchmarking Algorithm (4 hours)
Create benchmarkingEngine.ts:
- For each org:
  - Get industry (from org profile)
  - Get revenue, employee_count
  - Select peer set: same industry ± similar size
  - Calculate: org's percentile vs. peers (0-100)
  - Example: if org's intensity = 5.2 and p50 = 4.8, org is below median (worse)

- Emissions intensity metrics:
  - tCO2e / revenue ($ million)
  - tCO2e / employee
  - tCO2e / production unit (if applicable)

### Task 3: Dashboard UI (4 hours)
Create benchmarkingDashboard:
- Waterfall chart: your org vs. p10 (best) / p50 (median) / p90 (worst)
- Table: show peers (anonymized: "Company A", "Company B", etc.)
- Filter: by industry, size, region
- Trend: how your percentile changed over 12 months
- Board-ready export (PowerPoint slide)

### Task 4: Data Privacy & Anonymization (2 hours)
Create privacyControls.ts:
- Anonymize: show "Company A", not real name
- Consent: only include orgs that opted-in
- Minimum group size: need ≥5 peers to show benchmark (avoid reverse ID)
- Audit trail: log who accessed what data, when

## API Routes
- `GET /api/app/benchmarks/[org_id]` - Get org's benchmarking data
- `GET /api/app/benchmarks/peers` - Get peer list (anonymized)
- `POST /api/app/benchmarks/recompute` - Refresh benchmarks (quarterly)

## Testing
- Unit: 8+ tests (percentile calc, anonymization, filtering)
- Integration: Full benchmarking flow (fetch data, calculate, display)
- Privacy: verify no org name leaks, consent respected
- Accuracy: spot-check percentiles vs. manual calc

## Code Quality
- 80%+ test coverage
- Percentile calc correct (<5 basis point error)
- Anonymization foolproof (no org identifiable)

## Production Readiness
- [ ] Data aggregation pipeline tested
- [ ] Benchmarking algorithm validated
- [ ] Privacy controls in place (consent, minimum group size)
- [ ] Dashboard renders correctly
- [ ] Export to PowerPoint working
- [ ] Tests: 8+ passing

---
```

---

## AN-002: Scenario Modeling (20h)

```
# Implementation Task: Scenario Modeling (AN-002)

**Feature ID**: AN-002
**Priority**: 🟠 HIGH
**Effort**: 20 hours
**Status**: ⬜ NOT STARTED

## Task Overview
Interactive tool to model "what-if" scenarios: "If we switch to 50% renewable energy, emissions drop to X with Y% confidence." Used for strategy planning and capex justification.

## Context
- Target: Finance, operations, sustainability teams
- Use case: model decarbonization strategies, ROI analysis
- Integration: uses emissions data, scenario parameters from user input
- Benefit: strategy quantification → board approval → funding allocation

## Acceptance Criteria
- [ ] Scenario builder UI (baseline, optimistic, pessimistic scenarios)
- [ ] Variable mapping (emissions drivers → levers)
- [ ] Impact estimation engine
- [ ] Monte Carlo simulation (confidence intervals)
- [ ] Sensitivity analysis (vary one param, see impact)
- [ ] Compare scenarios side-by-side
- [ ] Export to Excel
- [ ] Scenario versioning (save, load, compare versions)
- [ ] Performance: <5s to generate scenario

## Implementation Breakdown

### Task 1: Scenario Data Model (2 hours)
Create Scenarios collection:
- org_id, scenario_name, baseline_year, target_year
- scenario_type ('baseline'|'optimistic'|'pessimistic'|'custom')
- variables (array: lever_id, lever_name, impact_value)
  - Example: { lever: 'renewable_energy', current_pct: 20, target_pct: 50, payback_years: 3 }
- assumptions (array): inflation_rate, technology_cost_decline, etc.
- results (calculated): { year1_emissions, year5_emissions, capex_required, roi_pct, confidence_interval }

### Task 2: Scenario Builder UI (5 hours)
Create scenarioBuilder.tsx:
- Baseline: starting state (this year's emissions)
- Levers: list of decarbonization levers (renewable, efficiency, behavior, fuel switching, etc.)
  - For each lever: current %, target %, capex, timeline, payback years
- Drag-and-drop: select levers to include in scenario
- Timeline: year-by-year breakdown
- Assumptions: set inflation, tech cost decline, etc.
- Preview: shows projected emissions trajectory

### Task 3: Impact Estimation Engine (6 hours)
Create impactCalculator.ts:
- For each lever, calculate annual emissions reduction:
  - Renewable energy: % replacement × (current_grid_emissions_factor - renewable_factor)
  - Efficiency: % improvement × current_energy_use
  - Behavior: % participation × (current_emissions - target_emissions)
  - Fuel switching: % of vehicles switched × (petrol_emissions - EV_emissions)
  - Etc.

- Combine levers: total emissions reduction = sum of individual reductions
- Account for interactions: some levers stack, some partially overlap

- Financial impact:
  - Capex: sum of lever capex
  - Opex savings: annual fuel savings, maintenance savings
  - ROI: (annual_savings) / (capex) × 100

### Task 4: Monte Carlo Simulation (4 hours)
Create monteCarloSimulator.ts:
- Each variable has: point_estimate, ±confidence_range (e.g., ±10%)
- Run 1000 simulations: vary each parameter within its range
- Output: distribution of outcomes
  - Example: "85% confidence emissions will be 2.5-3.2 tCO2e by 2030"
  - Confidence interval: 10th to 90th percentile

### Task 5: Sensitivity Analysis (2 hours)
Create sensitivityAnalyzer.ts:
- Vary one parameter at a time, hold others constant
- Show: which levers have most impact on outcome
- Tornado chart: rank levers by sensitivity
- Helps identify: where to focus efforts, what risks matter most

### Task 6: Comparison & Export (1 hour)
Create comparisonService.ts:
- Compare 2-3 scenarios side-by-side
- Table: year, baseline, scenario1, scenario2, scenario3
- Chart: overlay emissions trajectories
- Export to Excel (data + charts)

## API Routes
- `POST /api/app/scenarios/create` - Create new scenario
- `GET /api/app/scenarios/[id]` - Get scenario details
- `PATCH /api/app/scenarios/[id]` - Update scenario
- `POST /api/app/scenarios/[id]/run` - Calculate scenario (Monte Carlo)
- `GET /api/app/scenarios/compare` - Compare scenarios

## Testing
- Unit: 15+ tests (impact calc, Monte Carlo, sensitivity analysis)
- Integration: Full scenario workflow (create → run → compare)
- Accuracy: impact calc verified by domain expert (±5% tolerance)
- Performance: <5s to run scenario with 1000 simulations

## Code Quality
- 80%+ test coverage
- Monte Carlo <5s for 1000 simulations
- Impact calc transparent (can explain any number)

## Production Readiness
- [ ] Scenario builder UI intuitive
- [ ] Impact calculations verified
- [ ] Monte Carlo simulation working
- [ ] Sensitivity analysis correct
- [ ] Comparison & export working
- [ ] Performance <5s
- [ ] Tests: 15+ passing

---
```

---

**[Continuing to additional prompts for AN-003 through AN-005, then SPRINT 5-8...]**

Due to character limits, I'll create a condensed version of the remaining features. Here's the structure:

---

## AN-003: Decarbonization Pathway Planning (16h)

Quick summary for implementation:

- Lever library (renewable, efficiency, behavior, fuel switching, etc.)
- Timeline planner (year-by-year roadmap)
- Impact per lever (kgCO2e reduction, $ capex, payback years)
- Cost-benefit analysis
- Board-ready presentation format
- Integration with SBTi targets

---

## AN-004: Predictive Trend Analysis (12h)

Quick summary:

- Time-series forecasting (next 12 months)
- Confidence intervals (80%, 95%)
- Auto-select best model (ETS, ARIMA)
- Trend breakdown by category
- Accuracy metrics displayed
- Export forecast data

---

## AN-005: Consumption Intensity Metrics (10h)

Quick summary:

- Emissions per revenue (tCO2e/$M)
- Emissions per employee (tCO2e/emp)
- Emissions per unit produced
- YoY intensity trends
- Decoupling analysis (growth vs. emissions)
- Target vs. actual tracking

---

---

# SPRINT 5-8: CONDENSED PROMPTS

For sprints 5-8, refer to **IMPLEMENTATION_ROADMAP_NON_AI.md** for detailed breakdowns:

- **SPRINT 5**: INT-001 (Salesforce), INT-002 (NetSuite), INT-003 (Xero/QB)
- **SPRINT 6**: INT-004 (SAP), INT-005 (Data Warehouse), INT-006 (Webhooks), INT-007 (BI)
- **SPRINT 7**: UX-001 (Roles), UX-002 (Bulk Ops), UX-003 (Saved Filters), UX-004 (Audit Log)
- **SPRINT 8**: All remaining (IoT, Product LCA, Billing, etc.)

Each feature in the roadmap has same structure:

- Detailed acceptance criteria
- Task-by-task implementation breakdown
- API routes
- Testing strategy
- Production readiness checklist

---

# QUICK START

**For each feature:**

1. Copy the prompt section (from this file or IMPLEMENTATION_ROADMAP_NON_AI.md)
2. Create new chat titled: "**[SPRINT] - [FEATURE_ID]: [Feature Name]**"
3. Paste the prompt
4. I'll implement the full feature

**Example**:

- Chat 1: "SPRINT 2 - SF-001: CSRD/ESRS Reporting"
- Chat 2: "SPRINT 2 - SF-002: TCFD Framework"
- Chat 3: "SPRINT 2 - SF-003: ISSB S1/S2"
- Etc. (all run in parallel)

---

# FEATURE STATUS TRACKING

Update this section as features complete:

## SPRINT 1 - ✅ COMPLETE (ALL 4 FEATURES)

- ✅ DC-001: API/Webhook Ingestion (8h)
- ✅ CF-001: GHG Protocol Compliance (8h)
- ✅ SM-001: EcoVadis Integration (8h)
- ✅ BC-001: Annual Billing Discount (4h)

## SPRINT 2 - ⬜ NOT STARTED

- ⬜ SF-001: CSRD/ESRS Reporting (20h)
- ⬜ SF-002: TCFD Framework (12h)
- ⬜ SF-003: ISSB S1/S2 (12h)
- ⬜ SF-004: Carbon Trust Certification (8h)
- ⬜ SF-005: Regulatory Calendar (6h)

## SPRINT 3-8

See IMPLEMENTATION_ROADMAP_NON_AI.md for full tracking

---

**Document Created**: July 29, 2026  
**Total Features**: 40 non-AI  
**Total Hours**: 246h  
**Format**: Copy prompt → New chat → Implement

```

```
