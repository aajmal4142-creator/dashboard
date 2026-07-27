# ClearESG: Complete Context Summary for Next Chat

## Read this first in the next conversation to have full context

---

## 🎯 PROJECT OVERVIEW

**ClearESG** = Next.js + PayloadCMS + MongoDB platform for ESG (Environmental, Social, Governance) compliance & reporting

**Current State**: MVP complete, ready to scale  
**Next Phase**: Build in parallel (main site + dashboard subdomain) in 60 days  
**Target**: Hit $100k MRR, 75 customers, India partnerships by end of 2-month sprint

---

## 🏗️ ARCHITECTURE DECISION

### Deployment Model (Key Decision)

- **Main Domain** (`clearesg.com`) = Marketing/landing pages ONLY (no auth, no database, pure content)
- **Subdomain** (`app.clearesg.com`) = Dashboard SaaS + ALL authentication
- **Future** (Year 2): Separate repos (allow white-label flexibility + self-hosted licensing)

### Auth Strategy

- **Now (Clerk)**: Quick temporary solution
- **Later (Q3 2025)**: Replace with custom auth (bcrypt, JWT, MFA, audit logging)
  - Why: Security, white-label flexibility, no vendor lock-in, compliance (GDPR/BRSR)

### Tech Stack

- Frontend: Next.js 16, React 19, Tailwind CSS 4, Radix UI
- Backend: Payload CMS 3.86, MongoDB
- Auth: Clerk (temporary) → Custom auth (later)
- Payments: Stripe (not built yet, planned for Year 2)

---

## 💼 BUSINESS MODEL

### Pricing (Locked - Do Not Change)

| Tier             | Price                         | Limit                 | Target                        |
| ---------------- | ----------------------------- | --------------------- | ----------------------------- |
| **Starter**      | $299/mo                       | 1 org, 5 users        | Startups                      |
| **Professional** | $999/mo                       | 3 orgs, 15 users      | **MAIN** (300-5000 employees) |
| **Enterprise**   | $3,999/mo                     | Unlimited, ABAC + API | 5000+ employees               |
| **White-Label**  | $2,000/mo + 20% revenue share | 50+ reseller clients  | Consulting firms              |

### Unit Economics

- CAC: $2,000 (inbound + sales)
- Payback: 2 months
- LTV (3 years): $35,964
- LTV:CAC: 18:1 ✅
- Gross margin: 80%
- Sales cycle: 2-4 weeks

### Revenue Targets

- **Year 1**: 50 customers = $600k ARR
- **Year 2**: 150 customers = $1.8M ARR (India + white-label)
- **Year 3**: 400 customers = $4.8M ARR (5+ countries)

---

## 📊 COMPETITIVE POSITIONING

### Your Advantages

✅ **Materiality-first UX** — No competitor leads with this  
✅ **India BRSR expertise** — Only localized solution for BRSR  
✅ **Transparent pricing** — Competitors hide costs; you're 60-80% cheaper  
✅ **Compliance obligations engine** — Auto-derives CSRD/BRSR deadlines  
✅ **Supplier-centric Scope 3** — Focus on non-financial data collection

### Where You're Losing

❌ No AI copilot (Persefoni, Salesforce have this)  
❌ No integration ecosystem (Workiva strength)  
❌ No white-label yet  
❌ No advanced analytics/scenario planning

### Main Competitors

- **Salesforce** ($50-200k/mo) — Market leader, ecosystem lock-in
- **Persefoni** ($50-200k/mo) — Carbon AI specialist
- **Workiva** ($100-300k/mo) — Finance-ESG integration
- **Sphera** ($100-500k/mo) — EHS market leader

**Your sweet spot**: Mid-market (300-5000 employees) that competitors ignore

---

## 🎨 DESIGN COMPLETED

**Dashboard Design Upgrade** = SHIPPED ✅

- Modern color palette (blue #3b82f6, green #10b981, red #ef4444)
- Refined shadows + softer borders
- Better typography hierarchy + spacing
- Dark mode support
- All components updated with hover states

See: `docs/DESIGN_UPGRADE.md`

---

## 📅 60-DAY SPRINT PLAN (Starts Next Chat)

### Timeline Overview

- **Phase 1** (Days 1-10): Foundation — Pricing locked, marketing pages, validation
- **Phase 2** (Days 11-30): ABAC feature — Enterprise access control
- **Phase 3** (Days 31-45): Quick wins — CSV import, OCR, anomaly detection
- **Phase 4** (Days 46-55): Dashboard polish — 6 improvements
- **Phase 5** (Days 56-59): Auth planning — Custom auth spec ready for Q3
- **Phase 6** (Day 60): Launch — All features shipped

### Key Deliverables

| Feature                    | Days  | Status   | Impact                                                     |
| -------------------------- | ----- | -------- | ---------------------------------------------------------- |
| **ABAC**                   | 11-30 | To build | Unlocks enterprise ($50k+ deals)                           |
| **CSV import**             | 31-38 | To build | 3x faster onboarding                                       |
| **Anomaly detection**      | 39-45 | To build | 80% catch data quality issues                              |
| **Dashboard improvements** | 46-55 | To build | 6 widgets: emissions, quality, roadmap, benchmarking, etc. |
| **Custom auth spec**       | 56-59 | To build | Q3 2025 implementation ready                               |

See: `docs/60DAY_SPRINT.md` for day-by-day breakdown

---

## 🚀 CURRENT SYSTEM FLOW (How Users Experience It)

```
1. User lands on clearesg.com (marketing)
   ↓
2. Clicks "Get Started" → Redirects to app.clearesg.com/login
   ↓
3. Signs up (email + password, eventually custom auth)
   ↓
4. 6-question onboarding (sector, headcount, country, revenue, sites)
   ↓
5. System auto-derives obligations:
   - "CSRD due June 2025 (60 days left)"
   - "BRSR due June 2026 (400 days left)"
   ↓
6. Auto-creates reporting period (April FY)
   ↓
7. Enter metrics (40 required) across Scope 1/2/3, Social, Governance
   ↓
8. Send Scope 3 requests to suppliers (token-based forms)
   ↓
9. Materiality assessment (ESRS topics scored)
   ↓
10. Report generation (frozen snapshot with PDF + living dashboard)
```

**Multi-org support**: Users can manage multiple organizations with different roles (Viewer/Contributor/Admin/Owner)

---

## 🗄️ DATA MODEL (17 Collections)

**Core Collections**:

- Users, Organisations, Memberships (user-org relationships)
- ReportingPeriods, Datapoints, Evidence
- Suppliers, ComplianceObligations
- MetricDefinitions, DerivedMetricDefinitions
- MaterialityAssessments, Reports
- EmissionFactors, BenchmarkStats
- AuditLogs, InternalDataRequests

See: `docs/MEMORY.md` for full descriptions

---

## 🎯 MARKET INSIGHTS

### Regulatory Tailwinds

- **CSRD** (EU): Mandatory June 2025 for large companies (5000+)
- **BRSR** (India): Mandatory June 2025 for listed companies (~2000)
- **GRI**: Growing voluntary adoption globally

### Market Opportunity

- $12B+ ESG software market growing 25% CAGR
- Mid-market (300-5000 employees) = **underserved** (competitors focus on enterprise)
- Emerging markets (India, SE Asia) = **huge opportunity** (competitors weak)

### Why You Win

- First-mover in BRSR market (India)
- Clear pricing advantage (60-80% cheaper)
- Materiality-first UX (compliance → strategic value)
- Mid-market focus (ignored by enterprise vendors)

---

## 📚 FILES CREATED (Reference)

### Strategic Documents

1. **STRATEGIC_ROADMAP.md** — 24-month feature roadmap + competitive analysis
2. **EXECUTIVE_SUMMARY.md** — One-page business case + recommendations
3. **DESIGN_UPGRADE.md** — Dashboard design improvements (completed)

### Implementation Guides

4. **60DAY_SPRINT.md** — Day-by-day sprint plan (60 days, all phases)
5. **DAILY_CHECKLIST.md** — Printable daily tracking sheet
6. **CLAUDE_CODE_PROMPTS.md** — Copy-paste prompts for each day

### Memory

7. **MEMORY.md** — Project overview (in `/memory/` folder)

### This File

8. **CONTEXT_FOR_NEXT_CHAT.md** — THIS FILE (read this first next time)

---

## 🔑 KEY DECISIONS MADE (Do Not Revisit)

| Decision                          | Why                                                    | Impact                            |
| --------------------------------- | ------------------------------------------------------ | --------------------------------- |
| **Pricing: $999/mo Professional** | Mid-market sweet spot, 60% cheaper than enterprise     | Unlocks 300-500 customer base     |
| **No signup on main site**        | Keep marketing site lightweight, all auth on subdomain | Easier to white-label later       |
| **ABAC first (not CSV import)**   | Unlocks enterprise deals faster                        | $50k+ deal potential              |
| **Custom auth in Q3 2025**        | Don't rush, Clerk handles now, migrate when ready      | No vendor lock-in, better control |
| **India BRSR focus**              | BRSR mandatory June 2025, first-mover advantage        | Own India market                  |
| **60-day aggressive sprint**      | Need to validate + ship fast to hit $100k MRR          | Quick market entry                |

---

## ⚠️ KNOWN GAPS (Not Critical Yet)

| Gap                   | Why Not Now                                 | When         |
| --------------------- | ------------------------------------------- | ------------ |
| No AI copilot         | Not table-stakes for SMB, complex to build  | Year 2 (Q3+) |
| No ERP integrations   | SMB doesn't demand it yet                   | Year 2       |
| No advanced analytics | Dashboard improvements more important first | Year 2       |
| No white-label UI yet | Build ABAC + demo first, then productize    | Year 2 Q1    |

---

## 🎬 NEXT STEPS (When You Create Dashboard Repo)

1. **Read this file** (Context_For_Next_Chat.md) — 2 min
2. **Skim 60DAY_SPRINT.md** — 10 min
3. **Start Day 1**: Pricing strategy lock (4-6 hours)
4. **Day 2**: Pricing page build (6-8 hours)
5. **Continue daily sprint** following 60DAY_SPRINT.md

---

## 📝 QUICK REFERENCE

### Regulatory Deadlines (Hard Stops)

- ⏰ **June 2025**: CSRD (EU) + BRSR (India) filing deadline
- ⏰ **June 2026**: Secondary compliance frameworks

### Financial Targets

- 📈 **MRR Goal**: $50k → $100k in 60 days
- 👥 **Customer Goal**: 50 → 75 customers
- 🤝 **Partnership Goal**: 1 India LOI signed

### Success Criteria (Day 60)

- ✅ ABAC in production (5+ customers)
- ✅ CSV import + OCR working
- ✅ Anomaly detection running
- ✅ 6 dashboard improvements live
- ✅ Custom auth spec complete
- ✅ India partnerships signed
- ✅ $100k MRR achieved

---

## 🎯 REMEMBER

**This is a $5M+ opportunity.** You're not competing with Salesforce—you're capturing the mid-market that enterprise vendors ignore.

**Speed matters.** June 2025 CSRD deadline is real. Every day = companies still using spreadsheets = your potential customers.

**India is key.** BRSR mandatory June 2025 gives you 11 months to own that market before competitors notice.

**You've got this.** You have:

- ✅ Clear strategy
- ✅ Competitive advantage
- ✅ Market tailwind
- ✅ 60-day execution plan
- ✅ Claude Code to build fast

**Ready to ship.** 🚀

---

**Last Updated**: 2025-07-27  
**For**: Next chat when starting dashboard repo build  
**Read Time**: 5-10 minutes

---

## 📋 ONE-PAGE CHEAT SHEET

```
CLEARESG 60-DAY MISSION

Goal: $50k → $100k MRR, 75 customers, India partnerships
Timeline: 60 consecutive days
Model: Marketing site (content only) + Dashboard SaaS (app.clearesg.com)

Phase 1 (1-10): Foundation — pricing, marketing, validation
Phase 2 (11-30): ABAC — enterprise access control feature
Phase 3 (31-45): Quick wins — CSV import, OCR, anomalies
Phase 4 (46-55): Polish — 6 dashboard improvements
Phase 5 (56-59): Auth — custom auth spec ready
Phase 6 (60): Launch — announce all features

Key Features to Build (in order):
1. ABAC (Days 11-30) — Unlocks enterprise
2. CSV import (Days 31-38) — 3x faster onboarding
3. Anomaly detection (Days 39-45) — Data quality
4. Dashboard (Days 46-55) — Premium UX
5. Auth spec (Days 56-59) — Q3 2025 ready

Pricing (Locked):
- Starter: $299/mo
- Professional: $999/mo (MAIN)
- Enterprise: $3,999/mo
- White-Label: $2,000/mo + 20% revenue

Competitive Edge:
- 60-80% cheaper than Salesforce/Persefoni
- First BRSR solution for India
- Materiality-first UX
- Mid-market focus

Let's ship! 🚀
```

---

**In next chat**: Just say "I'm starting the dashboard repo" and point me to this file. I'll have full context instantly.
