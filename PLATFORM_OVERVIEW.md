# ClearESG — Platform Overview

ClearESG is an ESG operating system for measuring, analysing, reporting, and assuring greenhouse-gas and sustainability data. Identity is Clerk; authorisation is always Membership via `getCurrentContext()`. Login alone never grants access.

---

## What we are doing

Build a mid-market alternative to Greenly / Normative / Sweep / Plan A: transparent price, honest emissions quality (`missing`, never silent zero), built-in assurance, and India + EU compliance paths — without enterprise “call sales” lock-in.

---

## Who we target

- Mid-market companies that need Scope 1–3, multi-framework disclosure, and audit-ready evidence
- Consultancies managing multiple client inventories
- India BRSR / GST-oriented teams and EU CSRD / SFDR / CBAM beachheads
- Not chasing Watershed / Workiva / SAP enterprise ACV

Closest peers: Greenly, Normative, Sweep, Plan A, Persefoni Pro.

---

## What this repo has (shipped)

### Core

- Runway home, Metrics workspace, pure `lib/calc` engine, factor registry
- Reports (draft → publish), light-theme PDF, audience packs
- ABAC / Membership, audit trail, lineage

### Collaborate

- Suppliers, questionnaires, public tokens (`/s/*`), Carbon Network
- Supplier Scorecard, documents, risk dashboard (EcoVadis substitute)
- Requests, approvals, consultancy multi-client centre

### Assure

- Assurance Room (`/a/[token]`), L vs R pathways, evidence ZIP/PDF
- Carbon Trust workflows, partners directory

### Compliance & frameworks

- CSRD/ESRS coverage + filing PDF, BRSR, SECR, SFDR PAI, TCFD, ISSB
- CBAM, California SB 253/261, residual/offsets, restatements, SBTi
- Materiality, regulatory calendar

### Data & ops

- Spend / Scope 3 surfaces, product footprints (BOM), IoT gateway path
- Accounting: Xero, QuickBooks, Wave
- Warehouses: BigQuery, Snowflake, Databricks (+ SQL)
- Webhooks, ingest API, Slack/Teams, BI recipes (Power BI / Tableau)
- Alerts, automations, dashboards, benchmarks

### Design

- Editorial light-default theme, token-only colours, Fraunces / Inter Tight / JetBrains Mono

---

## Explicitly deferred

- **AI / LLM features** — classification, anomaly narrative, copilot, report drafts, PDF ingest, etc. Zero LLM in-app today.
- **Paid moats** — EcoVadis API, ecoinvent, Salesforce / SAP / NetSuite, Big4 audit APIs.

Open launch gates (billing, region, consent): [`docs/LAUNCH_DECISIONS.md`](docs/LAUNCH_DECISIONS.md).

---

## Pricing plan

Transparent monthly pricing in **USD**. **14-day free trial of Pro — no credit card required.** Forever Free stays as a limited teaser (watermarked PDF, tight caps).

| Plan             | Monthly     | Annual (~17% / ~2 months free) | Fit                                                                                    |
| ---------------- | ----------- | ------------------------------ | -------------------------------------------------------------------------------------- |
| **Free**         | **$0/mo**   | Forever free                   | Watermarked PDF, 1 period, Scope 1 & 2, 1 user, community support                      |
| **Pro**          | **$199/mo** | **$1,990/yr**                  | Unlimited periods, clean PDF, Scope 1–3, evidence, frameworks, ≤5 users, ≤10 suppliers |
| **Professional** | **$399/mo** | **$3,990/yr**                  | Multi-entity, full Scope 3 × 15, CSRD packs, API, ≤20 users, unlimited suppliers       |
| **Consultant**   | **$799/mo** | **$7,990/yr**                  | Multi-client dashboard, white-label, client org management, unlimited users            |
| **Enterprise**   | Custom      | Contact sales                  | SSO/SAML, SLA, consolidation at scale, dedicated CSM, custom integrations              |

Discount label in product UI: **Save 17%** (or “2 months free”).

---

## Differentiator bets

- Assurance Room + evidence packs from day one
- ABAC policy evaluator
- Honest quality flags (never invent zeros)
- India BRSR + GST path + consultancy multi-client
- Carbon Network + Supplier Scorecard instead of EcoVadis
- Transparent $199 / $399 / $799 vs peers that hide pricing

---

## References

- [`README.md`](README.md) — setup
- [`seed.md`](seed.md) — seed / metrics
- [`docs/LAUNCH_DECISIONS.md`](docs/LAUNCH_DECISIONS.md) — Workstream 0 gates
- [`.cursor/rules/clearesg.mdc`](.cursor/rules/clearesg.mdc) — binding agent rules
