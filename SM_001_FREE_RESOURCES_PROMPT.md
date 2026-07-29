# SM-001: Free Supplier ESG Data Integration (UPDATED)

**Replace the EcoVadis prompt with this FREE version**

```
# Implementation Task: Free Supplier ESG Data Integration (SM-001)

**Feature ID**: SM-001
**Priority**: 🔴 CRITICAL
**Effort**: 8 hours
**Status**: NOT STARTED

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
- [ ] Supplier questionnaire (self-reported ESG data, 30+ questions)
- [ ] UN Global Compact database sync (free API, ~10K companies)
- [ ] Public sustainability report scraping (optional, auto-extract ESG mentions)
- [ ] Government data integration (EU ETS emissions, SEC filings)
- [ ] Data source tracking (show where each metric comes from)
- [ ] Risk scoring from data completeness + quality (0-100)
- [ ] Admin UI (manage data sources, manual sync, questionnaire status)
- [ ] Data completeness dashboard (what % of supplier data collected)
- [ ] Alert system (email when sufficient data for scoring)
- [ ] Performance: process 1000 suppliers in <30s
- [ ] No external paid API calls

## Implementation Breakdown

### Task 1: Supplier Questionnaire Service (2 hours)

Create questionnaire system:

1. **SupplierQuestionnaire collection** (Payload CMS)
   - org_id, supplier_id, responses (JSON), submitted_at, last_updated
   - Status: draft, submitted, reviewed

2. **Questionnaire template** (30-40 questions):
```

Section A: Organizational Info

- Company name, size, industry, country, primary contact

Section B: Scope 1 Emissions

- Do you track Scope 1 emissions? (yes/no)
- If yes, rough annual estimate (tCO2e)
- Sources: vehicles, equipment, facilities

Section C: Scope 2 Emissions

- Do you track purchased electricity? (yes/no)
- If yes, annual kwh, source (grid/renewable)
- Other Scope 2: district heating, cooling, steam?

Section D: Scope 3 Engagement

- Are you engaged with customers on emissions? (yes/no)
- Do you track supplier emissions? (yes/no)
- Product end-of-life emissions? (yes/no)

Section E: ESG Commitments

- Environmental certifications: ISO 14001, B Corp, EcoLabel, etc.
- Social initiatives: diversity %, equal pay policy, safety record
- Governance: ethics code, whistleblower policy, compliance training

Section F: Sustainability Goals

- Do you have emissions reduction target? (yes/no)
- Target: X% by [year]
- Science-based target (SBTi)? (yes/no)

````

3. **questionnnaireService.ts**
- sendQuestionnaire(supplier_email, org_id): send link to fill out
- submitQuestionnaire(supplier_id, responses): store responses
- getCompletion(supplier_id): % of questions answered
- remindSupplier(supplier_id): send reminder after 14, 21, 30 days

### Task 2: UN Global Compact Sync (2 hours)

UN GC has FREE public database of 10K+ signatory companies:

1. **UN GC Database**:
- Download CSV: https://www.unglobalcompact.org/
- Contains: Company name, country, join date, SDG alignment
- Update frequency: monthly (free, static data)
- No authentication needed

2. **uncGlobalCompactService.ts**:
- fetchDatabase(): download UN GC CSV
- matchSupplier(supplier_name): find supplier in UN GC list
- If matched: store `un_global_compact_signatory = true`, commitment_level
- Add to supplier profile: "✓ UN Global Compact Signatory"

3. **Data import**:
- Run monthly: sync all UN GC signatory companies
- Auto-link if company name matches (simple string match)
- Manual override: user can mark company as/not as signatory

### Task 3: Government Data Integration (1.5 hours)

Free government data sources:

1. **EU ETS (European Emissions Trading System)**:
- Public registry: ~10K EU companies
- Free download: https://ec.europa.eu/clima/ets
- Data: company emissions, allowances, compliance status
- For EU suppliers: import their Scope 1 emissions directly from ETS

2. **SEC EDGAR (US Public Companies)**:
- Free: https://www.sec.gov/edgar
- 10-K filings contain ESG disclosures
- Optional: use NLP to extract emissions mentions, ESG language
- Basic version: just link to 10-K filing on supplier profile

3. **euEtsService.ts**:
- fetchEuEtsData(): download EU ETS registry
- matchSupplier(supplier_name): find in registry
- If matched: import emissions_scope1 from official data
- Store source: "EU ETS Registry"

4. **secFilingService.ts**:
- searchSecFilings(company_name): query SEC EDGAR API (free)
- Extract 10-K: link to filing on supplier profile
- Optional: simple text search for "emissions", "sustainability", "ESG"

### Task 4: Risk Scoring from Available Data (2 hours)

**Risk = based on DATA QUALITY + COMPLETENESS, not external rating**

1. **riskScoringEngine.ts**:
- Calculate risk (0-100, higher = worse)
- Factors:

  a) **Questionnaire Completeness** (40%)
     - If 80-100% answered: 0-20 risk (transparent, low risk)
     - If 50-80% answered: 20-40 risk (partially transparent)
     - If <50% answered: 40-100 risk (not transparent = high risk)

  b) **UN Global Compact Status** (20%)
     - Signatory: -10 risk (good, lower risk)
     - Not signatory: 0 risk (neutral, neither good nor bad)

  c) **Certifications** (20%)
     - Has ISO 14001, B Corp, Fair Trade: -10 risk
     - No certifications: +10 risk

  d) **Government Data Availability** (20%)
     - EU ETS data shows declining emissions: -10 risk
     - EU ETS data shows stable/increasing: +10 risk
     - No government data available: 0 risk (neutral)

- Formula:
  ```
  base_score = 50
  score += questionnaire_factor (0 to 40)
  score += un_gc_factor (-10 to 0)
  score += certification_factor (-10 to +10)
  score += government_factor (-10 to +10)
  score = Math.max(0, Math.min(100, score))

  risk_tier = score < 30 ? 'low' : score < 50 ? 'medium' : score < 75 ? 'high' : 'critical'
  ```

2. **riskAlerts.ts**:
- Alert when supplier moves to "high" or "critical" risk
- Reason: "Data unavailable" or "Negative emissions trend"
- Auto-send email to procurement

### Task 5: Data Source Tracking (1 hour)

For each metric, track origin:

1. **SupplierDataSource** tracking:
- For each data point (emissions, certifications, etc.)
- Store: `{ source: 'questionnaire'|'un_gc'|'eu_ets'|'sec_filing'|'manual', timestamp, confidence_score }`
- Confidence: questionnaire=60%, government=95%, manual=40%

2. **Show on supplier profile**:
- "Scope 1 Emissions: 50 tCO2e (from EU ETS Registry, verified 2024-01-15)"
- "Status: UN Global Compact Signatory (verified 2024-01-15)"
- "Data Completeness: 75% (28 of 40 questionnaire questions answered)"

### Task 6: Admin UI (1 hour)

Create pages:

1. **`/integrations/supplier-data/settings`**:
- Data sources status (UN GC: synced 2024-01-15, EU ETS: synced 2024-01-20)
- Manual sync buttons: "Sync UN GC Now", "Sync EU ETS Now"
- Questionnaire status: "45 suppliers invited, 32 responded, 71% response rate"
- Data freshness view: "Last updated 5 days ago"

2. **`/suppliers/questionnaire/[supplier_id]`**:
- Display questionnaire link for supplier to fill
- Completion progress: "18 of 40 questions answered (45%)"
- Reminder history: "Reminder sent 7 days ago"

3. **`/suppliers/data-sources/[supplier_id]`**:
- Show all data sources for this supplier
- Table: Metric | Value | Source | Date | Confidence
- Example: "Scope 1 Emissions | 50 tCO2e | EU ETS | 2024-01-20 | 95%"

### Task 7: Testing (0.5 hours)

Tests for each data source:

- **Unit tests** (10+):
- Risk score calculation (different data combinations)
- Questionnaire completion %
- Data source priority (which source wins if conflicts)

- **Integration tests** (5+):
- Full flow: send questionnaire → supplier responds → score updates
- UN GC sync: download, match, store
- EU ETS sync: download, extract, store
- Risk alert: send email when high-risk

- **Accuracy** (manual validation):
- Spot-check 20 suppliers: manual calculation vs. system calculation
- Verify risk scores make sense

## Code Quality

```typescript
// Type Safety
✅ TypeScript strict mode
✅ 0 `any` types
✅ Zod schemas for questionnaire responses

// Performance
✅ Questionnaire response: <100ms
✅ UN GC sync: 1000 suppliers in <10s
✅ EU ETS sync: 1000 suppliers in <20s
✅ Risk score calculation: <100ms per supplier
✅ Batch operations for 1000+ suppliers

// No External Costs
✅ No Stripe calls
✅ No external APIs except free ones (UN GC, SEC)
✅ No paid data services
✅ All data stored locally (MongoDB)
````

## Production Readiness Checklist

- [ ] Questionnaire template finalized (product team approval)
- [ ] UN GC sync tested (data downloads correctly, matches work)
- [ ] EU ETS sync tested (if available for org's region)
- [ ] Risk scoring validated (manual spot-check 20 suppliers)
- [ ] Admin UI functional (status dashboard, manual sync)
- [ ] Email reminders tested (sent correctly, no duplicates)
- [ ] Tests passing (10+ unit, 5+ integration)
- [ ] Performance: <30s to process 1000 suppliers
- [ ] TypeScript: 0 errors, 80%+ test coverage
- [ ] Documentation: data sources explained in UI

## Success Metrics

✅ COMPLETED when:

1. Questionnaire sent to 100+ suppliers
2. ≥50% response rate from Tier 1 suppliers
3. Risk scores calculated for all suppliers
4. UN GC matching works (≥50 matches)
5. Admin dashboard fully functional
6. All tests passing (10+ unit, 5+ integration)
7. No external paid API costs
8. Ready for production

## Data Sources (All FREE)

| Source            | Type        | Coverage         | Update    | Cost |
| ----------------- | ----------- | ---------------- | --------- | ---- |
| Questionnaire     | Self-report | Unlimited        | Real-time | FREE |
| UN Global Compact | Directory   | 10K+ companies   | Monthly   | FREE |
| EU ETS            | Government  | 10K EU companies | Annual    | FREE |
| SEC Edgar         | US Filings  | 6K public cos    | Annual    | FREE |
| Certifications    | Directory   | Search online    | Real-time | FREE |

---

```

## Key Differences from EcoVadis

| Aspect | EcoVadis | FREE Version |
|--------|----------|--------------|
| **Cost** | $2K-$50K/year | $0 |
| **Data Source** | Paid 3rd-party ratings | Self-reported + government |
| **Coverage** | 100K+ rated companies | Depends on supplier response |
| **Speed** | Pre-scored, instant | Takes time to collect data |
| **Accuracy** | High (external audit) | Medium (depends on supplier honesty) |
| **MVP Use** | Expensive, not viable | Perfect for MVP |
| **Future** | Can integrate EcoVadis later as paid add-on | Upgrade path clear |

---
```
