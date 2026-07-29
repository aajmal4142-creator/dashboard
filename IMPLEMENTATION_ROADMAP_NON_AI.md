# ClearESG Implementation Roadmap - Non-AI Features
**Scope**: 40+ non-AI features across 9 categories  
**Target Segments**: Mid-Market, Growth, Enterprise, Specialist  
**Quality**: Production-ready, highly optimized code  
**Timeline**: 16 weeks (4-week sprints)  
**Testing Phase**: Separate 1-month phase (post-implementation)

---

## Overview: Feature Count by Priority

| Priority | Count | Hours | Impact | Target |
|----------|-------|-------|--------|--------|
| 🔴 CRITICAL | 4 | 24h | +40% TAM | Week 1-2 |
| 🟠 HIGH | 18 | 136h | +20% TAM | Week 3-8 |
| 🟡 MEDIUM | 14 | 72h | Competitive parity | Week 9-14 |
| 🟢 LOW | 4 | 14h | Polish | Week 15-16 |
| **TOTAL** | **40** | **246h** | Enterprise parity | 16 weeks |

---

## Sprint Structure (4-Week Cycles)

**Sprint 1 (Week 1-2)**: CRITICAL Foundation  
**Sprint 2 (Week 3-4)**: Compliance & Regulations  
**Sprint 3 (Week 5-6)**: Supplier Ecosystem  
**Sprint 4 (Week 7-8)**: Analytics & Insights  
**Sprint 5 (Week 9-10)**: Integrations (Part 1)  
**Sprint 6 (Week 11-12)**: Integrations (Part 2)  
**Sprint 7 (Week 13-14)**: Platform & UX Polish  
**Sprint 8 (Week 15-16)**: Billing, Automation & Edge Cases  

---

# SPRINT 1: CRITICAL FOUNDATION (Week 1-2)

## Category 1: DATA COLLECTION & IMPORT
### Sprint 1 Feature: API/Webhook Data Ingestion

**Feature ID**: DC-001  
**Priority**: 🔴 CRITICAL  
**Effort**: 8 hours  
**Status**: ⬜ NOT STARTED

#### Acceptance Criteria
- [ ] REST API endpoints for third-party data ingestion
- [ ] Webhook receiver for real-time data feeds
- [ ] Request signature verification (HMAC-SHA256)
- [ ] Rate limiting (1000 requests/hour per org)
- [ ] Retry logic with exponential backoff
- [ ] Full audit logging for all API calls
- [ ] API documentation (OpenAPI 3.0)
- [ ] Error handling with meaningful error codes
- [ ] Support for batch and real-time payloads
- [ ] ABAC enforcement on all endpoints

#### Implementation Tasks
1. **API Route Structure** (2h)
   - Create `/api/app/data/ingest` endpoint (POST)
   - Create `/api/app/webhooks/register` endpoint (POST/GET/DELETE)
   - Create `/api/app/webhooks/events` endpoint (POST - receiver)
   - Implement middleware for signature verification

2. **Database Schema** (1h)
   - WebhookRegistrations collection (org_id, endpoint, events, secret, status)
   - WebhookLogs collection (webhook_id, event_type, payload, status, timestamp)
   - Add indexing for performance

3. **Core Logic** (3h)
   - Webhook registration/management service
   - Signature verification utility (HMAC-SHA256)
   - Rate limiter (Redis-based)
   - Payload validation against Datapoints schema
   - Async processing queue for webhook events
   - Retry mechanism (exponential backoff: 1s, 2s, 5s, 10s)

4. **Error Handling** (1h)
   - Custom error codes (API-001 to API-050)
   - Detailed error messages (never leak internal info)
   - Graceful degradation on rate limit
   - Dead letter queue for failed retries

5. **Security** (1h)
   - TLS 1.2+ enforcement
   - Webhook secret rotation support
   - IP whitelisting (optional)
   - Request timeout (30s max)

#### Code Quality Standards
```typescript
// Type Safety
- 100% TypeScript (no any types)
- Strict mode enabled
- Zod schemas for all inputs

// Performance
- Webhook events processed in <100ms
- Batch processing for bulk payloads
- Connection pooling for MongoDB

// Testing Coverage
- Unit tests: 40+ test cases
- Integration tests: 10+ scenarios
- Load test: 1000 concurrent webhooks/min

// Documentation
- OpenAPI 3.0 spec
- Code comments for complex logic
- Example curl requests
- Error code reference
```

#### Production Readiness Checklist
- [ ] All tests passing (unit + integration)
- [ ] Load testing complete (1000 req/min sustained)
- [ ] Security audit (OWASP Top 10)
- [ ] Error handling verified with edge cases
- [ ] API documentation published
- [ ] Monitoring alerts configured (webhook failures, latency)
- [ ] Rate limiter tested at scale
- [ ] Backward compatibility verified (no breaking changes)

#### Sample Implementation Structure
```
src/lib/api/
  ├── webhookService.ts          (core logic)
  ├── webhookValidator.ts        (signature verification)
  ├── webhookQueue.ts            (async processing)
  ├── rateLimiter.ts             (rate limiting)
  └── __tests__/
      ├── webhookService.test.ts (40+ tests)
      └── rateLimiter.test.ts    (15+ tests)

src/app/(frontend)/api/app/
  ├── data/ingest/route.ts       (ingest endpoint)
  ├── webhooks/register/route.ts (webhook management)
  └── webhooks/events/route.ts   (receiver)

docs/
  └── API_WEBHOOKS.md            (OpenAPI spec + examples)
```

---

### Sprint 1 Feature: GHG Protocol 2004 Compliance

**Feature ID**: CF-001  
**Priority**: 🔴 CRITICAL  
**Effort**: 8 hours  
**Status**: ⬜ NOT STARTED

#### Acceptance Criteria
- [ ] GHG Protocol 2004/2015 compliance checklist
- [ ] Scopes calculation verification
- [ ] Boundary definition enforcement
- [ ] Emissions factor documentation
- [ ] Calculation methodology documentation
- [ ] Data quality assessment
- [ ] Compliance report generation (audit-ready)
- [ ] Assurance auditor sign-off capability
- [ ] Framework mapping (CSRD, BRSR, GRI, SASB alignment)
- [ ] Regulatory requirement tracking

#### Implementation Tasks
1. **Compliance Framework** (2h)
   - GhgProtocolCompliance collection (org_id, scope1, scope2, scope3, boundaries, methodology)
   - ComplianceCheckpoints collection (checkpoint_id, requirement, status, evidence_links)
   - Create verification engine for scope calculations

2. **Checklist System** (2h)
   - 50+ GHG Protocol requirements as checklist items
   - Scope 1, 2, 3 specific checklists
   - Automation rules (e.g., if Scope1 > threshold, flag for review)
   - Progress tracking (% complete)

3. **Documentation** (2h)
   - Methodology documentation service
   - Auto-generate compliance report (PDF)
   - Evidence linking (attach docs to checkpoints)
   - Audit trail (who verified what, when)

4. **Verification Engine** (2h)
   - Calculate total emissions by scope
   - Validate boundary definitions
   - Check for missing required data
   - Generate compliance score (0-100%)
   - Flag non-compliance items for remediation

#### Code Quality Standards
```typescript
// Compliance Rigor
- Immutable audit trail (cannot delete checkpoints)
- Timestamp all compliance decisions
- Multi-user approval workflows
- Regulatory requirement versioning

// Documentation
- Self-documenting code (clear variable names)
- Compliance rules as data (not hardcoded)
- Change log for all protocol updates
```

#### Production Readiness Checklist
- [ ] All GHG Protocol 2004 requirements coded
- [ ] Compliance score calculation verified
- [ ] Report generation tested with real data
- [ ] Audit trail tested for immutability
- [ ] External auditor validates compliance logic
- [ ] PDF report formatting verified
- [ ] Multi-language support planned (defer to Sprint 7)

---

### Sprint 1 Feature: EcoVadis Integration

**Feature ID**: SM-001  
**Priority**: 🔴 CRITICAL  
**Effort**: 8 hours  
**Status**: ⬜ NOT STARTED

#### Acceptance Criteria
- [ ] OAuth 2.0 integration with EcoVadis API
- [ ] Supplier score sync (automated, daily refresh)
- [ ] Assessment result mapping to ClearESG schema
- [ ] Multi-dimensional scoring (Environment, Labor, Ethics, Sustainable Procurement)
- [ ] Risk flag automation (low score = high risk)
- [ ] Historical score tracking (trend analysis)
- [ ] Failed sync error handling & retry
- [ ] Admin UI to manage EcoVadis connection
- [ ] Sync status dashboard
- [ ] Data freshness validation

#### Implementation Tasks
1. **OAuth Integration** (2h)
   - EcoVadis OAuth token management
   - Token refresh mechanism
   - Connection status monitoring
   - Secure credential storage (encrypted in MongoDB)

2. **API Sync Service** (3h)
   - Build sync worker (runs daily at 2 AM UTC)
   - Fetch supplier assessments from EcoVadis
   - Map EcoVadis scores → ClearESG supplier profile
   - Store assessment date, score, trend
   - Implement delta sync (only fetch updated since last sync)

3. **Risk Scoring Engine** (2h)
   - Auto-flag suppliers with score < 40 (high risk)
   - Map EcoVadis dimensions to risk categories
   - Create supplier risk dashboard
   - Alert system for newly high-risk suppliers

4. **Admin UI** (1h)
   - EcoVadis connection status page
   - Manual sync trigger button
   - Last sync timestamp display
   - Failed sync error logs
   - Disconnect functionality

#### Code Quality Standards
```typescript
// API Reliability
- Retry logic (exponential backoff)
- Timeout handling (30s max)
- Circuit breaker for EcoVadis API
- Fallback to cached scores if API down

// Data Integrity
- Idempotent operations (safe to retry)
- Transaction support for multi-document updates
- Data validation before storing
```

#### Production Readiness Checklist
- [ ] OAuth token management tested
- [ ] Daily sync runs without errors
- [ ] Error handling for API failures
- [ ] Performance tested (1000+ suppliers)
- [ ] Risk scoring validated manually
- [ ] Admin UI functional
- [ ] Monitoring alerts configured
- [ ] SLA: 99% sync success rate

---

## Category 9: BILLING & COMMERCIAL
### Sprint 1 Feature: Annual Billing with Discount

**Feature ID**: BC-001  
**Priority**: 🔴 CRITICAL  
**Effort**: 4 hours  
**Status**: ⬜ NOT STARTED

#### Acceptance Criteria
- [ ] Annual billing cycle option at checkout
- [ ] 15-20% discount for annual plans
- [ ] Billing cycle toggle in subscription management
- [ ] Pro-rata calculation for mid-cycle changes
- [ ] Renewal reminders (60, 30, 7 days before)
- [ ] Automatic renewal on annual date
- [ ] Manual renewal management UI
- [ ] Discount calculation in invoices

#### Implementation Tasks
1. **Stripe Integration** (2h)
   - Create Stripe price IDs for annual plans (STRIPE_PRICE_*_ANNUAL)
   - Implement billing cycle selector at checkout
   - Prorations calculation for upgrades/downgrades
   - Renewal automation (Stripe billing cycles)

2. **Database Schema** (1h)
   - Subscriptions.billingCycle enum (MONTHLY | ANNUAL)
   - Subscriptions.nextRenewalDate timestamp
   - Subscriptions.discountApplied boolean
   - SubscriptionHistory tracking for audits

3. **UI & Notifications** (1h)
   - Billing cycle toggle in account settings
   - Renewal reminders (email notifications)
   - Annual vs. Monthly pricing comparison
   - Invoice display with discount breakdown

#### Code Quality Standards
```typescript
// Financial Accuracy
- All monetary calculations use Decimal (not float)
- Rounding matches Stripe (2 decimal places)
- Audit trail for all discount applications
```

#### Production Readiness Checklist
- [ ] Annual pricing visible at checkout
- [ ] Discount correctly applied to invoices
- [ ] Renewal automation tested (dry run)
- [ ] Pro-rata calculations verified
- [ ] Stripe sync validated

---

# SPRINT 2: COMPLIANCE & REGULATIONS (Week 3-4)

## Category 3: COMPLIANCE & FRAMEWORKS
### Sprint 2 Feature Set (5 features)

**Features**: CSRD/ESRS, TCFD, ISSB S1/S2, Carbon Trust Workflows, Regulatory Calendar

**Total Effort**: 40 hours | **Status**: ⬜ NOT STARTED

#### Feature SF-001: CSRD/ESRS Automated Reporting

**Priority**: 🟠 HIGH  
**Effort**: 20 hours

**Acceptance Criteria**
- [ ] ESRS standard mapping (E1-E4, S1-S2, G1-G2 topics)
- [ ] Automated data population from ClearESG datapoints
- [ ] ESRS compliance report generation (PDF)
- [ ] Double materiality assessment integration
- [ ] Audit-ready report format
- [ ] Narrative auto-generation from framework mappings
- [ ] Assurance workflow integration
- [ ] Report version control
- [ ] Export to XBRL (future compatibility)

**Implementation Tasks**
1. Create ESRS standard data model (2h)
2. Build report template engine (5h)
3. Implement auto-population logic (8h)
4. Create narrative generator (3h)
5. Build PDF export (2h)

---

#### Feature SF-002: TCFD Framework Support

**Priority**: 🟠 HIGH  
**Effort**: 12 hours

**Acceptance Criteria**
- [ ] TCFD disclosure mapping (Governance, Strategy, Risk, Metrics)
- [ ] Climate scenario analysis integration
- [ ] Financial impact assessment
- [ ] Task Force alignment verification
- [ ] Disclosure report generation

**Implementation Tasks**
1. TCFD data model (2h)
2. Scenario analysis engine (5h)
3. Report generation (3h)
4. Impact calculator (2h)

---

#### Feature SF-003: ISSB S1/S2 Standards

**Priority**: 🟠 HIGH  
**Effort**: 12 hours

**Acceptance Criteria**
- [ ] S1 (General) & S2 (Climate) mapping
- [ ] Materiality threshold assessment
- [ ] Climate resilience indicators
- [ ] Governance structure documentation
- [ ] Disclosure report generation

---

#### Feature SF-004: Carbon Trust Certification Workflow

**Priority**: 🟡 MEDIUM  
**Effort**: 8 hours

**Acceptance Criteria**
- [ ] Carbon Trust Standard verification checklist
- [ ] Evidence collection & linking
- [ ] Auditor review workflow
- [ ] Certification status tracking

---

#### Feature SF-005: Regulatory Deadline Calendar

**Priority**: 🟡 MEDIUM  
**Effort**: 6 hours

**Acceptance Criteria**
- [ ] Auto-populated deadline calendar (CSRD, TCFD, GRI, ISSB)
- [ ] Jurisdiction-based filtering
- [ ] Email alerts (90, 60, 30, 14, 7 days before)
- [ ] Calendar export (iCal format)
- [ ] Custom deadline support

---

# SPRINT 3: SUPPLIER ECOSYSTEM (Week 5-6)

## Category 4: SUPPLIER MANAGEMENT
### Sprint 3 Feature Set (6 features)

**Features**: Risk Scoring, Supply Chain Mapping, Tiered Categorization, Document Repository, Compliance Dashboard, Bulk Assessment

**Total Effort**: 54 hours | **Status**: ⬜ NOT STARTED

#### Feature SM-002: Automated Supplier Risk Scoring

**Priority**: 🟠 HIGH  
**Effort**: 12 hours

**Acceptance Criteria**
- [ ] Risk scoring algorithm (0-100 scale)
- [ ] Multi-factor scoring (EcoVadis, GHG intensity, location, compliance)
- [ ] Risk tier mapping (Low, Medium, High, Critical)
- [ ] Automated flags for high-risk suppliers
- [ ] Risk dashboard with filtering
- [ ] Historical trend tracking
- [ ] Audit trail for score changes
- [ ] Procurement notification system

**Implementation Tasks**
1. Risk scoring algorithm (4h)
2. Risk dashboard UI (3h)
3. Notification system (3h)
4. Historical tracking (2h)

---

#### Feature SM-003: Supply Chain Mapping Visualization

**Priority**: 🟡 MEDIUM  
**Effort**: 14 hours

**Acceptance Criteria**
- [ ] Network graph visualization (org → Tier 1 → Tier 2/3)
- [ ] Emissions flow through supply chain
- [ ] Interactive drill-down capabilities
- [ ] Bottleneck identification
- [ ] Supplier concentration analysis
- [ ] Export to PNG/SVG
- [ ] Performance optimized for 1000+ nodes

---

#### Feature SM-004: Tiered Supplier Categorization

**Priority**: 🟠 HIGH  
**Effort**: 6 hours

**Acceptance Criteria**
- [ ] Tier 1 (direct), Tier 2, Tier 3+ classification
- [ ] Risk-weighted data collection
- [ ] Separate tracking & reporting by tier
- [ ] Auto-categorization rules (spend-based)
- [ ] Manual override capability

---

#### Feature SM-005: Supplier Document Repository

**Priority**: 🟡 MEDIUM  
**Effort**: 8 hours

**Acceptance Criteria**
- [ ] Document upload system (ESG reports, certifications, carbon data)
- [ ] Version control & timestamp tracking
- [ ] Full-text search across documents
- [ ] Linked to supplier profile & assurance
- [ ] Access control by org
- [ ] Virus scanning on upload

---

#### Feature SM-006: Supplier Compliance Dashboard

**Priority**: 🟡 MEDIUM  
**Effort**: 10 hours

**Acceptance Criteria**
- [ ] Real-time compliance status (data freshness, response rate)
- [ ] SLA tracking (% suppliers responding within 30 days)
- [ ] Flagged issues per supplier
- [ ] Email reminders for non-responders
- [ ] Compliance scorecards
- [ ] Drill-down to individual supplier data

---

#### Feature SM-007: Bulk Supplier Assessment

**Priority**: 🟡 MEDIUM  
**Effort**: 6 hours

**Acceptance Criteria**
- [ ] CSV import of supplier list
- [ ] Auto-send standardized questionnaire
- [ ] Bulk tracking & status updates
- [ ] Export results to Excel

---

# SPRINT 4: ANALYTICS & INSIGHTS (Week 7-8)

## Category 7: ANALYTICS & INSIGHTS
### Sprint 4 Feature Set (5 features)

**Features**: Peer Benchmarking, Scenario Modeling, Decarbonization Pathways, Predictive Trends, Consumption Intensity

**Total Effort**: 60 hours | **Status**: ⬜ NOT STARTED

#### Feature AN-001: Peer/Industry Benchmarking

**Priority**: 🟡 MEDIUM  
**Effort**: 14 hours

**Acceptance Criteria**
- [ ] Anonymized peer data aggregation
- [ ] Industry classification by NAICS/SIC code
- [ ] Size-normalized comparisons (revenue, headcount, employees)
- [ ] Emissions intensity benchmarks
- [ ] Board-ready comparison charts
- [ ] Competitive positioning dashboard
- [ ] 90th, 50th, 10th percentile tracking

**Implementation Tasks**
1. Data aggregation pipeline (4h)
2. Benchmarking algorithm (4h)
3. Dashboard UI (4h)
4. Data anonymization (2h)

---

#### Feature AN-002: Scenario Modeling

**Priority**: 🟠 HIGH  
**Effort**: 20 hours

**Acceptance Criteria**
- [ ] Scenario builder UI (baseline, optimistic, pessimistic)
- [ ] Variable mapping (emissions drivers → levers)
- [ ] Impact estimation engine
- [ ] Monte Carlo simulation (confidence intervals)
- [ ] Sensitivity analysis
- [ ] Compare scenarios side-by-side
- [ ] Export to Excel
- [ ] Scenario versioning

**Implementation Tasks**
1. Scenario data model (3h)
2. Scenario builder UI (6h)
3. Impact estimation (6h)
4. Monte Carlo simulation (3h)
5. Visualization (2h)

---

#### Feature AN-003: Decarbonization Pathway Planning

**Priority**: 🟡 MEDIUM  
**Effort**: 16 hours

**Acceptance Criteria**
- [ ] Lever library (renewable energy, efficiency, etc.)
- [ ] Timeline planner (year-by-year roadmap)
- [ ] Impact per lever (kgCO2e reduction)
- [ ] Cost-benefit analysis
- [ ] Board-ready presentation format
- [ ] Integration with SBTi targets

---

#### Feature AN-004: Predictive Trend Analysis

**Priority**: 🟠 HIGH  
**Effort**: 12 hours

**Acceptance Criteria**
- [ ] Time-series forecasting (next 12 months)
- [ ] Confidence intervals (80%, 95%)
- [ ] Auto-select best model (ETS, ARIMA)
- [ ] Trend breakdown by category
- [ ] Accuracy metrics displayed
- [ ] Export forecast data

---

#### Feature AN-005: Consumption Intensity Metrics

**Priority**: 🟡 MEDIUM  
**Effort**: 10 hours

**Acceptance Criteria**
- [ ] Emissions per revenue (tCO2e/$M)
- [ ] Emissions per employee (tCO2e/emp)
- [ ] Emissions per unit produced
- [ ] YoY intensity trends
- [ ] Decoupling analysis (growth vs. emissions)
- [ ] Target vs. actual tracking

---

# SPRINT 5: ENTERPRISE INTEGRATIONS PART 1 (Week 9-10)

## Category 8: INTEGRATIONS & AUTOMATION
### Sprint 5 Feature Set (3 features)

**Features**: Salesforce Integration, NetSuite Integration, Accounting System Sync

**Total Effort**: 30 hours | **Status**: ⬜ NOT STARTED

#### Feature INT-001: Salesforce Integration

**Priority**: 🟠 HIGH  
**Effort**: 12 hours

**Acceptance Criteria**
- [ ] OAuth 2.0 authentication
- [ ] Account & contact syncing
- [ ] Org hierarchy mapping
- [ ] ESG metrics in Salesforce records
- [ ] Two-way sync (CRM → ClearESG, ClearESG → CRM)
- [ ] Webhook triggers for data updates
- [ ] Salesforce AppExchange listing ready
- [ ] Admin UI for connection management

**Implementation Tasks**
1. Salesforce OAuth setup (2h)
2. Data mapper (account → org) (3h)
3. Sync worker (bi-directional) (4h)
4. Admin UI (3h)

---

#### Feature INT-002: NetSuite Integration

**Priority**: 🟡 MEDIUM  
**Effort**: 10 hours

**Acceptance Criteria**
- [ ] OAuth 2.0 authentication
- [ ] General Ledger sync
- [ ] GL code → emissions category mapping
- [ ] Spend-based emissions calculation
- [ ] Invoice & PO integration
- [ ] Real-time sync (webhook-based)
- [ ] Admin UI for GL code mapping

---

#### Feature INT-003: Xero/QuickBooks Accounting Sync

**Priority**: 🟡 MEDIUM  
**Effort**: 8 hours

**Acceptance Criteria**
- [ ] OAuth 2.0 for both Xero & QB
- [ ] Expense category syncing
- [ ] Spend-based emissions calculation
- [ ] Automated GL code categorization
- [ ] Bank feed support (for utility bills)
- [ ] Monthly reconciliation report

---

# SPRINT 6: ENTERPRISE INTEGRATIONS PART 2 (Week 11-12)

## Category 8: INTEGRATIONS & AUTOMATION (Continued)
### Sprint 6 Feature Set (4 features)

**Features**: SAP Connector, Data Warehouse Connectors, Webhooks, Power BI/Tableau

**Total Effort**: 38 hours | **Status**: ⬜ NOT STARTED

#### Feature INT-004: SAP Integration (S/4HANA)

**Priority**: 🟠 HIGH  
**Effort**: 16 hours

**Acceptance Criteria**
- [ ] ODATA API integration
- [ ] GL posting from ClearESG
- [ ] Bill of materials (BOM) integration
- [ ] Production data sync
- [ ] Real-time data flow
- [ ] Error handling & reconciliation
- [ ] Admin UI for SAP connection

---

#### Feature INT-005: Data Warehouse Connectors (Snowflake, BigQuery, Databricks)

**Priority**: 🟡 MEDIUM  
**Effort**: 10 hours

**Acceptance Criteria**
- [ ] Snowflake share integration
- [ ] BigQuery dataset connector
- [ ] Databricks Delta Lake support
- [ ] Incremental data export
- [ ] Scheduled refresh (daily, hourly)
- [ ] Data freshness monitoring

---

#### Feature INT-006: Webhook Support & Zapier/Make

**Priority**: 🟡 MEDIUM  
**Effort**: 10 hours

**Acceptance Criteria**
- [ ] Custom webhook triggers (data updated, alerts, etc.)
- [ ] Zapier integration
- [ ] Make.com integration
- [ ] Workflow automation templates
- [ ] Testing & debugging tools

---

#### Feature INT-007: Power BI / Tableau Connector

**Priority**: 🟡 MEDIUM  
**Effort**: 12 hours

**Acceptance Criteria**
- [ ] Tableau direct connector
- [ ] Power BI custom connector
- [ ] Live data refresh
- [ ] Row-level security (RLS)
- [ ] Sample dashboards included

---

# SPRINT 7: PLATFORM & UX POLISH (Week 13-14)

## Category 9: PLATFORM & UX
### Sprint 7 Feature Set (4 features)

**Features**: Advanced Roles, Bulk Operations, Saved Filters, Audit Log Search

**Total Effort**: 28 hours | **Status**: ⬜ NOT STARTED

#### Feature UX-001: Advanced Permission System (Custom Roles)

**Priority**: 🟡 MEDIUM  
**Effort**: 8 hours

**Acceptance Criteria**
- [ ] Custom role builder UI
- [ ] Capability matrix (action × resource × scope)
- [ ] Role templates (default roles for common scenarios)
- [ ] Audit trail for permission changes
- [ ] Role inheritance/hierarchy
- [ ] Bulk user assignment

---

#### Feature UX-002: Bulk Operations & Multi-Select

**Priority**: 🟡 MEDIUM  
**Effort**: 6 hours

**Acceptance Criteria**
- [ ] Multi-select checkboxes across list views
- [ ] Bulk action menu (delete, update status, assign, etc.)
- [ ] Bulk email reminders for suppliers
- [ ] Batch operations (100+ items)
- [ ] Undo capability for bulk operations

---

#### Feature UX-003: Saved Filters & Custom Views

**Priority**: 🟡 MEDIUM  
**Effort**: 8 hours

**Acceptance Criteria**
- [ ] Save complex filter combinations
- [ ] Name and organize saved views
- [ ] Share views with team
- [ ] Default view per user
- [ ] Quick-filter buttons (common scenarios)

---

#### Feature UX-004: Audit Log Search & Export

**Priority**: 🟡 MEDIUM  
**Effort**: 6 hours

**Acceptance Criteria**
- [ ] Full-text search across audit logs
- [ ] Filter by user, action, resource, time range
- [ ] Export to CSV/Excel
- [ ] Advanced search syntax support
- [ ] Performance optimized (10K+ log entries)

---

# SPRINT 8: BILLING, AUTOMATION & EDGE CASES (Week 15-16)

## Category 9: BILLING & COMMERCIAL (Continued)
### Sprint 8 Feature Set (4 features)

**Features**: Freemium Model, Usage-Based Pricing, Volume Discounts, Dunning

**Total Effort**: 20 hours | **Status**: ⬜ NOT STARTED

#### Feature BC-002: Free Tier / Freemium Model

**Priority**: 🟡 MEDIUM  
**Effort**: 8 hours

**Acceptance Criteria**
- [ ] Free account creation (no credit card)
- [ ] Free tier limits (100 datapoints, basic reporting)
- [ ] Upgrade prompts when approaching limits
- [ ] Conversion tracking (free → paid)
- [ ] Stripe payment integration for upgrade

---

#### Feature BC-003: Usage-Based Pricing

**Priority**: 🟡 MEDIUM  
**Effort**: 6 hours

**Acceptance Criteria**
- [ ] Meter datapoints, reports, API calls
- [ ] Pricing: $0.05/datapoint, $1/report
- [ ] Real-time usage dashboard
- [ ] Monthly billing with overage charges
- [ ] Usage forecast & alerts

---

#### Feature BC-004: Volume Discounts

**Priority**: 🟡 MEDIUM  
**Effort**: 3 hours

**Acceptance Criteria**
- [ ] 10% discount for 5+ seats
- [ ] 20% discount for 20+ seats
- [ ] Manual discount application (for larger deals)
- [ ] Discount audit trail

---

#### Feature BC-005: Dunning / Failed Payment Retry

**Priority**: 🟡 MEDIUM  
**Effort**: 3 hours

**Acceptance Criteria**
- [ ] Stripe dunning integration
- [ ] Automated retry schedule (1, 3, 5 days)
- [ ] Email notifications to account owner
- [ ] Fallback to manual payment link
- [ ] Recovery tracking & reporting

---

## Category 1: DATA COLLECTION & IMPORT (Continued)
### Sprint 8 Feature Set (4 features - remaining data collection)

**Features**: Real-time IoT, ERP Connectors, Email Collection, Smart Data Quality Rules

**Total Effort**: 30 hours | **Status**: ⬜ NOT STARTED

#### Feature DC-002: Real-Time Meter/IoT Integration

**Priority**: 🟠 HIGH  
**Effort**: 12 hours

**Acceptance Criteria**
- [ ] MQTT broker support
- [ ] Modbus/OPC-UA protocol support
- [ ] Utility API connectors (energy, water, gas)
- [ ] Real-time data ingestion & aggregation
- [ ] Meter status monitoring
- [ ] Anomaly detection for meter failures
- [ ] Data validation rules

**Implementation Tasks**
1. MQTT server setup (2h)
2. Protocol adapters (Modbus, OPC-UA) (5h)
3. Utility API clients (3h)
4. Real-time aggregation (2h)

---

#### Feature DC-003: ERP Database Connectors

**Priority**: 🟠 HIGH  
**Effort**: 20 hours

**Acceptance Criteria**
- [ ] NetSuite, Xero, QuickBooks support (covered in INT-002, INT-003)
- [ ] Workday integration (HR data for intensity metrics)
- [ ] Data mapper for custom fields
- [ ] Scheduled sync (configurable frequency)
- [ ] Change data capture (CDC) for real-time sync
- [ ] Reconciliation reports

---

#### Feature DC-004: Email-Based Data Collection

**Priority**: 🟡 MEDIUM  
**Effort**: 4 hours

**Acceptance Criteria**
- [ ] Automated email forms for suppliers
- [ ] Template-based form parsing
- [ ] Reply detection & data extraction
- [ ] Attachment processing
- [ ] Fallback to manual entry

---

#### Feature DC-005: Smart Data Quality Rules Engine

**Priority**: 🟡 MEDIUM  
**Effort**: 8 hours

**Acceptance Criteria**
- [ ] User-defined validation rules UI
- [ ] Rule templates (min/max range, regex, business logic)
- [ ] Auto-flag violations
- [ ] Rule versioning & history
- [ ] Performance optimized (1000+ rules)

---

## Category 5: ASSURANCE & VERIFICATION (Continued)
### Sprint 8 Feature Set (2 features)

**Features**: ISO 14064 Compliance, Assurance Partner Directory

**Total Effort**: 14 hours | **Status**: ⬜ NOT STARTED

#### Feature ASS-001: ISO 14064 Compliance Checklist

**Priority**: 🟡 MEDIUM  
**Effort**: 6 hours

**Acceptance Criteria**
- [ ] ISO 14064-1 requirements mapping
- [ ] Verification checklist
- [ ] Evidence linking
- [ ] Auditor review workflow
- [ ] Compliance score

---

#### Feature ASS-002: Assurance Partner Directory

**Priority**: 🟡 MEDIUM  
**Effort**: 8 hours

**Acceptance Criteria**
- [ ] Directory of qualified audit firms
- [ ] Firm profiles & capabilities
- [ ] Review ratings & past engagements
- [ ] Booking integration
- [ ] SLA tracking & monitoring

---

## Category 6: REPORTING & EXPORT (Continued)
### Sprint 8 Feature Set (3 features - remaining reporting)

**Features**: Interactive HTML Reports, Excel Templates, Scheduled Delivery

**Total Effort**: 30 hours | **Status**: ⬜ NOT STARTED

#### Feature REP-001: Interactive HTML5 Reports

**Priority**: 🟡 MEDIUM  
**Effort**: 10 hours

**Acceptance Criteria**
- [ ] React-based report builder
- [ ] Interactive charts (drill-down, filtering)
- [ ] Data tables with sorting/pagination
- [ ] Export to PNG/PDF
- [ ] Share via link
- [ ] Responsive design (mobile-friendly)

---

#### Feature REP-002: Excel Templates with Auto-Population

**Priority**: 🟡 MEDIUM  
**Effort**: 8 hours

**Acceptance Criteria**
- [ ] Pre-built Excel templates per framework
- [ ] Auto-populate with organization data
- [ ] Formula preservation
- [ ] Chart generation
- [ ] Download ready-to-present format

---

#### Feature REP-003: Scheduled Report Delivery

**Priority**: 🟡 MEDIUM  
**Effort**: 8 hours

**Acceptance Criteria**
- [ ] Schedule reports (daily, weekly, monthly)
- [ ] Email delivery with PDF attachment
- [ ] Webhook triggers for external systems
- [ ] Recipient management
- [ ] Delivery tracking & logs

---

## Category 2: EMISSIONS CALCULATION (Continued)
### Sprint 8 Feature Set (3 features - remaining emissions)

**Features**: Spend-Based Emissions, Product-Level Footprinting, Custom Factor Database

**Total Effort**: 38 hours | **Status**: ⬜ NOT STARTED

#### Feature EM-001: Spend-Based Emissions Calculations

**Priority**: 🟠 HIGH  
**Effort**: 16 hours

**Acceptance Criteria**
- [ ] IO table integration (USEEIO, EXIOBASE)
- [ ] GL code → industry mapping
- [ ] Emissions factor lookup by category
- [ ] Calculation: Spend × Factor = Emissions
- [ ] Accuracy within 10% of actual (when available)
- [ ] Audit trail for assumptions
- [ ] Comparison vs. activity-based data

---

#### Feature EM-002: Product-Level Carbon Footprinting

**Priority**: 🟡 MEDIUM  
**Effort**: 30 hours

**Acceptance Criteria**
- [ ] SKU management (product codes, names, categories)
- [ ] Bill of materials (BOM) import
- [ ] Supplier emission factors per material
- [ ] Production process emissions
- [ ] Packaging emissions
- [ ] Transportation emissions (distance-weighted)
- [ ] End-of-life emissions (disposal scenario)
- [ ] Total product carbon (cradle-to-grave)
- [ ] Product carbon label generation

---

#### Feature EM-003: Custom Emissions Factor Database

**Priority**: 🟡 MEDIUM  
**Effort**: 12 hours

**Acceptance Criteria**
- [ ] Admin UI for factor management
- [ ] Import factors from external sources
- [ ] Factor versioning & effective dates
- [ ] Calculation source documentation
- [ ] Factor usage tracking
- [ ] Audit trail for changes

---

# SPRINT 8 (CONTINUED): MISCELLANEOUS & PLATFORM FEATURES

## Category 1: DATA COLLECTION & IMPORT (Final)
### Historical Data Backfill Tools

**Feature ID**: DC-006  
**Priority**: 🟢 LOW  
**Effort**: 6 hours

**Acceptance Criteria**
- [ ] Bulk import tool for prior years (2020-2025)
- [ ] Same validation as current data
- [ ] Anomaly detection enabled
- [ ] Batch processing for performance
- [ ] Progress tracking & error reporting

---

## Category 3: COMPLIANCE & FRAMEWORKS (Final)
### EU Green Taxonomy Alignment

**Feature ID**: CF-006  
**Priority**: 🟡 MEDIUM  
**Effort**: 8 hours

**Acceptance Criteria**
- [ ] Activity classification against EU taxonomy
- [ ] % taxonomy-aligned calculation
- [ ] Financial alignment reporting
- [ ] SFDR Article 10 disclosure support

---

## Category 7: ANALYTICS & INSIGHTS (Final)
### Root Cause Analysis & Executive Dashboards

**Feature ID**: AN-006 + AN-007  
**Priority**: 🟡 MEDIUM  
**Effort**: 18 hours

**Acceptance Criteria (Root Cause)**
- [ ] Drill-down by supplier, facility, category, source
- [ ] Contributor charts (what drove the change?)
- [ ] Export capability
- [ ] Quick-filter buttons

**Acceptance Criteria (Executive Dashboard)**
- [ ] KPI cards (top 5-7 metrics)
- [ ] Status indicators (red/yellow/green)
- [ ] YoY trends
- [ ] Drill-down links to detailed views
- [ ] Customizable layout

---

---

# COMPLETE FEATURE IMPLEMENTATION CHECKLIST

## Non-AI Features Summary (40 features)

### SPRINT 1: CRITICAL FOUNDATION (24 hours)
- [ ] **DC-001**: API/Webhook Data Ingestion (8h)
- [ ] **CF-001**: GHG Protocol 2004 Compliance (8h)
- [ ] **SM-001**: EcoVadis Integration (8h)
- [ ] **BC-001**: Annual Billing with Discount (4h)

**Expected Output**: Enterprise data feeds + compliance baseline + supply chain integration

---

### SPRINT 2: COMPLIANCE & REGULATIONS (40 hours)
- [ ] **SF-001**: CSRD/ESRS Automated Reporting (20h)
- [ ] **SF-002**: TCFD Framework Support (12h)
- [ ] **SF-003**: ISSB S1/S2 Standards (12h)
- [ ] **SF-004**: Carbon Trust Certification Workflow (8h)
- [ ] **SF-005**: Regulatory Deadline Calendar (6h)

**Expected Output**: EU compliance ready + regulatory tracking

---

### SPRINT 3: SUPPLIER ECOSYSTEM (54 hours)
- [ ] **SM-002**: Automated Supplier Risk Scoring (12h)
- [ ] **SM-003**: Supply Chain Mapping Visualization (14h)
- [ ] **SM-004**: Tiered Supplier Categorization (6h)
- [ ] **SM-005**: Supplier Document Repository (8h)
- [ ] **SM-006**: Supplier Compliance Dashboard (10h)
- [ ] **SM-007**: Bulk Supplier Assessment (6h)

**Expected Output**: Full supply chain visibility + procurement alignment

---

### SPRINT 4: ANALYTICS & INSIGHTS (60 hours)
- [ ] **AN-001**: Peer/Industry Benchmarking (14h)
- [ ] **AN-002**: Scenario Modeling (20h)
- [ ] **AN-003**: Decarbonization Pathway Planning (16h)
- [ ] **AN-004**: Predictive Trend Analysis (12h)
- [ ] **AN-005**: Consumption Intensity Metrics (10h)

**Expected Output**: Strategic planning + executive insights

---

### SPRINT 5: ENTERPRISE INTEGRATIONS PART 1 (30 hours)
- [ ] **INT-001**: Salesforce Integration (12h)
- [ ] **INT-002**: NetSuite Integration (10h)
- [ ] **INT-003**: Xero/QuickBooks Sync (8h)

**Expected Output**: CRM + Accounting integrations live

---

### SPRINT 6: ENTERPRISE INTEGRATIONS PART 2 (38 hours)
- [ ] **INT-004**: SAP Integration (16h)
- [ ] **INT-005**: Data Warehouse Connectors (10h)
- [ ] **INT-006**: Webhook Support & Zapier (10h)
- [ ] **INT-007**: Power BI / Tableau Connector (12h)

**Expected Output**: Full enterprise tech stack integration

---

### SPRINT 7: PLATFORM & UX POLISH (28 hours)
- [ ] **UX-001**: Advanced Roles & Permissions (8h)
- [ ] **UX-002**: Bulk Operations (6h)
- [ ] **UX-003**: Saved Filters & Views (8h)
- [ ] **UX-004**: Audit Log Search & Export (6h)

**Expected Output**: Enterprise-grade UX

---

### SPRINT 8: FINAL FEATURES & POLISH (148 hours)
- [ ] **BC-002**: Freemium Model (8h)
- [ ] **BC-003**: Usage-Based Pricing (6h)
- [ ] **BC-004**: Volume Discounts (3h)
- [ ] **BC-005**: Dunning/Failed Payment Retry (3h)
- [ ] **DC-002**: Real-Time IoT Integration (12h)
- [ ] **DC-003**: ERP Database Connectors (20h)
- [ ] **DC-004**: Email-Based Data Collection (4h)
- [ ] **DC-005**: Smart Data Quality Rules (8h)
- [ ] **ASS-001**: ISO 14064 Compliance (6h)
- [ ] **ASS-002**: Assurance Partner Directory (8h)
- [ ] **REP-001**: Interactive HTML Reports (10h)
- [ ] **REP-002**: Excel Templates (8h)
- [ ] **REP-003**: Scheduled Report Delivery (8h)
- [ ] **EM-001**: Spend-Based Emissions (16h)
- [ ] **EM-002**: Product Carbon Footprinting (30h)
- [ ] **EM-003**: Custom Factor Database (12h)
- [ ] **DC-006**: Historical Data Backfill (6h)
- [ ] **CF-006**: EU Green Taxonomy (8h)
- [ ] **AN-006**: Root Cause Analysis (10h)
- [ ] **AN-007**: Executive Dashboard (8h)

**Expected Output**: Feature-complete platform

---

## TOTAL PROJECT SUMMARY

| Metric | Value |
|--------|-------|
| **Total Sprints** | 8 (16 weeks) |
| **Total Features** | 40 |
| **Total Hours** | 246 hours |
| **Engineers Needed** | 2-3 (full-time) |
| **Code Quality** | Production-ready, highly optimized |
| **Target Segments** | Mid-Market, Growth, Enterprise, Specialist |
| **TAM Expansion** | +80% (from $200M to $600M+) |

---

# EACH CHAT STRUCTURE

**For each feature, create a NEW chat with this structure:**

```
## Feature Implementation Chat

### Feature: [Name] (Feature ID: XX-YYY)
- **Priority**: 🔴/🟠/🟡/🟢
- **Effort**: Xh
- **Status**: ⬜ NOT STARTED → 🟨 IN PROGRESS → ✅ COMPLETED

### Quick Brief
[1-2 sentence overview]

### Acceptance Criteria Checklist
- [ ] All criteria from roadmap

### Implementation Checklist
1. [ ] Task 1
2. [ ] Task 2
3. [ ] ...

### Code Quality & Testing Metrics
- [ ] Unit tests: Xh tests
- [ ] Integration tests: Xh scenarios
- [ ] Load testing: [if applicable]
- [ ] TypeScript: 0 any types
- [ ] Security audit: [if applicable]

### Production Readiness Sign-Off
- [ ] All tests passing
- [ ] Code review approved (2+ engineers)
- [ ] Documentation complete
- [ ] Monitoring alerts configured
- [ ] Backward compatibility verified
- [ ] Performance benchmarks met
- [ ] Security audit passed

### Handoff to Next Feature
[When complete, mark as ✅ and reference next feature]
```

---

# CODE QUALITY STANDARDS (Applied to ALL Features)

## TypeScript & Type Safety
```typescript
// ✅ REQUIRED
- Strict mode: true
- No `any` types (use `unknown` if needed, then narrow)
- All imports explicitly typed
- Zod schemas for all API inputs/outputs
- Return types on all functions (no implicit any)

// ❌ NOT ALLOWED
- `any` type (except in migration scenarios, with comment)
- Implicit `unknown` returns
- Untyped function parameters
- Loose MongoDB queries
```

## Performance Standards
```typescript
// ✅ TARGET METRICS
- API response: <100ms (p95)
- Database query: <50ms (p95)
- Bulk operations: <5s for 1000 items
- Real-time features: <1s latency
- Memory: <50MB per service
- Concurrent connections: 1000+

// ❌ NOT ACCEPTABLE
- N+1 database queries
- Unindexed searches
- Synchronous operations on critical path
- Unbounded array allocations
```

## Testing Coverage
```typescript
// ✅ MINIMUM COVERAGE
- Unit tests: 80%+ line coverage
- Integration tests: Critical paths 100%
- Edge cases tested (null, empty, boundary values)
- Error scenarios tested
- Concurrent access tested (where applicable)
- Load testing (>100 req/s sustainable)

// Test File Structure
// src/lib/feature/__tests__/feature.test.ts
describe('FeatureService', () => {
  describe('happy path', () => { /* 60% of tests */ })
  describe('edge cases', () => { /* 20% of tests */ })
  describe('error handling', () => { /* 20% of tests */ })
})
```

## Security Standards
```typescript
// ✅ REQUIRED SECURITY CHECKS
- Input validation (Zod schemas)
- Output encoding (no raw HTML)
- SQL injection prevention (parameterized queries)
- XSS prevention (React.escape by default)
- CSRF tokens on state-changing operations
- ABAC enforcement on all endpoints
- Audit logging for sensitive operations
- Encryption for PII/credentials
- Rate limiting on public endpoints
- HTTPS/TLS 1.2+ only

// ❌ SECURITY ANTI-PATTERNS
- Trusting user input without validation
- Hardcoded secrets
- Logging sensitive data
- Weak password requirements
- Missing ABAC checks
- Direct MongoDB queries with user input
```

## Code Organization
```
src/lib/feature/
  ├── service.ts              (core logic, testable)
  ├── types.ts                (TypeScript interfaces)
  ├── validators.ts           (Zod schemas)
  ├── utils.ts                (helper functions)
  └── __tests__/
      ├── service.test.ts     (60+ tests)
      ├── validators.test.ts  (20+ tests)
      └── utils.test.ts       (15+ tests)

src/app/(frontend)/api/app/[feature]/
  ├── route.ts                (route handler)
  └── __tests__/
      └── route.test.ts       (integration tests)

src/collections/
  └── FeatureEntity.ts        (Payload CMS collection)
```

## Documentation Standards
```typescript
/**
 * High-level function description.
 * 
 * @param input - Parameter description
 * @returns Description of return value
 * @throws FeatureError if validation fails
 * 
 * @example
 * const result = await service.doSomething(input);
 */
export async function doSomething(input: InputType): Promise<OutputType> {
  // Implementation
}
```

## Git Commit Standards
```bash
# ✅ GOOD COMMITS
git commit -m "feat: implement webhook receiver with signature verification"
git commit -m "fix: handle null values in emissions calculation"
git commit -m "perf: add MongoDB index on org_id for 100x speedup"
git commit -m "test: add 40+ test cases for webhook service"
git commit -m "docs: add OpenAPI spec for data ingestion API"

# ❌ BAD COMMITS
git commit -m "stuff"
git commit -m "WIP"
git commit -m "Update code"
```

---

# PRODUCTION READINESS CHECKLIST (Apply to EVERY Feature)

Before marking a feature as ✅ COMPLETED:

- [ ] **Code Quality**
  - [ ] TypeScript strict mode: 0 errors
  - [ ] ESLint: 0 warnings
  - [ ] Prettier: Code formatted
  - [ ] Test coverage: ≥80%
  - [ ] No `any` types
  
- [ ] **Testing**
  - [ ] Unit tests: All passing
  - [ ] Integration tests: All passing
  - [ ] Load testing: Meets SLA
  - [ ] Security testing: OWASP Top 10 verified
  - [ ] Edge case testing: Complete
  
- [ ] **Performance**
  - [ ] Response times: <100ms p95
  - [ ] Database queries: <50ms p95
  - [ ] Memory usage: <50MB
  - [ ] Connection pooling: Enabled
  - [ ] Caching: Implemented where applicable
  
- [ ] **Security**
  - [ ] Input validation: 100% coverage
  - [ ] ABAC enforcement: All endpoints checked
  - [ ] Secrets: None hardcoded (all in env)
  - [ ] Audit logging: Critical operations logged
  - [ ] Rate limiting: Configured
  - [ ] HTTPS/TLS: Enforced
  
- [ ] **Documentation**
  - [ ] Code comments: Complex logic explained
  - [ ] API docs: OpenAPI spec complete
  - [ ] Error codes: All documented
  - [ ] Examples: curl/code examples provided
  - [ ] Runbook: Operations guide ready
  
- [ ] **Monitoring**
  - [ ] Error alerts: Configured
  - [ ] Performance alerts: Configured
  - [ ] Logging: Structured JSON logs
  - [ ] Metrics: Business KPIs tracked
  - [ ] Dashboards: Grafana/DataDog ready
  
- [ ] **Deployment**
  - [ ] Zero-downtime deployment: Tested
  - [ ] Rollback plan: Documented
  - [ ] Database migrations: Tested
  - [ ] Feature flags: If needed
  - [ ] Canary deployment: 5% → 25% → 100%
  
- [ ] **Backward Compatibility**
  - [ ] No breaking API changes
  - [ ] Old client versions still work
  - [ ] Database schema: Backward compatible
  - [ ] Deprecation warnings: Added if needed

---

# HANDOFF BETWEEN CHATS

**When feature is COMPLETED (✅ status):**

1. Update this roadmap with completion date & link to implementation chat
2. Create implementation summary (code size, tests, performance metrics)
3. Reference the NEXT feature to work on:
   ```
   ✅ DC-001 COMPLETED
   → Next: Start CF-001 (GHG Protocol Compliance)
   Implementation: [link to chat]
   ```

4. Flag any **blockers** or **dependencies**:
   ```
   ⚠️ Blocker: Need EcoVadis API credentials (request from sales)
   ⚠️ Dependency: Requires DC-001 (API Ingestion) complete first
   ```

---

# SUCCESS METRICS (End of Sprint 8)

By end of week 16:

- [ ] 40+ features production-ready
- [ ] 5000+ unit tests passing
- [ ] 100+ integration tests passing
- [ ] 80%+ code coverage
- [ ] All performance benchmarks met
- [ ] Zero critical security issues
- [ ] Full API documentation (OpenAPI)
- [ ] 99.9% uptime in staging
- [ ] Ready for 1-month testing phase

---

**Document Version**: 1.0  
**Last Updated**: 2026-07-29  
**Status**: Ready for Implementation  
**Next Step**: Start SPRINT 1 with new chat for DC-001 (API/Webhook Ingestion)
