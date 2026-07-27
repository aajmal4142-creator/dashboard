# Phase 1 — Obligation Engine

**Status:** thresholds and filing dates are **placeholders for human / counsel review** before production. Product voice is always “likely in scope,” never legal determination.

## Flow

```
Onboarding baseline (country, headcount, revenueBand)
        │
        ▼
lib/obligations.deriveObligations()   ← pure, deterministic
        │
        ▼
persistDerivedObligations()           ← Payload upsert + audit
        │
        ├── sticky manual rows skipped (unless force re-derive)
        └── baselineDrift nudge when figures changed under a manual override
        │
        ▼
compliance-obligations (existing collection)
        │
        ├── Onboarding “opening gift” (API returns obligation payload)
        └── Runway countdown (nearest filingDeadline; null = voluntary)
```

## Rules table (human-readable)

| Rule                            | When                                                                                             | Outcome                              | Confidence             | Deadline                                      |
| ------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------ | ---------------------- | --------------------------------------------- |
| **SEBI BRSR (if listed)**       | `country === IN`                                                                                 | `wave: brsr_listed`, `BRSR`, FY2025  | **needs_confirmation** | Placeholder `2026-06-30`                      |
| **CSRD Wave 2**                 | Country in `IE` / `DE` / `NL` **and** (≥250 employees **or** revenue band `50_250m` / `gt_250m`) | `wave: 2`, `CSRD_SIMPLIFIED`, FY2027 | **needs_confirmation** | Placeholder `2028-06-30`                      |
| **Voluntary (EU under size)**   | EU-operating country but under size proxy                                                        | `wave: other`, `VSME`                | derived                | **null** — never invent                       |
| **Voluntary (GB / US / other)** | Not IN, not EU-operating set                                                                     | `wave: other`, `VSME`                | derived                | **null** — never invent; buyers may still ask |

### Explicit non-rules

- **Size bands do not determine BRSR.** Reason copy states that BRSR applies to **listed** entities and we cannot confirm listing from headcount/revenue.
- **GB / US are never routed to `brsr_supply` on size alone.** Non-Indian firms are not in the SEBI cascade by virtue of size.
- **Consultant invite +180d** provisional dates are always `confidence: needs_confirmation`, never `derived`.

### Cited basis (placeholders — verify)

- CSRD large-undertaking proxy: ≥250 employees or ≥€50m turnover (mirrors in-product educational checker; Omnibus / delegated acts may revise).
- Wave 2 calendar used here matches the product’s prior ship (`FY2027` → mid-2028 filing). Confirm against current law and the org’s fiscal year end.
- BRSR listed calendar (`FY2025` / mid-2026) is a placeholder for SEBI top-listed filers — **listing must be confirmed**.

## Schema fields added

| Field              | Purpose                                                      |
| ------------------ | ------------------------------------------------------------ |
| `derivationReason` | Plain-language why                                           |
| `confidence`       | `derived` \| `needs_confirmation`                            |
| `source`           | `engine` \| `manual` (manual is sticky)                      |
| `confirmedAt`      | When Owner/Admin confirmed/overrode                          |
| `derivedInputs`    | Snapshot: country, headcount, revenueBand, asOf              |
| `filingDeadline`   | Now **optional** — null = voluntary / not in mandatory scope |

## Auth

- Onboarding obligation write: Owner/Admin for existing orgs; new users without an org may create one.
- Confirm / override / force re-derive: `POST /api/app/obligations` — Owner/Admin only.
- Audit actions: `obligation.derived`, `obligation.confirm`, `obligation.override` via existing `writeAuditLog`.

## Sticky overrides

Manual overrides (`source: manual`) are **not** silently overwritten when baseline changes. Runway shows: “Figures changed — re-derive?” Owner/Admin may force re-derive.

## Tests

```bash
pnpm test:obligations
pnpm test:calc
```

Covers CSRD in-scope, BRSR listing caveat, voluntary (no deadline), headcount boundary, sticky skip.
