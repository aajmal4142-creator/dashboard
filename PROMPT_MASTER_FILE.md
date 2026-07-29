# ClearESG Implementation Master Prompt File

**How to Use**:
1. Open a new chat
2. Tag it with Feature ID (e.g., DC-001, CF-001, SM-001)
3. Copy-paste the corresponding prompt section below
4. I'll implement the full feature

---

# SPRINT 1: CRITICAL FOUNDATION (Week 1-2)
**4 Features | 24 Hours | Can Run in Parallel** ✅

## DC-001: API/Webhook Data Ingestion (8h)

```
# Implementation Task: API/Webhook Data Ingestion (DC-001)

**Feature ID**: DC-001  
**Priority**: 🔴 CRITICAL  
**Effort**: 8 hours  
**Status**: NOT STARTED  
**Target Segments**: Mid-Market, Growth, Enterprise, Specialist

## Task Overview
Implement REST API endpoints and webhook receiver for third-party data ingestion. This enables enterprise customers to push real-time data from their systems directly into ClearESG without manual CSV imports.

## Context
- This is SPRINT 1 (Week 1-2) of non-AI implementation roadmap
- Must be production-ready, highly optimized code
- No testing phase included in planning (1-month testing after all features)
- Code quality: TypeScript strict, 80%+ test coverage, OWASP security
- Each feature gets its own implementation chat

## Acceptance Criteria (ALL must be met)
- [ ] REST API endpoint: POST /api/app/data/ingest (accept batch datapoints)
- [ ] Webhook registration: POST /api/app/webhooks/register (create webhook)
- [ ] Webhook receiver: POST /api/app/webhooks/events (process events)
- [ ] Webhook management: GET/DELETE /api/app/webhooks (list/delete)
- [ ] Request signature verification (HMAC-SHA256)
- [ ] Rate limiting (1000 requests/hour per org, ABAC-enforced)
- [ ] Retry logic with exponential backoff (1s, 2s, 5s, 10s)
- [ ] Full audit logging for all API calls (who, what, when, status)
- [ ] Error handling with meaningful error codes (API-001 to API-050)
- [ ] Support for batch payloads (100-1000 items)
- [ ] Support for real-time single payloads
- [ ] API documentation (OpenAPI 3.0 spec)
- [ ] Security: TLS 1.2+, webhook secret rotation, request timeout (30s max)
- [ ] ABAC enforcement on all endpoints (user must have create:datapoint:organisation)
- [ ] Dead letter queue for failed retries (audit-ready)

## Implementation Breakdown

### Task 1: API Route Structure (2 hours)
Create route handlers in Next.js App Router:
- `src/app/(frontend)/api/app/data/ingest/route.ts` — POST handler for bulk/single datapoint ingestion
- `src/app/(frontend)/api/app/webhooks/register/route.ts` — POST/GET/DELETE for webhook CRUD
- `src/app/(frontend)/api/app/webhooks/events/route.ts` — POST handler for receiving webhook events

Requirements:
- Use dynamic route handlers (Promise<Response> pattern for Next.js 16.2+)
- Implement middleware for signature verification
- Implement middleware for ABAC check
- Implement middleware for rate limiting
- Return proper HTTP status codes (200, 400, 401, 403, 429, 500)
- No hardcoded secrets (all from env vars)

### Task 2: Database Schema (1 hour)
Create Payload CMS collections:

1. **WebhookRegistrations** collection
   - Fields: org_id, webhook_id (UUID), endpoint_url, secret (encrypted), events (array: 'datapoint.created', 'datapoint.updated'), status ('active'|'inactive'), created_at, updated_at, last_triggered_at
   - Indexes: org_id, webhook_id, status
   - Access control: require ABAC (admin:webhooks:organisation)

2. **WebhookLogs** collection
   - Fields: webhook_id, event_type, payload (JSON), status ('success'|'failed'|'retrying'), response_code, error_message, attempt_number, next_retry_at, timestamp
   - TTL index: auto-delete logs after 90 days
   - Performance: handle 10K+ logs/day

### Task 3: Core Services (3 hours)
Create implementation files in `src/lib/api/`:

1. **webhookService.ts** (service layer)
   - `registerWebhook(orgId, endpoint, secret, events)` → WebhookRegistration
   - `listWebhooks(orgId)` → WebhookRegistration[]
   - `deleteWebhook(webhookId)` → void
   - `triggerWebhook(webhookId, event, payload)` → async (non-blocking)
   - `rotateSecret(webhookId)` → newSecret

2. **webhookValidator.ts** (signature verification)
   - `verifySignature(payload, signature, secret)` → boolean
   - Use HMAC-SHA256 algorithm
   - Timestamp validation (reject if >5 min old)

3. **webhookQueue.ts** (async processing)
   - Use Bull queue (Redis-backed) for webhook events
   - Retry policy: exponential backoff (1, 2, 5, 10 seconds)
   - Max retries: 4
   - Dead letter queue for final failures

4. **rateLimiter.ts** (per-org rate limiting)
   - Use Upstash Redis (already in stack)
   - Limit: 1000 requests/hour per org
   - Return 429 (Too Many Requests) when exceeded
   - Include remaining quota in response headers (X-RateLimit-Remaining)

### Task 4: Data Validation & Ingestion (2 hours)
Create ingestion logic:

1. **ingestDatapoint.ts**
   - Accept datapoint from webhook/API
   - Validate against existing Datapoints schema (Zod)
   - Check org quota (usage tracker service)
   - Auto-categorize if category missing (simple mapping, not AI)
   - Create datapoint record
   - Audit log: "webhook_ingest:success" with payload hash
   - Return: { id, status: 'created', timestamp }

2. **batchIngest.ts**
   - Accept array of 1-1000 datapoints
   - Validate each (Zod schema)
   - Parallel processing (Promise.all, max 10 concurrent)
   - Partial success handling (if 1 fails, others still saved)
   - Return: { inserted: 950, failed: 50, errors: [...] }

### Task 5: Error Handling & Logging (1 hour)
Implement comprehensive error handling:

Error codes (API-001 to API-050):
- API-001: Invalid request signature
- API-002: Webhook not found
- API-003: Rate limit exceeded
- API-004: Invalid datapoint schema
- API-005: Org quota exceeded
- API-006: Unauthorized (missing ABAC permission)
- ... (continue for 50 codes)

Logging requirements:
- Structured JSON logs (not plain text)
- Include: timestamp, request_id, org_id, user_id, action, status, duration_ms, error_code
- Send to stdout (cloud logging will aggregate)
- Never log: raw payloads, secrets, PII

### Task 6: Security & TLS (1 hour)
- Enforce HTTPS (return 301 if HTTP)
- Validate TLS 1.2+ (middleware)
- Implement webhook secret rotation (old + new secret valid for 7 days)
- Input validation: max payload 1MB
- IP whitelisting (optional, configurable in admin UI)
- CORS: allow only registered webhook domains

### Task 7: Testing Strategy (Included in hourly estimate)

**Unit Tests** (40+ test cases in `src/lib/api/__tests__/`):
- webhookService.test.ts: 15 tests
- webhookValidator.test.ts: 12 tests
- rateLimiter.test.ts: 8 tests
- ingestDatapoint.test.ts: 10 tests

**Integration Tests** (10+ scenarios):
- POST /api/app/data/ingest with single datapoint
- POST /api/app/data/ingest with batch (100 items)
- POST /api/app/webhooks/register and verify HMAC
- Trigger webhook event and verify retry
- Rate limiting (1001st request gets 429)
- ABAC enforcement (user without permission gets 403)
- Partial batch failure (50 valid, 50 invalid)

**Load Testing**:
- Sustain 1000 webhook events/minute
- Batch ingestion of 1000 datapoints/second
- No memory leaks under load

## Code Quality Requirements

✅ TypeScript strict mode, 0 `any` types
✅ 80%+ test coverage
✅ API response: <100ms p95
✅ ABAC enforcement on all endpoints
✅ OpenAPI 3.0 documentation

## Production Readiness Checklist

- [ ] All acceptance criteria met
- [ ] 40+ unit tests passing
- [ ] 10+ integration tests passing
- [ ] Load testing: 1000 req/min sustained, <100ms p95
- [ ] TypeScript: 0 errors
- [ ] ESLint: 0 warnings
- [ ] Code coverage: ≥80%
- [ ] Security audit: OWASP Top 10 verified
- [ ] API docs: OpenAPI spec published
- [ ] Monitoring: Error alerts configured
- [ ] Backward compatibility: No breaking changes
- [ ] Deployment tested: Zero-downtime migration

## Success Criteria

✅ COMPLETED when:
1. All acceptance criteria met
2. 40+ tests passing
3. Code review approved by 2+ engineers
4. API documentation published
5. Load testing passed (1000 req/min)

---
```

---

## CF-001: GHG Protocol 2004 Compliance (8h)

```
# Implementation Task: GHG Protocol 2004 Compliance Checklist (CF-001)

**Feature ID**: CF-001  
**Priority**: 🔴 CRITICAL  
**Effort**: 8 hours  
**Status**: NOT STARTED  
**Depends On**: None (can start in parallel with DC-001)

## Task Overview
Implement GHG Protocol 2004/2015 compliance checklist system. Ensures emissions calculations meet international standards and are audit-ready.

## Acceptance Criteria (ALL must be met)
- [ ] 50+ GHG Protocol requirements coded as checklist items
- [ ] Scope 1, 2, 3-specific checklists
- [ ] Compliance score calculation (0-100%)
- [ ] Scope boundary validation
- [ ] Emissions calculation methodology documentation
- [ ] Data quality assessment
- [ ] Compliance report generation (audit-ready PDF)
- [ ] Evidence linking
- [ ] Assurance auditor sign-off capability (locked after signed)
- [ ] Framework mapping (CSRD, BRSR, GRI, SASB)
- [ ] Regulatory requirement tracking
- [ ] Immutable audit trail
- [ ] Multi-user approval workflows

## Implementation Breakdown

### Task 1: GHG Protocol Data Model (2 hours)
Create Payload CMS collections:
1. GhgProtocolCompliance (org_id, compliance_year, scope1_total, scope2_total, scope3_total, boundary_definition, methodology, data_quality_score, compliance_score, is_verified, verified_by, verified_at)
2. ComplianceCheckpoints (org_id, checkpoint_id, category, requirement_name, requirement_code, status, evidence_link, notes, verified_by, verified_at)
3. ComplianceHistory (audit trail: compliance_id, action, actor_id, timestamp, changes)

### Task 2: Compliance Checklist Engine (2 hours)
- checklistService.ts: getChecklist(), updateCheckpoint(), verifyCheckpoint(), calculateComplianceScore(), lockCompliance()
- ghgProtocolRules.ts: 50+ requirements as hardcoded data
- boundaryValidator.ts: validateBoundary() with organizational/operational checks

### Task 3: Data Quality Assessment (1.5 hours)
- dataQualityAssessor.ts: calculateScore() with completeness, accuracy, consistency, recency
- Return: { score, breakdown: { completeness, accuracy, consistency, recency } }

### Task 4: Compliance Report Generator (2 hours)
- reportGenerator.ts: generateComplianceReport() → PDF buffer
- narrativeGenerator.ts: auto-generate compliance narrative text

### Task 5: Framework Mapping (1.5 hours)
- frameworkMapper.ts: map GHG Protocol checkpoints to CSRD, BRSR, GRI, SASB

### Task 6: API Routes (1 hour)
- GET /api/app/compliance/checklist
- PATCH /api/app/compliance/checklist/[id]
- POST /api/app/compliance/verify/[id]
- POST /api/app/compliance/lock
- GET /api/app/compliance/report/[id]

### Task 7: UI Components (1 hour)
- /compliance/checklist page (list, filter, update, verify, attach evidence)
- /compliance/report page (download PDF, view narrative, share, auditor sign-off)

## Testing (20+ tests)
- Checklist calculation accuracy
- Boundary validation
- Data quality scoring
- Immutability after lock
- Report PDF generation

## Production Readiness
- [ ] All 50+ GHG Protocol requirements coded
- [ ] Compliance score verified manually
- [ ] Report PDF is audit-ready
- [ ] Immutability verified
- [ ] External auditor validates logic
- [ ] Tests: 20+ passing
- [ ] Coverage: ≥80%

---
```

---

## SM-001: EcoVadis Integration (8h)

```
# Implementation Task: EcoVadis Integration (SM-001)

**Feature ID**: SM-001  
**Priority**: 🔴 CRITICAL  
**Effort**: 8 hours  
**Status**: NOT STARTED  
**Depends On**: None (can run in parallel)

## Task Overview
Integrate with EcoVadis API to sync supplier assessment scores. EcoVadis is the industry standard for supply chain ESG (100K+ companies rated).

## Acceptance Criteria
- [ ] OAuth 2.0 connection with EcoVadis
- [ ] Daily automated sync (2 AM UTC)
- [ ] Supplier score mapping (assessment_date, score, trend)
- [ ] Multi-dimensional scoring (Environment, Labor, Ethics, Procurement)
- [ ] Risk flag automation (score <40 = high risk)
- [ ] Historical score tracking (last 24 months)
- [ ] Failed sync error handling (3 retries)
- [ ] Admin UI (connect, disconnect, manual sync)
- [ ] Sync status dashboard
- [ ] Data freshness validation (error if >48h old)
- [ ] Delta sync (only fetch changed since last)
- [ ] Supplier risk dashboard
- [ ] Alert system (email when high-risk)
- [ ] Performance: 1000+ suppliers in <30s

## Implementation Breakdown

### Task 1: OAuth Integration (2 hours)
- oauthManager.ts: token refresh, connection status, error handling
- EcoVadisConnection collection: org_id, access_token (encrypted), refresh_token, expires_at, connected_at, last_sync_at, status, error_message

### Task 2: API Sync Service (3 hours)
- ecovadisSync.ts: fetch all suppliers, map scores, update records, handle retries
- scoreMapper.ts: EcoVadis (0-100) → Risk tiers (low/medium/high/critical)
- syncWorker.ts: scheduled cron job (daily 2 AM UTC)

### Task 3: Risk Scoring Engine (2 hours)
- riskScorer.ts: calculate risk (EcoVadis score 50%, industry 10%, location 10%, spend 20%, trend 10%)
- riskAlerts.ts: detect newly high-risk, send emails
- supplierRiskDashboard.ts: filter, sort, export

### Task 4: Admin UI (1 hour)
- /integrations/ecovadis/connect (OAuth login)
- /integrations/ecovadis/settings (status, manual sync, history, errors)

### Task 5: Database Schema (1 hour)
Update Suppliers collection: ecovadis_score, ecovadis_categories, ecovadis_last_assessed, risk_score, risk_tier, risk_flags, ecovadis_url

### Task 6: Testing (1 hour)
- 15+ unit tests (OAuth, scoring, sync)
- 5+ integration tests (full sync, delta sync, errors, performance)

## Production Readiness
- [ ] OAuth tested with sandbox
- [ ] Daily sync runs 7 days without errors
- [ ] Success rate: 99%
- [ ] Performance: <30s for 1000 suppliers
- [ ] Risk scoring validated
- [ ] Admin UI functional
- [ ] Monitoring alerts configured
- [ ] Tests: 15+ unit, 5+ integration

---
```

---

## BC-001: Annual Billing with Discount (4h)

```
# Implementation Task: Annual Billing with Discount (BC-001)

**Feature ID**: BC-001  
**Priority**: 🔴 CRITICAL  
**Effort**: 4 hours  
**Status**: NOT STARTED  
**Depends On**: Stripe integration (already done in Days 36-45)

## Task Overview
Add annual billing option with 15-20% discount. Improves cash flow and increases ACV.

## Acceptance Criteria
- [ ] Annual billing option at checkout (next to monthly)
- [ ] 15-20% discount for annual plans
- [ ] Stripe price IDs for annual plans (STRIPE_PRICE_*_ANNUAL)
- [ ] Billing cycle toggle in account settings
- [ ] Pro-rata calculation for mid-cycle changes
- [ ] Automatic renewal on anniversary date
- [ ] Renewal reminders (60, 30, 7 days before)
- [ ] Manual renewal management UI
- [ ] Invoice shows discount breakdown
- [ ] Switch monthly ↔ annual mid-cycle with pro-rata
- [ ] Subscription history tracks changes
- [ ] Performance: handle 10K+ renewals/month

## Implementation Breakdown

### Task 1: Stripe Setup (1 hour)
Create annual price IDs in Stripe:
- STRIPE_PRICE_STARTER_ANNUAL = monthly × 12 × 0.8
- STRIPE_PRICE_PROFESSIONAL_ANNUAL
- STRIPE_PRICE_ENTERPRISE_ANNUAL
- STRIPE_PRICE_TRIAL_ANNUAL
Store in .env

### Task 2: Database Schema (0.5 hours)
Add to Subscriptions collection:
- billing_cycle: 'MONTHLY' | 'ANNUAL'
- next_renewal_date
- last_renewal_date
- annual_discount_percentage
- renewal_history array

### Task 3: Billing Logic (1.5 hours)
- stripeService.ts: createAnnualSubscription(), upgradeToAnnual(), downgradeToMonthly(), renew()
- prorataCalculator.ts: calculateProrata() for mid-cycle switches
- renewalScheduler.ts: daily cron to trigger renewals

### Task 4: Frontend (1 hour)
- Checkout: toggle Monthly/Annual with "Save 20%" badge
- Settings: show billing cycle, switch button, pro-rata confirm
- Email templates: 60/30/7 day reminders

### Task 5: Subscription History (0.5 hours)
Create SubscriptionHistory collection: subscription_id, action, previous/new cycle/plan, prorata_adjustment, timestamp, initiated_by

## Testing (15+ tests)
- Pro-rata calculations
- Renewal scheduling
- Billing cycle toggle
- Monthly ↔ Annual conversion

## Production Readiness
- [ ] Annual prices in Stripe
- [ ] Checkout shows both options
- [ ] Pro-rata verified by finance
- [ ] Renewal automation tested
- [ ] Email reminders working
- [ ] Switching cycles works
- [ ] Tests: 15+ passing
- [ ] Coverage: ≥80%

---
```

---

# SPRINT 2: COMPLIANCE & FRAMEWORKS (Week 3-4)
**5 Features | 40 Hours | Can Run in Parallel** ✅

## SF-001: CSRD/ESRS Reporting (20h)

See IMPLEMENTATION_ROADMAP_NON_AI.md SPRINT 2 section for full details.

**Quick**: ESRS mapping, auto data population, audit-ready PDF, narrative generation, assurance integration.

---

## SF-002: TCFD Framework (12h)
See IMPLEMENTATION_ROADMAP_NON_AI.md for full details.

**Quick**: Governance/Strategy/Risk/Metrics mapping, scenario analysis, financial impact, report generation.

---

## SF-003: ISSB S1/S2 Standards (12h)
See IMPLEMENTATION_ROADMAP_NON_AI.md for full details.

**Quick**: S1 general + S2 climate mapping, materiality assessment, resilience indicators.

---

## SF-004: Carbon Trust Certification (8h)
See IMPLEMENTATION_ROADMAP_NON_AI.md for full details.

**Quick**: Verification checklist, evidence collection, auditor workflow, certification tracking.

---

## SF-005: Regulatory Deadline Calendar (6h)
See IMPLEMENTATION_ROADMAP_NON_AI.md for full details.

**Quick**: Pre-populated deadlines, jurisdiction filtering, alerts, calendar export, custom deadlines.

---

# SPRINT 3-8: REMAINING FEATURES

For detailed prompts for all remaining features, refer to:
📄 **IMPLEMENTATION_ROADMAP_NON_AI.md**

Each feature in Sprint 3-8 follows same structure:
- Acceptance Criteria
- Task-by-task breakdown
- Code quality standards
- Testing strategy
- Production readiness checklist

**Simply copy from roadmap → paste into new chat with feature ID tag**

---

# QUICK REFERENCE TABLE

| Sprint | Features | Hours | Can Parallel? |
|--------|----------|-------|--------------|
| **1** | DC-001, CF-001, SM-001, BC-001 | 24h | ✅ YES |
| **2** | SF-001, SF-002, SF-003, SF-004, SF-005 | 40h | ✅ YES |
| **3** | SM-002, SM-003, SM-004, SM-005, SM-006, SM-007 | 54h | ✅ YES |
| **4** | AN-001, AN-002, AN-003, AN-004, AN-005 | 60h | ✅ YES |
| **5** | INT-001, INT-002, INT-003 | 30h | ✅ YES |
| **6** | INT-004, INT-005, INT-006, INT-007 | 38h | ✅ YES |
| **7** | UX-001, UX-002, UX-003, UX-004 | 28h | ✅ YES |
| **8** | BC-002-005, DC-002-006, ASS-001-002, REP-001-003, EM-001-003, CF-006, AN-006-007 | 148h | ⚠️ PARTIAL |

**Total**: 8 Sprints | 40 Features | 246 Hours | 16 Weeks

---

# HOW TO USE THIS FILE

## Each Chat:
1. Open new chat
2. Title it: **"[SPRINT] - [FEATURE_ID]: [Feature Name]"**
   - Example: "SPRINT 1 - DC-001: API/Webhook Ingestion"
3. Copy entire prompt section from this file
4. Paste into chat
5. I'll implement the full feature

## Feature Status:
After each feature is ✅ COMPLETED, update this file:
```markdown
✅ DC-001: API/Webhook Ingestion (COMPLETED)
   - Chat: [link]
   - Commit: abc123def456
   - Tests: 40+ passing
```

---

# PARALLEL EXECUTION RULES

**YES - Can run in parallel:**
- Same sprint features (no dependencies)
- Example: DC-001, CF-001, SM-001, BC-001 (SPRINT 1) all simultaneously ✅

**MAYBE - Can run with caution:**
- Sprint 8 has many features but some dependencies
- Need to check blockers

**NO - Must wait:**
- Features with "Depends On" noted

---

**Created**: July 29, 2026  
**Total Features**: 40 non-AI  
**Total Hours**: 246h  
**Format**: Copy prompt → Tag chat → I implement
```
