# ClearESG — Competitive Planning Sheet

**Corrected audit (2026-08-03).** Full remaining non-AI / non-pay inventory.

**Daily build protocol:** Say `n features` → implement next _n_ rows in table order (Partials P01… first, then B, X, Y). Update this sheet after each day.

**AI later:** [`AI_FEATURES_BACKLOG.md`](AI_FEATURES_BACKLOG.md) (8 features — do not implement in this wave).

**References:** [`PLATFORM_FUNCTIONALITY_GUIDE.md`](PLATFORM_FUNCTIONALITY_GUIDE.md) · [`COMPETITORS_DIRECTORY.md`](COMPETITORS_DIRECTORY.md) · July docs are historical.

---

## Progress log

| Date       | IDs           | Notes                                                                                                                                        |
| ---------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-08-03 | P01–P05       | IoT protocol honesty UI; Snowflake connector; BOM registry Suggest; multi-metric benchmarks; `/frameworks/csrd` coverage loop                |
| 2026-08-04 | P06–P10       | CT evidence upload API + auditor attach; SFDR PAI pack export; supplier documents UI; scorecard + txt/csv; pathway checklist in evidence ZIP |
| 2026-08-04 | P11–P15       | CSRD/ESRS filing PDF; board/ops/auditor audience packs; CSRD gap pack; Databricks connector; BI recipe surfacing                             |
| 2026-08-05 | P16–P21       | Portal chrome on `/s/q/*`; French locale; annual cycle + volume UX; live metered usage; dunning webhook + cron                               |
| 2026-08-05 | B01–B06 + X01 | Field PWA + offline queue; Zapier/Make recipes; multi-year contracts; trial extend; ASC 606 notes; CBAM filing pack + declarant/ready        |

---

## Count summary (corrected)

| Bucket                                                | Count  | This wave          |
| ----------------------------------------------------- | ------ | ------------------ |
| Partial — gaps #1–#91                                 | **21** | Yes                |
| Partial — extras outside spreadsheet                  | **14** | Yes                |
| Buildable — gaps #1–#91                               | **6**  | Yes                |
| Buildable — extras outside spreadsheet                | **10** | Yes                |
| **Total remaining (non-AI, non-pay)**                 | **44** | Next: **X02**      |
| Already SHIPPED (of 91)                               | 50     | Done               |
| Duplicates in 91                                      | 5      | Ignore             |
| AI related                                            | 8      | Later → AI backlog |
| Pay-plan (EcoVadis, ecoinvent, SF/SAP/NetSuite, Big4) | 6      | No                 |
| Not possible (moats)                                  | 5      | No                 |

---

## EcoVadis decision

**No EcoVadis integration.** Too costly. Use Supplier Scorecard (P09), Carbon Network, Open Supply Hub (Y07), public-registry enrichment (Y08).

---

## Table A — Partial from gaps #1–#91 (21)

| ID  | Gap# | Feature                            | Status | Current anchor                                   | What to finish                                                                                | Wave | Effort |
| --- | ---- | ---------------------------------- | ------ | ------------------------------------------------ | --------------------------------------------------------------------------------------------- | ---- | ------ |
| P01 | 2    | IoT protocol depth                 | Done*  | `protocolSupport.ts`, `/iot`                     | Honest native vs gateway-push; utility still unsupported. Native Modbus/OPC client = later L. | 3    | L      |
| P02 | 3    | DB / warehouse connector depth     | Done*  | `connectors/snowflake.ts`                        | Snowflake live. Databricks shipped in P14.                                                    | 3    | L      |
| P03 | 11   | Product footprints depth           | Done*  | Suggest + `resolveBomFactor…`                    | Registry Suggest on BOM. Charts/compare optional polish.                                      | 3    | M      |
| P04 | 15   | Industry benchmarking depth        | Done*  | `BenchmarksClient` metric picker                 | Multi-metric load. Consent gate unchanged.                                                    | 2    | M      |
| P05 | 18   | CSRD / ESRS reporting depth        | Done*  | `/frameworks/csrd`                               | Coverage + Gaps→Metrics→Publish beachhead. Full EFRAG expands later.                          | 1    | L      |
| P06 | 21   | Carbon Trust / certification depth | Done*  | `/api/.../documents` + auditor UI                | Evidence upload + checklist attach. Deeper auditor polish later.                              | 3    | M      |
| P07 | 25   | SFDR PAI depth                     | Done*  | `sfdr/pack.ts` + coverage `?pack=1`              | PAI pack copy/download. Filing narrative still later.                                         | 2    | M      |
| P08 | 31   | Supplier document repository       | Done*  | `/suppliers/[id]/documents`                      | Upload/list UX on existing APIs. Real virus scanner still open.                               | 1    | M      |
| P09 | 35   | Supplier ESG Scorecard             | Done*  | `scorecard.ts` + `/suppliers/[id]/scorecard`     | Quality score + txt/csv. Formal PDF optional polish.                                          | 1    | M      |
| P10 | 41   | Assurance evidence / audit packs   | Done*  | `pathwayChecklistToCsv` in ZIP                   | Pathway checklist CSV in evidence ZIP. Sampling/opinion still X06.                            | 1    | M      |
| P11 | 43   | CSRD/ESRS PDF automation           | Done*  | `CsrdEsrsPdfDocument` + `/reports/[id]/csrd-pdf` | Filing-oriented light PDF from snapshot + coverage checklist.                                 | 2    | M      |
| P12 | 48   | Stakeholder-specific report views  | Done*  | `audiencePack` board/ops/auditor                 | Audience select on pack download. Auditor still points to evidence ZIP for depth.             | 2    | M      |
| P13 | 51   | Compliance gap analysis reports    | Done*  | `csrd/draft.ts` gap pack                         | CSRD gap pack copy/download (+ SECR/SFDR already shipped).                                    | 2    | S      |
| P14 | 66   | Warehouse connectors (beyond BQ)   | Done*  | `connectors/databricks.ts`                       | Databricks SQL Statement API wired like Snowflake.                                            | 3    | L      |
| P15 | 69   | Power BI / Tableau depth           | Done*  | Settings BI + Developers notes                   | Recipes surfaced; REST-only (no native .mez/.taco).                                           | 3    | S      |
| P16 | 75   | White-label / portal branding      | Done*  | `/s/q/*` portal chrome                           | Questionnaire portal matches `/s/*` branding. Custom domain still later.                      | 3    | S      |
| P17 | 83   | Multi-language                     | Done*  | `fr` locale + Settings                           | French overlays English. Expand catalog later.                                                | 3    | M      |
| P18 | 84   | Annual billing + discount UX       | Done*  | Billing cycle toggle + savings                   | Monthly/annual switch + prorata confirm on `/billing`.                                        | 4    | S      |
| P19 | 86   | Usage-based pricing depth          | Done*  | `/billing/usage` live meters                     | Metered usage + overage projection. Stripe metered invoice polish later.                      | 4    | M      |
| P20 | 89   | Volume discounts UX                | Done*  | Volume tiers on `/billing`                       | Tier table + applied discount on seats.                                                       | 4    | S      |
| P21 | 90   | Dunning orchestration              | Done*  | Webhook + cron + billing banner                  | Campaign on payment_failed; retry cron; past_due recovery link.                               | 4    | M      |

---

## Table B — Buildable from gaps #1–#91 (6)

| ID  | Gap# | Feature                   | Status | What to finish                                         | Wave | Effort |
| --- | ---- | ------------------------- | ------ | ------------------------------------------------------ | ---- | ------ |
| B01 | 6/73 | Native mobile app         | Done*  | `/field` PWA shell (manifest + SW) for meters/evidence | 4    | L      |
| B02 | 74   | Offline-first data entry  | Done*  | IndexedDB queue → ingest + evidence sync               | 4    | L      |
| B03 | 68   | Zapier / Make.com         | Done*  | Docs + templates on webhooks (aligned event names)     | 4    | S      |
| B04 | 85   | Multi-year contracts      | Done*  | contractTermYears / ends / discount on billing         | 4    | S      |
| B05 | 88   | Trial extensions & upsell | Done*  | extend-trial API + Extend/Upgrade banner               | 4    | S      |
| B06 | 91   | Revenue recognition notes | Done*  | `/billing/revenue-recognition` ASC 606 / IFRS 15       | 4    | S      |

---

## Table C — Extra PARTIAL outside spreadsheet (14)

| ID  | Feature                                | Current anchor                 | What to finish                                                             | Wave | Effort |
| --- | -------------------------------------- | ------------------------------ | -------------------------------------------------------------------------- | ---- | ------ |
| X01 | CBAM filing pack depth                 | `/compliance/cbam`             | Done* — Filing CSV/JSON; defaults table; declarant + draft→ready→submitted | 2    | L      |
| X02 | Residual / offsets claim depth         | `/compliance/residual`         | Registry serials, project fields, disclosure guards (no marketplace)       | 2    | M      |
| X03 | Restatements → applied inventory       | `/compliance/ghg/restatements` | As-of published figures / applied recalc path                              | 2    | L      |
| X04 | Double materiality depth               | `/materiality`                 | Stakeholder surveys, IRO register, ESRS crosswalk                          | 1    | L      |
| X05 | BRSR depth (India)                     | `/frameworks/brsr`             | Fill empty metricKeys; SEBI-style export pack                              | 1    | M      |
| X06 | Assurance L vs R engagement depth      | `lib/assurance/pathways`       | Sampling, materiality, opinion letter, checkpoint binding                  | 1    | M      |
| X07 | Multi-org consolidation depth          | Org hierarchy + consolidation  | IC eliminations, FX, statutory vs management pack                          | 3    | L      |
| X08 | Employee engagement depth              | `/engagement`                  | Surveys, verified commute at scale (no HRIS BSP required)                  | 3    | M      |
| X09 | Procurement tradeoffs depth            | `/procurement/tradeoffs`       | Vendor lists / RFP-lite (no paid ERP required)                             | 3    | M      |
| X10 | Cascade ↔ MACC ↔ reduction closed loop | analytics routes               | One plan object; facility progress from meters                             | 2    | M      |
| X11 | Public embed hardening                 | `/public/reports/embed`        | Domain allowlist, theme, CSP docs                                          | 3    | S      |
| X12 | Realtime SSE multi-instance            | `lib/realtime`                 | Redis/pub-sub fan-out (beyond in-process hub)                              | 3    | M      |
| X13 | California SB 253/261 filing pack      | `/compliance/california`       | Exportable pack beyond coverage checklist                                  | 2    | M      |
| X14 | Taxonomy / ISSB mapping stubs          | `mappings.ts`, ISSB questions  | Replace counsel placeholders with real mappings                            | 2    | M      |

---

## Table D — Extra BUILDABLE outside spreadsheet (10)

| ID  | Feature                           | What to finish                                                       | Wave | Effort | Note                     |
| --- | --------------------------------- | -------------------------------------------------------------------- | ---- | ------ | ------------------------ |
| Y01 | Scope 3 — all 15 GHG categories   | Category matrix + inclusion/exclusion; fill Cat 2/3/8/10–14 surfaces | 1    | L      | **Largest product hole** |
| Y02 | CSRD XBRL / iXBRL tagging         | ESRS taxonomy tagging / ESEF-style package (beyond JSON/XML)         | 2    | L      |                          |
| Y03 | Consultant multi-client billing   | Per-client invoices / seats / usage rollup                           | 4    | M      | Differentiator           |
| Y04 | India GST / HSN → Scope 3         | GST/HSN mapper into spend path                                       | 1    | M      | India wedge              |
| Y05 | Razorpay + INR billing            | India payments                                                       | 4    | M      | **Open decision §11**    |
| Y06 | DPDP / India privacy workflows    | DSR/retention product flows                                          | 4    | M      | **Open decision §11**    |
| Y07 | Open Supply Hub OS ID             | OS ID on supplier/facility + map link                                | 1    | S      | Free                     |
| Y08 | Public-registry risk enrichment   | SBTi / enforcement flags into risk (documented; no invented scores)  | 1    | M      | Free                     |
| Y09 | PCAF financed emissions           | In-house Cat 15-style module                                         | 4    | L      |                          |
| Y10 | Snowflake / Databricks connectors | Done* — Databricks in P14 (Snowflake in P02)                         | 3    | L      |                          |

\*Done = ship-today depth landed; starred items may still have L follow-ups noted in Status/What to finish.

---

## Implementation waves (51 items)

### Wave 1 — Mid-market + India beachhead

Y01 Scope 3×15 · P05 ESRS depth · P09 Scorecard · P08 Doc repo · P10 Evidence packs · X04 Materiality depth · X05 BRSR · X06 Assurance depth · Y04 GST/HSN · Y07 OS Hub · Y08 Registry enrichment

### Wave 2 — Compliance packs & disclosure

P07 SFDR · X01 CBAM · X13 California · X02 Residual · X03 Restatements · P11 Framework PDF · P13 Gap reports · P12 Stakeholder views · Y02 XBRL · X10 Cascade/MACC loop · X14 Mapping stubs · P04 Benchmarks

### Wave 3 — Ops & platform depth

P01 IoT · P03 Product footprints · P02/P14/Y10 Warehouses · P15 BI docs · P16 White-label · P17 i18n · P06 Carbon Trust · X07 Consolidation · X08 Engagement · X09 Procurement · X11 Embed · X12 SSE fan-out

### Wave 4 — Commercial + mobile + FI

P18–P21 Billing polish · B03–B06 Billing buildables · B02 Offline · B01 Mobile · Y03 Consultant billing · Y09 PCAF · Y05 Razorpay* · Y06 DPDP*

\*Y05/Y06 only after open decisions (INR/Razorpay, DPDP/Atlas region).

---

## AI — later only

**Do not implement AI in this wave.** All 8 features: [`AI_FEATURES_BACKLOG.md`](AI_FEATURES_BACKLOG.md).

---

## Out of scope

| Bucket       | Count | Items                                                                                                                                                                       |
| ------------ | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pay-plan     | 6     | EcoVadis API/CDN; ecoinvent/SimaPro; Salesforce; SAP S/4; NetSuite; Big4 audit APIs                                                                                         |
| Not possible | 5     | Become EcoVadis network; Sustainalytics-scale ratings; act as accredited certifier; replace SAP/Salesforce as SoR; Watershed-scale assured factor library without a license |

---

## Differentiator bets (while shipping the 51)

- Assurance Room + `/a/[token]`
- ABAC policy evaluator
- Honest quality (`missing`, never silent zero)
- India BRSR + GST path + consultancy multi-client
- Carbon Network + Supplier Scorecard (EcoVadis substitute)
- Transparent pricing + Trust center
