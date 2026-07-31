# Sprint 6-10: Detailed Implementation Prompts for 31 Missing Features

**Total Effort**: 282 hours (~7 weeks for 1 engineer)  
**Quality Bar**: Production-ready, zero paid APIs, honor design tokens, full test coverage

---

# SPRINT 6: QUICK WINS (36 hours, Week 1-2)

## Feature S6.1: Intensity Metrics (4 hours)

```
You are implementing ClearESG feature S6.1: Intensity Metrics.

Purpose: Calculate and display emissions per unit (revenue, employee, product, etc.)
Example: "5 tCO2e per $1M revenue" or "0.5 tCO2e per employee per year"

Mode: GAP-FILL on existing Organisations collection

READ FIRST:
- src/lib/metrics/ (if exists, or create)
- src/collections/Organisations.ts (org revenue, employee count fields)
- src/lib/scope3/calculator.ts (emissions calculation pattern)
- src/app/(frontend)/api/app/analytics/ (routing pattern)

DO:
1. Add intensity calculation service (pure function):
   - calculateEmissionsIntensity(totalEmissions, denominator, unit)
   - Returns: { value, unit, confidence, change% }
   - Supports: per-revenue, per-employee, per-output, per-square-meter
   - Unit examples: "tCO2e/$M", "tCO2e/employee", "kgCO2e/unit"

2. API Route:
   - GET /api/app/analytics/intensity?period=2026&type=per_revenue
   - Returns: { current, previous_year, change%, benchmarkMedian, status }

3. UI Components:
   - Intensity card on dashboard (show current + trend)
   - Intensity detail page with all types (revenue, employee, output)
   - Comparison to peer median

4. Database fields (add to Organisations):
   - annualRevenue (number, optional)
   - employeeCount (number, optional)
   - annualOutputUnits (number, optional)
   - outputUnitName (string, e.g., "widgets")

5. Testing:
   - Unit tests for intensity calculation (handle zero denominators)
   - Integration: org with emissions + revenue → correct intensity
   - Edge case: missing denominator → return null, not error

MUST NOT:
- Hardcode units (must be configurable)
- Divide by zero (return null with explanation)
- Trust browser unit conversions (server-side only)
- Skip peer comparison (show vs. median)

DONE WHEN:
- GET /api/app/analytics/intensity responds with all types
- Dashboard card shows current + YoY change
- Unit tests cover 5+ scenarios
- pnpm build clean, zero any

Files changed: +2 services, +1 route, +1 UI page, +3 fields in Organisations
Time: 4 hours
```

---

## Feature S6.2: Regulatory Calendar (4 hours)

```
You are implementing ClearESG feature S6.2: Regulatory Calendar.

Purpose: Centralized deadline tracking for CSRD, ISSB, SBTi, taxonomies, etc.
Example: "CSRD deadline: Dec 31, 2026 — 185 days left"

Mode: Complete RegulatoryDeadlines collection + UI

READ FIRST:
- src/collections/RegulatoryDeadlines.ts (schema, exists but incomplete)
- src/app/(frontend)/(app)/ (calendar page patterns)
- src/lib/compliance/ (compliance tracking patterns)

DO:
1. Complete RegulatoryDeadlines collection:
   - Fields: name, type (CSRD|ISSB|SBTi|Taxonomy|Other)
   - dueDate, country, scope (applies_to: all|industry|size|country)
   - severity (critical|high|medium), description, documentationUrl
   - status (pending|in-progress|completed|missed)
   - organisationApplicability (rule-based: org size, industry, country)

2. Calendar Application Logic:
   - Auto-select deadlines applicable to org (based on size, industry, country)
   - Calculate days remaining, flag if <30 days
   - Mark completed if org has CSRD/ISSB report filed

3. API Routes:
   - GET /api/app/compliance/deadlines - List applicable
   - PUT /api/app/compliance/deadlines/[id]/status - Mark complete
   - GET /api/app/compliance/deadlines/upcoming - Next 90 days

4. UI:
   - /app/compliance/calendar - Monthly view with color-coded severity
   - Today's view: Sort by urgency (due soonest first)
   - Detail modal: Full regulation text + links
   - Checklist: Pre-requisite tasks per deadline

5. Seed Data: Import 30+ global deadlines (CSRD, ISSB, SBTi, taxonomies)

MUST NOT:
- Hardcode applicability (use rules engine)
- Show irrelevant deadlines to org
- Calculate days left on client (server-side only)

DONE WHEN:
- Calendar renders with applicable deadlines only
- Days remaining calculated + flagged if urgent
- Seed data loads cleanly
- Zero any in build

Files changed: +1 route, +1 page, enhanced collection, +30 seed records
Time: 4 hours
```

---

## Feature S6.3: Scheduled Report Delivery (6 hours)

```
You are implementing ClearESG feature S6.3: Scheduled Report Delivery.

Purpose: Auto-generate & email reports on schedule (daily, weekly, monthly)
Example: "Send CSRD report every Monday at 8am to finance@acme.com"

Mode: Complete ReportScheduler lib + UI

READ FIRST:
- src/lib/reports/reportScheduler.ts (exists but incomplete)
- src/collections/Reports.ts (report format)
- src/lib/email/send.ts (email service)
- src/app/(frontend)/api/cron/ (cron route patterns)

DO:
1. ReportScheduler Service (pure functions):
   - Schedule: daily|weekly|monthly, time, timezone
   - Recipients: array of emails
   - Format: PDF|CSV|JSON
   - Report to send: (reference to Reports collection)
   - Status: active|paused|completed

2. Collections:
   - Create ScheduledReports collection
   - Fields: organisationId, reportId, schedule, recipients[], format,
     nextRunAt, lastRunAt, lastStatus, retryCount

3. Cron Route:
   - GET /api/cron/reports/send-scheduled (triggered every 5 minutes)
   - Find reports where nextRunAt <= now
   - Generate report (reuse existing PDF/CSV logic)
   - Email to recipients
   - Update lastRunAt, calculate nextRunAt
   - On failure: retry up to 3x with exponential backoff

4. API Routes:
   - POST /api/app/reports/[id]/schedule - Create schedule
   - PUT /api/app/reports/[id]/schedule - Update
   - GET /api/app/reports/[id]/schedules - List
   - DELETE /api/app/reports/[id]/schedule/[scheduleId] - Remove

5. UI:
   - Report detail page: "Schedule deliveries" button
   - Modal: Select recipients, frequency, format, timezone
   - List view: All scheduled reports with next run time
   - Pause/resume toggle

6. Email Template:
   - Subject: "[ClearESG] CSRD Report - [Org Name] - [Date]"
   - Body: org name, report period, link to live report, attachment
   - Footer: "scheduled delivery" note

MUST NOT:
- Send duplicate emails (idempotent scheduling)
- Trust client timezone (store UTC only)
- Skip retry logic (transient failures)
- Allow unauthenticated schedule creation (ABAC check)

DONE WHEN:
- Schedule created via API + UI
- Cron fires, generates, emails successfully
- Retry logic tested (simulate email failure)
- Email lands in inbox (not spam)
- pnpm build clean

Files changed: +1 route (cron), +1 collection, +1 API, +1 UI page, email template
Time: 6 hours
```

---

## Feature S6.4: Compliance Checklist Export (4 hours)

```
You are implementing ClearESG feature S6.4: Compliance Checklist Export.

Purpose: Download compliance obligations as PDF/Excel with progress status

Mode: New export format for ComplianceObligations

READ FIRST:
- src/collections/ComplianceObligations.ts
- src/lib/reports/ReportPdfDocument.tsx (PDF generation pattern)
- src/app/(frontend)/api/app/compliance/ (routing)

DO:
1. Export Service (pure function):
   - Input: organisationId, period, format (PDF|Excel)
   - Output: File buffer with checklist
   - Include: obligation, status (pending|complete), due date, owner, notes

2. PDF Export:
   - Header: Org name, export date, period
   - Sections by category (CSRD, TCFD, SBTi, etc.)
   - Checklist format: ☐ Obligation | Status | Due | Owner
   - Progress summary: "15/42 items complete (36%)"
   - Footer: "Auto-generated by ClearESG"

3. Excel Export:
   - Columns: ID, Obligation, Category, Status, Due Date, Owner, Notes, Evidence Link
   - Auto-filter enabled
   - Freeze header row
   - Color-coded status (Red=Overdue, Yellow=Due Soon, Green=Complete)

4. API Route:
   - GET /api/app/compliance/obligations/export?format=pdf
   - GET /api/app/compliance/obligations/export?format=excel

5. UI:
   - Compliance page: "Export checklist" button
   - Opens download dialog
   - Includes org name in filename: "ACME_Compliance_2026-07.pdf"

MUST NOT:
- Leak other orgs' data (ABAC check)
- Hardcode status values (use enum from collection)
- Export unverified data (only confirmed obligations)

DONE WHEN:
- Export creates valid PDF + Excel files
- Files download without error
- PDF renders correctly (check with PDF viewer)
- Excel opens in Excel/Sheets (no corruption)
- pnpm build clean

Files changed: +1 export service, +1 route, +1 button in UI
Time: 4 hours
```

---

## Feature S6.5: Predictive Forecasting UI (12 hours)

```
You are implementing ClearESG feature S6.5: Predictive Forecasting UI & Calculation.

Purpose: Forecast future emissions based on historical trends
Example: "Based on 3-year trend, you'll emit 2,500 tCO2e in 2027 (vs. 2,350 now)"

Mode: Complete TrendForecasts collection + calculation + UI

READ FIRST:
- src/collections/TrendForecasts.ts (schema, exists)
- src/lib/analytics/ (analytics patterns)
- src/lib/scope3/calculator.ts (emissions math patterns)
- Recession/growth assumptions (external research or user input)

DO:
1. Forecasting Algorithm (pure function in src/lib/analytics/forecast.ts):
   - Input: emissions_by_period (last 3-5 years), org_assumptions (growth_rate, efficiency_improvement)
   - Method: Linear regression with trend adjustment
   - Account for: revenue growth, efficiency gains, known projects (e.g., "switching to renewables Q4 2026")
   - Scenarios: conservative (flat), baseline (3% growth), aggressive (10% growth)
   - Output: { year, emissions, confidence_interval, reasoning }

2. Calculation:
   - Calculate trend slope (% change year-over-year)
   - Apply org growth rate (from Organisations.expectedRevenueGrowth)
   - Apply efficiency factor (user-provided: -2% per year for efficiency projects)
   - Add known interventions (e.g., "renewable energy in Q4 2026 = -300 tCO2e")
   - Confidence: high if 3+ years data; low if <2 years

3. TrendForecasts Collection:
   - Fields: organisationId, period, forecastedEmissions, confidence, scenario, methodology
   - Store baseline/conservative/aggressive scenarios
   - lastCalculatedAt, assumptionsUsed (JSON)

4. API Route:
   - POST /api/app/analytics/forecasts/calculate
     Input: { organisationId, scenarioType, userAssumptions }
     Output: { baseline, conservative, aggressive }
   - GET /api/app/analytics/forecasts - List all forecasts for org

5. UI Components:
   - Forecast chart (line: historical + projected)
   - Scenario toggles: Show all 3 together
   - Assumptions panel: Growth rate, efficiency, interventions
   - Confidence badge: "High confidence (5 years data)"
   - Projection summary: "2027 forecast: 2,500 tCO2e (±200)"

6. Testing:
   - Unit test: 3-year trend → correct slope
   - Unit test: Apply growth rate → expected forecast
   - Unit test: Add intervention → reduced forecast
   - Integration: Real org data → forecast + chart render

MUST NOT:
- Hardcode growth rates (must be configurable)
- Show forecast without confidence interval
- Trust user-provided assumptions without validation (bounds check)
- Extrapolate >5 years without warning

DONE WHEN:
- Forecast calculates accurately (unit tests pass)
- Chart shows historical + projected with confidence shading
- User can adjust assumptions, forecast updates
- PDF export includes forecast
- pnpm build clean

Files changed: +1 calculation service, +1 route, +1 chart component, enhanced collection
Time: 12 hours
```

---

## Feature S6.6: Real-time Dashboards (WebSocket) (6 hours)

```
You are implementing ClearESG feature S6.6: Real-time Dashboard Updates.

Purpose: Live KPI updates using WebSocket (no refresh needed)

Mode: Add WebSocket layer to existing dashboard

READ FIRST:
- src/app/(frontend)/(app)/page.tsx (dashboard)
- src/lib/monitoring/metrics.ts (metrics collection)
- Next.js API routes WebSocket pattern

DO:
1. WebSocket Service (src/lib/realtime/websocket.ts):
   - Endpoint: /api/ws/dashboard
   - Subscribe: organisation, metrics (emissions, datapoints, reports)
   - Emit: { metric, value, change%, timestamp }
   - Client reconnect logic (exponential backoff)

2. Metrics Stream:
   - Trigger on datapoint create/update
   - Calculate new totals
   - Send delta to subscribed clients
   - Example: New datapoint: Scope1 +50 tCO2e → broadcast to all dashboards in org

3. API Changes:
   - Keep existing REST endpoints (fallback)
   - Add WebSocket for real-time
   - Datapoint POST: Also emit via WebSocket

4. UI Changes:
   - Dashboard components listen to WebSocket
   - Update KPI cards instantly (no F5 needed)
   - Show "Last updated: 2 seconds ago" with pulse indicator
   - Fallback to polling if WebSocket unavailable

5. Real-time Elements:
   - Total emissions card: Live update
   - Recent activity: New datapoints appear instantly
   - Benchmark: Update if peer data refreshes
   - Charts: Smooth animation on value change

6. Testing:
   - Create datapoint via API
   - Verify dashboard client receives update <500ms
   - Test reconnection (close socket → auto-reconnect)
   - Test multiple clients (broadcast to all)

MUST NOT:
- Send unauthenticated metrics (auth check on subscribe)
- Leak other orgs' data (filter by Membership)
- Broadcast sensitive fields (only public metrics)

DONE WHEN:
- WebSocket connection established
- Datapoint create → dashboard update <500ms
- Multiple clients sync (create in tab A, see in tab B)
- Manual refresh still works (fallback)
- pnpm build clean

Files changed: +1 WebSocket service, +1 route, +1 hook for React components, dashboard refactor
Time: 6 hours
```

---

# SPRINT 7: REVENUE DRIVERS PART 1 (40 hours, Week 3-4)

## Feature S7.1: Accounting Connectors (QuickBooks, Xero, Wave) (16 hours)

```
You are implementing ClearESG feature S7.1: Accounting Software Connectors.

Purpose: Pull spending data from accounting software → auto-calculate spend-based emissions

Connectors: QuickBooks Online, Xero, Wave (all OAuth, all free to integrate)

Mode: New integration service + collections

READ FIRST:
- src/lib/integrations/ (pattern from database connectors)
- src/collections/AccountingConnections.ts (schema exists, likely incomplete)
- src/app/(frontend)/api/app/integrations/accounting/ (routes exist)
- Accounting API docs: Xero, QuickBooks, Wave (public)

DO:
1. Accounting Connection Service:
   - QuickBooks: OAuth → token + realm_id (tenant)
   - Xero: OAuth → token (no tenant needed)
   - Wave: GraphQL API (OAuth only)
   - Secure storage: Encrypt tokens at rest

2. Collections:
   - AccountingConnections: { organisationId, provider, accessToken, refreshToken,
       expiresAt, companyName, lastSyncAt, syncStatus }
   - Enhance existing to store provider-specific fields (realm_id for QB)

3. Data Sync Service:
   - Fetch spending by category (e.g., "Travel", "Utilities", "Supplies")
   - Map accounting categories → emissions categories
   - Example: QB "Fuel" → Scope1, "Electricity" → Scope2, "Vendor Services" → Scope3
   - Store SpendEmissions records with source=accounting

4. API Routes:
   - POST /api/app/integrations/accounting/auth?provider=quickbooks
     → OAuth redirect URL
   - GET /api/app/integrations/accounting/auth/callback
     → Store token, start initial sync
   - POST /api/app/integrations/accounting/[id]/sync
     → Fetch latest spending, calculate emissions
   - DELETE /api/app/integrations/accounting/[id]
     → Revoke token

5. UI:
   - /app/integrations/accounting - Connection setup page
   - Provider buttons: "Connect QuickBooks", "Connect Xero", "Connect Wave"
   - After connect: Last sync time, next sync schedule, category mapping
   - Category mapping wizard: Map QB account → emissions category
   - Sync history + error log

6. Category Mapping:
   - Pre-set mappings for common accounts (Fuel→Scope1, Electricity→Scope2)
   - Allow custom mapping (user can override)
   - Fallback: Unmatched spending goes to "Other" category

7. Testing:
   - Mock OAuth flow (token exchange)
   - Mock accounting API responses
   - Test category mapping logic
   - Test token refresh (simulate expired token)
   - Integration: Connect → sync → emissions calculated

MUST NOT:
- Store plain-text tokens (encrypt at rest)
- Show other orgs' accounting data (strict Membership check)
- Sync without explicit permission (user initiates)
- Forget to refresh expired tokens (handle 401 responses)

DONE WHEN:
- OAuth flow completes for all 3 providers
- Spending fetched and stored
- Category mapping wizard works
- Emissions calculated from spending
- pnpm build clean, zero any

Files changed: +3 connector services, +2 API routes, +1 UI page, enhanced collection
Estimated time: 16 hours (4h per provider)
```

---

## Feature S7.2: SBTi Target Tracking (12 hours)

```
You are implementing ClearESG feature S7.2: Science-Based Targets Initiative (SBTi) Tracking.

Purpose: Track progress toward org's SBTi commitment (e.g., "50% reduction by 2030")

Mode: New collection + calculation + UI

READ FIRST:
- SBTi standards (public docs): https://sciencebasedtargets.org/
- Existing Scenarios collection (for "what if reach target" modeling)
- Existing Organisations collection (add SBTi fields)

DO:
1. SBTi Framework:
   - Target types: Absolute (50% reduction by 2030), Intensity (per revenue)
   - Scopes covered: 1, 2, 3 (user selects)
   - Base year: Reference year for calculation
   - Target year: When goal must be met
   - Baseline emissions: Starting point

2. Collection (SbtiTargets):
   - organisationId, targetType (absolute|intensity)
   - baselineYear, baselineEmissions
   - targetYear, targetEmissions (or reduction %)
   - scopesCovered (Scope1, Scope2, Scope3)
   - status (draft|submitted|validated|approved)
   - validationUrl (link to SBTi register if public)

3. Progress Calculation:
   - Current emissions vs. baseline
   - Reduction achieved so far (%)
   - Reduction needed by target year (annualized)
   - Years remaining
   - On-track? (Green if >50% progress, Yellow if 25-50%, Red if <25%)

4. API Routes:
   - POST /api/app/compliance/sbti - Create target
   - GET /api/app/compliance/sbti/[id] - Get target + progress
   - PUT /api/app/compliance/sbti/[id] - Update
   - GET /api/app/compliance/sbti/progress - Progress dashboard

5. UI:
   - /app/compliance/sbti-tracking - Main page
   - Setup wizard: Target type → base year → target year → scopes
   - Progress dashboard:
     * Gauge showing % progress (baseline → target)
     * Timeline: Years remaining, annual reduction rate needed
     * Comparison: Current trajectory vs. SBTi requirement
     * Scenarios: "If we do X, will we hit target?"
   - Link to SBTi registry (search org name)

6. Integration with Scenarios:
   - "What if we reduce Scope1 by 30%?" → Recalculate SBTi progress
   - Show trajectory if scenario achieved

7. Testing:
   - Unit test: Calculate reduction % correctly
   - Unit test: Determine on-track status
   - Integration: Set target → show progress

MUST NOT:
- Hardcode baseline year (user selects)
- Show target without progress (always show both)
- Allow unvalidated targets (user must mark as draft/submitted)

DONE WHEN:
- Target created via wizard
- Progress calculated correctly
- Dashboard shows on-track status + timeline
- Scenario integration works (recalculate on scenario change)
- pnpm build clean

Files changed: +1 collection, +2 routes, +1 page, +1 calculation service
Time: 12 hours
```

---

## Feature S7.3: Decarbonization Pathways (12 hours)

```
You are implementing ClearESG feature S7.3: Decarbonization Pathways.

Purpose: Visual roadmap to net-zero, showing milestones and interventions

Example: "2026: Switch to renewable energy (-300 tCO2e/year)
         → 2027: Supplier efficiency (-150/year)
         → 2030: Net-zero"

Mode: Complete DecarbonizationPathways collection + visualization

READ FIRST:
- src/collections/DecarbonizationPathways.ts
- Existing Scenarios (pathways are built from scenarios)
- Chart patterns (line charts with milestones)

DO:
1. Pathway Model:
   - Collection: DecarbonizationPathways
   - Fields: organisationId, name (e.g., "Path to Net-Zero"),
     startYear, targetYear, targetEmissions (0 for net-zero)
   - Milestones: array of { year, action, emissionsSaved, cost, status }
   - Status: planned|in-progress|completed|missed

2. Milestone Definition:
   - Scope1: "Switch to electric fleet" → -500 tCO2e
   - Scope2: "Renewable energy transition" → -200 tCO2e
   - Scope3: "Supplier engagement program" → -100 tCO2e
   - Calculate cumulative: Q1 + Q2 + Q3 = total by year

3. Pathway Calculator (pure function):
   - Input: baseline, target year, target emissions, scenarios
   - Algorithm: Work backward from target → required reductions → needed interventions
   - Distribute reductions across years (even pace or custom)
   - Suggest interventions (from scenario templates)
   - Output: { milestones, feasibility, timeline, costEstimate }

4. API Routes:
   - POST /api/app/analytics/pathways - Create pathway
   - GET /api/app/analytics/pathways/[id] - Get pathway + progress
   - PUT /api/app/analytics/pathways/[id]/milestones - Update milestones
   - GET /api/app/analytics/pathways/feasibility - Calculate feasibility

5. UI Components:
   - Pathway builder wizard: Select target year + interventions
   - Timeline chart: Years (X) vs. emissions (Y), showing pathway trajectory
   - Milestones list: Action → emission savings → cost → status
   - Feasibility indicator:
     * Green: Path is achievable
     * Yellow: Requires aggressive action
     * Red: Unrealistic with current trajectory
   - Comparison: Actual progress vs. pathway (are we on track?)

6. Feasibility Calculation:
   - Required annual reduction = (baseline - target) / years
   - Compare to similar orgs' achievements
   - Flag if >15% annual reduction needed (very aggressive)

7. Testing:
   - Unit test: Calculate required annual reduction correctly
   - Unit test: Distribute milestones evenly
   - Integration: Pathway → chart renders correctly

MUST NOT:
- Allow target emissions > baseline (validation)
- Show unrealistic pathways without warning
- Hardcode intervention types (must be configurable)

DONE WHEN:
- Pathway created via wizard
- Timeline chart shows baseline + pathway + milestones
- Feasibility calculated + displayed
- Comparison to actual progress shown
- pnpm build clean

Files changed: +1 collection (complete), +2 routes, +1 page, +1 calculation service
Time: 12 hours
```

---

# SPRINT 8: REVENUE DRIVERS PART 2 (28 hours, Week 5-6)

## Feature S8.1: Supply Chain Mapping (12 hours)

```
You are implementing ClearESG feature S8.1: Supply Chain Mapping.

Purpose: Visualize supplier network (Tier 1, 2, 3) with emissions breakdown

Mode: Complete SupplyChainNetworks collection + graph visualization

READ FIRST:
- src/collections/SupplyChainNetworks.ts (schema exists)
- Existing Suppliers collection (links to suppliers)
- Graph visualization library (D3.js or Vis.js, pick one)

DO:
1. Supply Chain Model:
   - SupplyChainNetworks: { organisationId, name, suppliers: [{ id, tier, emissions, location }] }
   - Supplier tier assignment:
     * Tier 1: Direct suppliers (ClearESG knows about)
     * Tier 2: Suppliers' suppliers (estimated based on spend or survey)
     * Tier 3: Raw material suppliers (estimated)

2. Network Visualization:
   - Center: Your org (logo + total emissions)
   - Ring 1: Tier 1 suppliers (labeled, sized by emissions)
   - Ring 2: Tier 2 suppliers (grayed out, smaller)
   - Ring 3: Tier 3 suppliers (very small, grayed)
   - Lines: Connection strength = spend % or emissions share
   - Colors: By Scope (Scope1=red, Scope2=blue, Scope3=green)

3. API Routes:
   - POST /api/app/suppliers/supply-chain - Create network
   - GET /api/app/suppliers/supply-chain/[id] - Get network + visualize
   - PUT /api/app/suppliers/supply-chain/[id]/tiers - Update tier assignments
   - GET /api/app/suppliers/supply-chain/[id]/export - Export as CSV

4. UI:
   - /app/suppliers/supply-chain-map - Main page
   - Interactive graph (click supplier → detail modal)
   - Filter: Show only Tier 1, or all tiers
   - Toggle: By emissions or by spend
   - Drill-down: Click supplier → see their Tier 1 suppliers (if available)
   - Legend: Color = Scope, Size = Emissions

5. Data Population:
   - Tier 1: Pulled from Suppliers collection (auto-populated)
   - Tier 2/3: Estimated or from supplier surveys (optional, defaults to estimate)
   - Location-based estimation: If supplier location known, add country-level assumptions

6. Testing:
   - Graph renders with test data (3 tiers)
   - Click supplier → modal shows details
   - Filter works (show/hide tiers)

MUST NOT:
- Show supplier data without Membership check
- Hardcode tier levels (must be configurable)
- Crash if Tier 2/3 data missing (show estimate)

DONE WHEN:
- Graph renders with supplier network
- Interactive: Click supplier → detail modal
- Filter + toggle work
- Export to CSV works
- pnpm build clean

Files changed: +1 page, +1 visualization component, +2 routes, enhanced collection
Time: 12 hours
```

---

## Feature S8.2: ISO 14064 Certification Checklist (8 hours)

```
You are implementing ClearESG feature S8.2: ISO 14064 Compliance Checklist.

Purpose: Track ISO 14064 (GHG Measurement & Reporting) compliance steps

Mode: New collection + checklist UI

READ FIRST:
- ISO 14064 standards (public docs): 14064-1 (Specification), 14064-2 (Quantification)
- Existing ComplianceObligations, AuditLogs collections
- Existing evidence linking pattern (Evidence collection)

DO:
1. ISO 14064 Sections:
   - Part 1: Design, quantification, reporting of org-level GHG
   - Part 2: Project-level GHG quantification + verification
   - Requirements (simplified): Org boundary → data collection → calculation → reporting

2. Collection (ISO14064Compliance):
   - organisationId, status (not_started|in_progress|completed)
   - sections: array of { section_number, requirement, status, evidence_id, notes }
   - verifier_assigned (link to User for 3rd-party auditor)
   - lastReviewDate, nextReviewDate

3. Pre-built Checklist (30 items):
   - Define org boundary (Scope 1, 2, 3)
   - Identify emission sources
   - Establish quantification methods
   - Set base year + reference year
   - Collect activity data
   - Apply emission factors
   - Calculate total emissions
   - Manage uncertainty
   - Document assumptions
   - Establish internal audit procedures
   - Prepare report
   - Request third-party verification
   - (etc.)

4. API Routes:
   - POST /api/app/compliance/iso-14064 - Create checklist
   - GET /api/app/compliance/iso-14064/[id] - Get checklist
   - PUT /api/app/compliance/iso-14064/[id]/items/[item_id] - Mark complete + attach evidence
   - GET /api/app/compliance/iso-14064/[id]/progress - Progress (% complete)

5. UI:
   - /app/compliance/iso-14064 - Main checklist page
   - Sections: Part 1, Part 2 (collapsible)
   - Checklist items: ☐ Requirement | Evidence | Status | Notes
   - Evidence column: Link to uploaded files, CSRD report, audit logs
   - Progress bar: "18/30 items complete (60%)"
   - Assign verifier button: Select auditor + send notice

6. Evidence Linking:
   - Each checklist item can reference Evidence (uploaded docs, reports, audit logs)
   - Auto-populate: Link to CSRD report for "Reporting" requirement
   - Link to datapoints for "Collect activity data"

7. Testing:
   - Checklist created with all 30 items
   - Mark item complete + attach evidence
   - Progress updates correctly

MUST NOT:
- Hardcode ISO requirements (use database seed)
- Allow completion without evidence (require at least one link)
- Show other orgs' checklists

DONE WHEN:
- Checklist created with 30 pre-built items
- Mark items complete + link evidence
- Progress bar accurate
- Verifier assignment works
- pnpm build clean

Files changed: +1 collection, +2 routes, +1 page, +1 seed file (30 items)
Time: 8 hours
```

---

## Feature S8.3: Supplier Engagement Workflows (6 hours)

```
You are implementing ClearESG feature S8.3: Supplier Engagement Workflows.

Purpose: Track supplier onboarding + ESG questionnaire responses

Mode: Complete SupplierQuestionnaire collection + workflow UI

READ FIRST:
- src/collections/SupplierQuestionnaire.ts (schema exists)
- Existing Suppliers collection
- Existing EmailDataCollectionForms (pattern)

DO:
1. Engagement Workflow States:
   - Invited: Sent questionnaire link (email)
   - In Progress: Supplier started filling form
   - Submitted: Supplier completed form
   - Reviewed: ClearESG team reviewed responses
   - Approved: Responses verified
   - Archived: Old/inactive

2. Questionnaire Form:
   - Pre-built sections:
     * Company info (revenue, employees, locations)
     * Emissions data (Scope 1, 2, 3)
     * Supply chain (their suppliers)
     * Certifications (ISO, B-Corp, etc.)
     * Sustainability goals
   - Custom sections: Org can add questions
   - Reminder emails: Auto-send after 7, 14 days if not started
   - Public link: Share with supplier (no login needed)

3. Collection Enhancement:
   - SupplierQuestionnaire: { supplierId, status, sentAt, startedAt, submittedAt,
       responses: { field: value }, notes }

4. API Routes:
   - POST /api/app/suppliers/[id]/questionnaire/send - Send invite email
   - GET /api/app/suppliers/questionnaire/[id] - Public form (no auth)
   - POST /api/app/suppliers/questionnaire/[id]/submit - Submit responses
   - PUT /api/app/suppliers/[id]/questionnaire/review - Mark reviewed + notes

5. UI:
   - Supplier detail page: "Send ESG questionnaire" button
   - Questionnaire detail: View responses, add review notes, approve
   - Supplier list: Status column shows (Invited, In Progress, Submitted, Reviewed)
   - Reminder tracking: "Last reminder sent 3 days ago"
   - Progress: "23/40 suppliers completed"

6. Reminders (Async):
   - Cron: /api/cron/suppliers/send-engagement-reminders
   - Find questionnaires sent 7+ days ago, not started → send reminder

7. Testing:
   - Send questionnaire → email received
   - Fill form → responses stored
   - Review form + add notes
   - Reminder sent if no response

MUST NOT:
- Send emails without supplier consent (verify email before sending)
- Show other orgs' supplier data
- Allow unauthenticated data deletion (only view for public link)

DONE WHEN:
- Questionnaire sent via email
- Supplier fills form (no login)
- Responses stored + viewable by org
- Review notes tracked
- Reminders sent after 7/14 days
- pnpm build clean

Files changed: +1 API route (send), +1 public route, +1 cron, enhanced collection, +1 page
Time: 6 hours
```

---

# SPRINT 9: ENTERPRISE & DIFFERENTIATION (64 hours, Week 7-10)

## Feature S9.1: Green Taxonomy Compliance (16 hours)

```
You are implementing ClearESG feature S9.1: Green Taxonomy Compliance.

Purpose: Assess if company's activities align with EU Green Taxonomy (6 environmental objectives)

Mode: New collection + questionnaire + assessment UI

READ FIRST:
- EU Green Taxonomy (public docs): https://ec.europa.eu/finance/green-taxonomy
- 6 environmental objectives: Climate mitigation, adaptation, water, circular economy, pollution, biodiversity
- NACE codes (economic activity classification)

DO:
1. Taxonomy Framework:
   - 6 objectives: Climate Mitigation, Climate Adaptation, Water, Circular Economy, Pollution, Biodiversity
   - Each objective has technical screening criteria (yes/no checklist)
   - "Do No Significant Harm" (DNSH) criteria also required

2. Collection (GreenTaxonomyAssessments):
   - organisationId, period, status (draft|completed|verified)
   - naceCode (org's primary economic activity)
   - objectives: array of { objective, applicable (yes/no), criteriasMet (%), evidence_id }
   - dnshCompliance: array of { objective, criteria, compliant (yes/no), notes }

3. Assessment Questionnaire:
   - Step 1: Select primary NACE code (economic activity)
   - Step 2: For each objective, answer if "applicable to your business"
   - Step 3: If applicable, answer technical screening criteria (~20 per objective)
   - Example (Climate Mitigation):
     * "Does your company measure GHG emissions?" (Yes/No)
     * "Do you have decarbonization targets?" (Yes/No)
     * etc.
   - Step 4: Link evidence (reports, commitments, certifications)

4. Calculation:
   - Eligibility: Which objectives are applicable (based on NACE + answers)
   - Alignment: % of criteria met per objective (0-100%)
   - Overall: % of company's activities that are taxonomy-aligned

5. API Routes:
   - POST /api/app/compliance/green-taxonomy - Start assessment
   - GET /api/app/compliance/green-taxonomy/[id] - Get assessment
   - POST /api/app/compliance/green-taxonomy/[id]/answers - Save answers
   - GET /api/app/compliance/green-taxonomy/[id]/report - Aligned activities %

6. UI:
   - /app/compliance/green-taxonomy - Assessment wizard
   - Step 1: Select NACE code (dropdown + search)
   - Step 2-7: Questions for each objective (collapsible)
   - Progress bar: "Step 3 of 7"
   - Results page:
     * Alignment % by objective (6 bars)
     * Detailed breakdown: Criteria met / total
     * Gap analysis: "You're missing 3 criteria for Climate Mitigation alignment"
   - Comparison: EU average for your NACE code

7. Reporting:
   - Export assessment as PDF
   - Use in sustainability report (link in CSRD/TCFD reports)
   - Track changes over time (reassess annually)

8. Testing:
   - Unit test: Calculate alignment % correctly
   - Integration: Select NACE → show applicable objectives
   - Integration: Answer criteria → update alignment

MUST NOT:
- Allow non-applicable objectives to affect overall %
- Hardcode NACE codes (use official EU taxonomy database)
- Show other orgs' assessments

DONE WHEN:
- Assessment wizard completes
- Alignment % calculated accurately
- Report shows results + gaps
- PDF export works
- pnpm build clean

Files changed: +1 collection, +2 routes, +1 page, +1 calculation service
Time: 16 hours
```

---

## Feature S9.2: Tier 2/3 Supplier Emissions (20 hours)

```
You are implementing ClearESG feature S9.2: Tier 2/3 Supplier Emissions Tracking.

Purpose: Estimate emissions from suppliers' suppliers (indirect Scope 3)

Example: "Supplier A buys from Supplier B, who emits 100 tCO2e →
          50 tCO2e attributable to your purchase from Supplier A"

Mode: Recursive calculation + scope estimator

READ FIRST:
- Existing Suppliers collection
- Existing Scope3Activities (Scope 3 Category 1: Purchased goods/services)
- Existing SupplyChainNetworks (network structure)

DO:
1. Tier 2/3 Estimation Method (Hybrid):
   - Option A: Bottom-up (if Tier 2 has data) → Use actual emissions
   - Option B: Estimator (if no data) → Estimate based on spend % + industry average
   - Formula: Tier 2 emissions = (Spend on Tier 2) × (Industry avg intensity per $) × (allocation %)

2. Data Model:
   - Extend Suppliers collection:
     * tier (1|2|3)
     * directSpend (amount spent by you on this supplier)
     * estimatedEmissions (if no actual data)
     * estimationMethod (actual|industry_avg|top_down)
   - Scope3Activities can reference supplier + tier

3. Calculation Service (pure function):
   - Input: supplier (tier 1) + suppliers of that supplier (tier 2) + spend data
   - For each Tier 2 supplier:
     * If has data: use actual emissions
     * If no data: estimate based on industry + spend
   - Allocate to Tier 1 supplier based on Tier 1's spend on Tier 2
   - Recursively: Tier 3 = Tier 2's supplier's supplier
   - Output: Scope 3 Category 1 emissions (Tier 1 + Tier 2 + Tier 3)

4. API Routes:
   - POST /api/app/suppliers/[id]/tier-2-estimate - Trigger calculation
   - GET /api/app/suppliers/[id]/tier-2-emissions - Get estimated Tier 2/3 emissions
   - POST /api/app/suppliers/[id]/tier-2-survey - Send survey to Tier 2 supplier
   - GET /api/app/scope3/category-1-breakdown - Show Tier 1 + Tier 2 + Tier 3 split

5. UI:
   - Supplier detail page: "Estimate Tier 2 emissions" button
   - Results: Breakdown chart
     * Tier 1 supplier's direct emissions (known)
     * Tier 1 supplier's estimate from Tier 2
     * Total Tier 1 (direct + indirect)
   - Comparison: Actual vs. estimated (build confidence in estimate)
   - Supply chain map: Show Tier 2 nodes with estimated emissions

6. Scope 3 Integration:
   - Category 1 (Purchased goods) = sum of all Tier 1 direct + Tier 2 + Tier 3
   - Show breakdown by tier
   - Link to supplier (click emission → see supplier detail)

7. Industry Baseline Data:
   - Seed emission intensity by NACE code (e.g., "Manufacturing: 2.5 tCO2e per $M spend")
   - User can override per supplier
   - Track confidence: High if actual, Low if industry average used

8. Testing:
   - Unit test: Calculate Tier 2 emissions correctly (spend × intensity)
   - Integration: Supplier → Tier 2 → emissions updated in Scope3
   - Mock industry data + test calculation

MUST NOT:
- Double-count emissions (Tier 2 emissions don't appear twice)
- Show without confidence indicator (always mark estimate vs. actual)
- Assume NACE code (ask supplier for industry)

DONE WHEN:
- Tier 2 emissions estimated for supplier with known spend
- Scope 3 Category 1 total includes Tier 2
- Breakdown by tier shows in supply chain map
- Unit tests pass
- pnpm build clean

Files changed: +1 calculation service, +2 routes, +1 enhanced Scope3 view
Time: 20 hours
```

---

## Feature S9.3: Multi-Org Consolidated Reports (12 hours)

```
You are implementing ClearESG feature S9.3: Multi-Org Consolidated Reporting.

Purpose: Report emissions across subsidiaries/branches as single view

Example: "Parent Company ACME:
  - HQ (USA): 500 tCO2e
  - UK Branch: 200 tCO2e
  - France Branch: 150 tCO2e
  - Total: 850 tCO2e"

Mode: Org hierarchy + consolidation logic

READ FIRST:
- Existing Organisations collection (add parent_org field)
- Existing Reports collection
- Existing Scope3Activities (aggregation pattern)

DO:
1. Org Hierarchy Model:
   - Add to Organisations: { parent_organisation_id, consolidation_method (full|proportional|equity) }
   - full: Include 100% of subsidiary emissions
   - proportional: Include ownership % (e.g., 70% of subsidiary)
   - equity: Include based on financial consolidation

2. Consolidation Logic (pure function):
   - Input: parent org, period
   - Find all children (direct + recursive)
   - Aggregate by scope (Scope1, 2, 3) + category
   - Apply consolidation method (multiply by ownership %)
   - Output: { total, by_scope, by_org, by_category, unconsolidated_child_list }

3. API Routes:
   - GET /api/app/reports/consolidated?period=2026 - Get consolidated report
   - PUT /api/app/organisations/[id]/hierarchy - Set parent + ownership %
   - GET /api/app/organisations/hierarchy - View full hierarchy tree

4. UI:
   - Org switcher: Show hierarchy (parent with child orgs indented)
   - Report page: Toggle "Include subsidiaries" checkbox
   - If checked: Show consolidated totals + breakdown by subsidiary
   - Tree view: Parent org structure (HQ + branches + ownership %)
   - CSV export: Include subsidiary breakdowns

5. Hierarchy Management:
   - /app/settings/org-hierarchy - Set parent org + consolidation method
   - Ownership % input: "We own 70% of UK branch"
   - Preview: Shows how consolidation affects totals

6. Validation:
   - Prevent circular hierarchies (A → B → A)
   - Warn if subsidiaries don't have data (can't consolidate)
   - Show consolidation method in report footer

7. Testing:
   - Create 3-level hierarchy: Parent → Child1, Child2 → Grandchild
   - Consolidate with different ownership %
   - Verify math (100% + 70% + 50% = correct total)

MUST NOT:
- Allow circular references (detect + reject)
- Consolidate without explicit permission (user must set parent)
- Show subsidiary data without Membership (access control)

DONE WHEN:
- Org hierarchy tree displays correctly
- Consolidated report calculated with correct ownership %
- CSV export shows breakdown by org
- Circular reference prevented
- pnpm build clean

Files changed: +2 routes, +1 calculation service, +1 enhanced Organisations field, +1 UI page
Time: 12 hours
```

---

# SPRINT 10: POLISH & EMBEDS (28 hours, Week 11-12)

## Feature S10.1: Interactive HTML Reports (16 hours)

```
You are implementing ClearESG feature S10.1: Interactive HTML Reports (Embeddable).

Purpose: Generate clickable, filterable HTML reports (alternative to PDF)

Mode: New report format

READ FIRST:
- Existing ReportPdfDocument.tsx (PDF generation pattern)
- Existing Reports collection
- HTML5 charting library (Recharts, already in project)

DO:
1. HTML Report Features:
   - Responsive design (mobile-friendly)
   - Expandable sections (click to show/hide details)
   - Sortable tables (click header to sort)
   - Filterable charts (click legend to toggle series)
   - Embeddable (iFrame with shared link)
   - Print-friendly (CSS print styles)

2. HTML Report Structure:
   - Header: Org name, period, generated date
   - Executive summary: Key metrics, highlights
   - Emissions breakdown: Interactive charts (click legend items to filter)
   - Detailed tables: Filterable, sortable
   - Methodology: Assumptions, data sources
   - Footer: Terms, attribution

3. API Routes:
   - GET /api/app/reports/[id]/html - Stream HTML report
   - GET /api/app/reports/[id]/html/embedded - Embeddable iFrame URL
   - GET /api/app/reports/[id]/share-link - Generate shareable link (temp token)

4. UI Components:
   - Report export options: PDF | HTML | Embed
   - HTML option: Generate + preview in modal
   - Share button: Copy embed code or link
   - Embed code example: `<iframe src="..."></iframe>`

5. Interactivity:
   - Chart legends: Click to show/hide series
   - Tables: Click column header to sort
   - Expandable rows: Click → show details (Scope 1 details within Scope breakdown)
   - Filters: "Show only Scope 2" dropdown

6. Styling:
   - Use design tokens (colors, fonts from BrandVars)
   - Print styles: No background colors (save ink), expand all sections
   - Mobile: Stack sections vertically, responsive tables

7. Embed Security:
   - Temp token (expires in 7 days)
   - Token linked to org (can't view other orgs)
   - Embed limited to read-only (no data modification)
   - Log embed access (audit trail)

8. Testing:
   - Generate HTML report
   - Verify charts interactive (click legend works)
   - Test iFrame embed (works across domains)
   - Print: Verify formatting (no broken layouts)

MUST NOT:
- Allow unauthenticated data access (embed token must be valid)
- Break responsive design (test mobile)
- Include sensitive metadata (server timestamp only)

DONE WHEN:
- HTML report generates
- Charts interactive (click legend, filters work)
- Embed code works in iFrame
- Print-friendly CSS applies
- pnpm build clean

Files changed: +1 HTML template service, +1 API route, +1 share link route, +1 page
Time: 16 hours
```

---

## Feature S10.2: IoT Gateway Management (8 hours)

```
You are implementing ClearESG feature S10.2: IoT Gateway Management.

Purpose: Multi-gateway orchestration (connect multiple IoT hubs/gateways)

Mode: Enhancement to existing IoT system

READ FIRST:
- Existing IoTDevices collection
- Existing IoTDataStreams collection
- IoT ingest routes

DO:
1. Gateway Model:
   - New collection: IoTGateways { organisationId, name, type (mqtt|http|webhook),
       endpoint, credentials, status (online|offline), lastHeartbeat }
   - Each device links to gateway: Devices.gateway_id

2. Multi-Gateway Support:
   - Register multiple gateways per org (e.g., "Office MQTT", "Factory MQTT", "Cloud API")
   - Each gateway syncs independently
   - Devices tagged by gateway (know which gateway they came from)
   - Failover: If gateway1 offline, try gateway2 for same device type

3. Gateway Types:
   - MQTT Broker: ClearESG subscribes to topics
   - HTTP Webhook: Devices push to gateway, gateway pushes to ClearESG
   - Direct API: Device pushes directly to ClearESG (no gateway)
   - Cloud Platform: Connect AWS IoT, Azure IoT Hub, Google Cloud IoT (free tier only)

4. API Routes:
   - POST /api/app/iot/gateways - Register gateway
   - PUT /api/app/iot/gateways/[id] - Update (endpoint, credentials)
   - DELETE /api/app/iot/gateways/[id] - Remove gateway
   - GET /api/app/iot/gateways/[id]/status - Check health

5. Health Monitoring:
   - Heartbeat: Gateway sends "I'm alive" signal every 5 min
   - Last data received timestamp
   - Status badge: Online (green), Offline (red), Stale (yellow if >1h no data)
   - Alert: Notify if gateway offline >30 min

6. UI:
   - /app/integrations/iot/gateways - List all gateways
   - Register gateway: Modal with type selector + endpoint/credential input
   - Gateway card: Name, type, status, last sync, # devices connected
   - Click gateway → show devices connected

7. Device Assignment:
   - /app/integrations/iot/devices - Assign device to gateway
   - Bulk assignment: Import CSV with (device_id, gateway_id)

8. Testing:
   - Register 2 gateways
   - Send data via gateway 1 → received
   - Send via gateway 2 → received
   - Mark gateway 1 offline → devices fall back to gateway 2

MUST NOT:
- Store plain credentials (encrypt all)
- Show other orgs' gateways
- Fail silently if gateway offline (alert user)

DONE WHEN:
- Multiple gateways registered
- Devices receive data from correct gateway
- Health status monitored + alerts sent
- pnpm build clean

Files changed: +1 collection, +2 routes, +1 page enhancement
Time: 8 hours
```

---

## Feature S10.3: Embed Reports in Websites (8 hours)

```
You are implementing ClearESG feature S10.3: Report Embedding (iFrame Share).

Purpose: Embed live ClearESG reports on customer's website

Example: "ACME's sustainability report embedded on acme.com/impact"

Mode: Iframe endpoint + shared token + auth

READ FIRST:
- Existing Reports collection
- S10.1: Interactive HTML Reports (builds on this)
- Existing share-link logic

DO:
1. Embedding Flow:
   - Org generates embed code: `<iframe src="..." width="100%" height="600"></iframe>`
   - Code includes temp token (7-day expiry)
   - Embedded page works without login (token auth)
   - Reports auto-update (if live report, see fresh data)

2. Collection (ReportEmbedTokens):
   - Fields: reportId, organisationId, token (random UUID),
     expiresAt, createdAt, usageCount, lastAccessedAt

3. API Routes:
   - POST /api/app/reports/[id]/embed-token - Generate embed token
   - GET /public/reports/embed/[token] - Render embedded report (no auth needed)
   - DELETE /api/app/reports/[id]/embed-token/[token] - Revoke token

4. Security:
   - Token is random UUID (cryptographically secure)
   - Token expires after 7 days (configurable)
   - Token is single-use for rate-limiting (log access)
   - Embedded report is read-only (no modifications allowed)
   - Cross-origin: Allow embedding from any domain

5. Embedded Report Style:
   - Minimal header (just org name + report date)
   - Full interactive charts from S10.1
   - No sidebar, no edit buttons
   - Print-friendly
   - Responsive (mobile-friendly)

6. UI:
   - Report page: "Share report" button
   - Modal: 2 tabs:
     * "Public link": Copy link + QR code
     * "Embed code": Copy iFrame code, set expiry
   - Token management: List active tokens, revoke individual tokens

7. CORS Handling:
   - Embedded report accessible from any domain
   - CSP headers allow iFrame embedding
   - Test: Embed on external website

8. Testing:
   - Generate embed token
   - Copy iFrame code
   - Paste into external HTML file
   - Open in browser → report displays correctly
   - Click legend → filters work
   - Wait 7+ days → token expires, report shows "Link expired"

MUST NOT:
- Allow embedded report to modify data (read-only)
- Leak org ID in token (use opaque token)
- Allow unlimited token generation (rate limit)

DONE WHEN:
- Embed token generated
- iFrame renders report correctly
- Interactivity works in iFrame
- Token expires after 7 days
- pnpm build clean

Files changed: +1 collection, +1 public route, +1 API route, +1 UI modal
Time: 8 hours
```

---

## Feature S10.4: JSON/XML Export (4 hours)

```
You are implementing ClearESG feature S10.4: JSON/XML Export Formats.

Purpose: Export reports in machine-readable formats (alternative to PDF/CSV)

Mode: New export formats

READ FIRST:
- Existing Reports collection
- Existing report export routes (PDF, CSV)
- src/app/(frontend)/api/app/export

DO:
1. JSON Format:
   - Structure: { report: { metadata, emissions: { scope1, scope2, scope3 }, breakdown: {...} } }
   - Includes: All data points, methodology, uncertainties
   - Array of datapoints: { id, value, unit, category, quality, timestamp }

2. XML Format:
   - Root: <report>
   - Sections: <metadata>, <emissions>, <breakdown>, <datapoints>
   - Attributes: date, org_id, version
   - Namespaced: <esg:emissions>, <esg:scope1>

3. API Routes:
   - GET /api/app/reports/[id]/export?format=json
   - GET /api/app/reports/[id]/export?format=xml

4. Use Cases:
   - JSON: Import into BI tools, APIs, databases
   - XML: Integration with legacy systems, EDI

5. Testing:
   - Generate JSON → parse in jq/Python
   - Generate XML → validate schema
   - Compare to PDF export (same numbers)

MUST NOT:
- Include unverified data (only confirmed datapoints)
- Hardcode field names (use schema definitions)

DONE WHEN:
- JSON export valid, parseable
- XML export valid, well-formed
- Numbers match PDF export
- pnpm build clean

Files changed: +1 export route
Time: 4 hours
```

---

## Feature S10.5: API Report Delivery (4 hours)

```
You are implementing ClearESG feature S10.5: API Report Delivery (Webhooks).

Purpose: Send reports to external APIs (via webhook)

Example: "Post CSRD report to https://customer-api.example.com/esg/report"

Mode: New webhook trigger

READ FIRST:
- Existing webhooks infrastructure (src/lib/webhooks)
- Existing WebhookRegistrations collection

DO:
1. Report Delivery Webhook:
   - Register webhook: POST /api/app/webhooks with event=report.generated
   - On report finalize: Emit webhook with report data (JSON)
   - Payload: { event: "report.generated", report_id, org_id, format, data }

2. Configuration:
   - Webhook URL
   - Headers (custom headers for auth, e.g., "Authorization: Bearer token")
   - Retry policy: 3 retries, exponential backoff
   - Delivery log (track success/failure)

3. API Routes:
   - POST /api/app/reports/[id]/deliver - Manually trigger delivery
   - GET /api/app/reports/[id]/deliveries - View delivery history

4. Testing:
   - Create webhook
   - Generate report → webhook fires automatically
   - Simulate delivery failure → retries work

MUST NOT:
- Send unverified reports (check status)
- Leak auth headers in logs (mask tokens)

DONE WHEN:
- Report generated → webhook fires
- Delivery logged (success/failure)
- Retry works on failure
- pnpm build clean

Files changed: +1 route, enhanced webhooks
Time: 4 hours
```

---

## Feature S10.6: Multi-Framework Consolidated Reports (4 hours)

```
You are implementing ClearESG feature S10.6: Multi-Framework Report.

Purpose: Single report combining CSRD + TCFD + ISSB + GRI sections

Mode: New report type

READ FIRST:
- Existing CSRD, TCFD, ISSB collection patterns
- Existing report generation service

DO:
1. Unified Report:
   - CSRD section: Emissions + targets
   - TCFD section: Climate risk + scenario analysis
   - ISSB section: Sustainability metrics
   - GRI section: Material topics (if available)
   - Single executive summary covering all frameworks

2. API Route:
   - GET /api/app/reports/multi-framework/[period]
   - Combines data from CSRD + TCFD + ISSB assessments

3. PDF Output:
   - ~30 pages (combined)
   - Frameworks color-coded by section
   - Cross-references (e.g., "See CSRD Section 2 for emissions details")

MUST NOT:
- Duplicate data between frameworks
- Show incomplete frameworks (skip if not done)

DONE WHEN:
- Report generated with all 4 frameworks
- PDF renders correctly
- pnpm build clean

Files changed: +1 report template, +1 route
Time: 4 hours
```

---

# SUMMARY TABLE

| Sprint                       | Features        | Total Hours   | Timeline     |
| ---------------------------- | --------------- | ------------- | ------------ |
| **S6: Quick Wins**           | 6 features      | 36h           | Week 1-2     |
| **S7: Revenue Drivers Pt 1** | 3 features      | 40h           | Week 3-4     |
| **S8: Revenue Drivers Pt 2** | 3 features      | 28h           | Week 5-6     |
| **S9: Enterprise**           | 3 features      | 64h           | Week 7-10    |
| **S10: Polish**              | 6 features      | 28h           | Week 11-12   |
| **TOTAL**                    | **31 features** | **282 hours** | **~7 weeks** |

---

# QUALITY GATES (Every Sprint)

- ✅ `pnpm build clean` (zero errors, zero any)
- ✅ `pnpm test` (all tests pass)
- ✅ Zero hardcoded values (use database/config)
- ✅ ABAC enforcement on all mutations
- ✅ Design tokens only (no hex in components)
- ✅ Test coverage for calc functions
- ✅ No `prefers-color-scheme` overrides
- ✅ Email/sensitive data never logged

---

# KICKOFF TEMPLATE (Copy for each feature)

```
You are implementing ClearESG feature S[SPRINT].[NUM]: [Name].

Source: docs/SPRINT_6_10_IMPLEMENTATION_PROMPTS.md § Feature S[SPRINT].[NUM]

Mode: [GAP-FILL|COMPLETE|ENHANCEMENT]

Prerequisite: [List prior features or sprints]

READ FIRST:
- [List key files]

DO:
[Detailed steps from prompt above]

MUST NOT:
[Constraints from prompt]

DONE WHEN:
[Exit criteria from prompt]

Files changed: [Summary]
Time: [Hours from prompt]
```

---

**Ready to ship these prompts to Cursor? Each sprint can launch as you complete the prior one.**
