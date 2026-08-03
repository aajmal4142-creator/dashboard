# ClearESG — AI Features Backlog

**Status:** Deferred. **Do not implement in the current 29-feature wave.**

**When to revisit:** After Waves 1–3 in [`COMPETITIVE_PLANNING_SHEET.md`](COMPETITIVE_PLANNING_SHEET.md) (that sheet now tracks **51** non-AI features, not the old incomplete 29).

**Count:** 8 AI features.

ClearESG has **zero** LLM / copilot usage in app code today. Rule-based anomaly detection (e.g. 3-sigma) is not AI for this backlog.

---

## Hard constraints (all AI work)

- Never invent emissions or metric numbers.
- Pure calc engine (`lib/calc`) stays I/O-free and authoritative.
- Missing data stays `quality: 'missing'` — never silent zero.
- Drafts and suggestions must **cite** datapoints, factors, or evidence.
- Honour Membership / `getCurrentContext()` on every AI action.
- Honour `prefers-reduced-motion` and existing editorial UX; no “Oops” copy.

---

## Backlog (8)

| ID   | Feature                             | Competitor examples        | Suggested approach                                                                          | Priority later | Effort |
| ---- | ----------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------- | -------------- | ------ |
| AI01 | AI data classification              | Greenly, Plan A, Watershed | Free-text / invoice line → suggested metric key + confidence; human confirm before write    | High           | M      |
| AI02 | AI anomaly / data-quality narrative | Greenly, IBM Envizi        | Explain rule-based or statistical flags in plain language; link to Metrics row              | High           | M      |
| AI03 | AI copilot chat                     | Greenly, Plan A, Workiva   | Chat over org inventory, gaps, “why did Scope 3 rise?”; grounded on datapoints/lineage only | High           | L      |
| AI04 | AI report authoring                 | Watershed, Workiva         | Draft ESRS/TCFD narrative **citing** datapoints; editor must accept/reject                  | High           | L      |
| AI05 | AI PDF / invoice ingestion          | Watershed                  | Extract activity candidates from PDF/invoice; dry-run before datapoint write                | Medium         | L      |
| AI06 | AI supplier questionnaire assist    | Greenly, EcoVadis-class UX | Suggest answers from existing Metrics for buyer/supplier questionnaires; no auto-submit     | Medium         | M      |
| AI07 | Predictive / ML forecasting         | Greenly, Watershed         | Pathways beyond current linear scenarios; show uncertainty; never overwrite actuals         | Medium         | L      |
| AI08 | AI evidence matching for assurance  | Workiva-class              | Match uploaded evidence to checklist items; auditor confirms                                | Medium         | M      |

---

## Suggested later order (after the 29)

1. **AI01** Classification + **AI02** Narrative (data quality first)
2. **AI04** Cited report draft + **AI03** Copilot (disclosure acceleration)
3. **AI05** PDF ingest + **AI06** Questionnaire assist
4. **AI08** Evidence matching + **AI07** ML forecast

---

## Out of this backlog

- Paid EcoVadis / ecoinvent / ERP connectors — see out-of-scope in the planning sheet.
- Replacing `lib/calc` with model-estimated totals — **forbidden**.

---

## Link back

Implementation focus (non-AI): [`COMPETITIVE_PLANNING_SHEET.md`](COMPETITIVE_PLANNING_SHEET.md)
