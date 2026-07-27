# Phase 3 — Frameworks + Materiality

## `datapointRef` ≡ `disclosureCode`

Payload field name remains `datapointRef` (no migration rename). In application TypeScript and UI copy, this value is the **disclosure code**. `lib/frameworks` exports `disclosureCode` / `disclosureCodeOf` as aliases so it is never mistaken for a missing field.

## Mapping table (Track A)

Reviewable source: [`src/lib/frameworks/mappings.ts`](../src/lib/frameworks/mappings.ts).

| Framework       | Disclosure code             | Satisfiable?                                | Notes                              |
| --------------- | --------------------------- | ------------------------------------------- | ---------------------------------- |
| CSRD_SET1       | E1-5_01                     | Yes (`required`, `contributionOnly: false`) | Total energy — derived             |
| CSRD_SET1       | E1-5_07 / 09 / 11 / 12 / 14 | Contribute only                             | Partial energy feeds               |
| CSRD_SIMPLIFIED | E1-5_01                     | Yes                                         | Beachhead                          |
| ISSB_S1 / S2    | placeholders                | Contribute only                             | Counsel pending                    |
| GRI             | GRI-302-1                   | Contribute only                             | Placeholder                        |
| EU_TAXONOMY     | TAX-elig-energy             | Contribute only                             | Eligibility stub — not alignment   |
| VSME            | VSME-E-energy               | Contribute only                             | Voluntary beachhead                |
| BRSR            | BRSR-P6-energy              | Contribute only                             | **Stub hook only** — depth pending |

Derived registry (`lib/derive/registry.ts`) keeps approved CSRD seed rows with matching `label` / `contributionOnly`. Product coverage prefers `FRAMEWORK_MAPPINGS`.

## Applicable frameworks

| Org posture                       | Frameworks shown                                  |
| --------------------------------- | ------------------------------------------------- |
| Voluntary (no mandatory deadline) | VSME, GRI                                         |
| CSRD_SET1 / CSRD_SIMPLIFIED       | that CSRD + ISSB_S1 + ISSB_S2 + GRI + EU_TAXONOMY |
| BRSR                              | BRSR + GRI                                        |

## Coverage states (quality-aware)

| State       | Rule                                                                                     |
| ----------- | ---------------------------------------------------------------------------------------- |
| Satisfied   | `required && !contributionOnly` and honest grade (not `estimated`, not `spend_estimate`) |
| Partial     | Data present but estimated / spend_estimate                                              |
| Contributes | Honest grade on contribution-only (or non-required) mapping                              |
| Gap         | Missing                                                                                  |

**Never** green “complete” from mere presence. Example: all energy inputs `estimated` → E1-5_01 is **partial** (≈0% satisfied), not satisfied.

## UI

- Data page: framework coverage panel + per-row “This figure contributes to” chips filtered by applicable frameworks.
- Chips use `.label-caps` / `.font-data` / tokens only.

## Materiality (Track B)

### Sector defaults

Reviewable heuristics in [`src/lib/materiality/sectorDefaults.ts`](../src/lib/materiality/sectorDefaults.ts), keyed by NACE letter (first letter of `organisations.sector`). Starting positions are **not** determinations — workshop shows `SECTOR_DEFAULTS_DISCLAIMER`.

### Topic `origin`

| Value       | Meaning                                                   |
| ----------- | --------------------------------------------------------- |
| `suggested` | Scores/rationale still match the sector starting position |
| `adjusted`  | Any score or rationale changed from the suggestion        |

Stored on each topic row; surfaced in the workshop as “Origin · suggested|adjusted”.

### Finalise

- Contributor / viewer cannot finalise (403).
- Finalise writes `writeAuditLog` action `materiality.finalised`.
- Client flips to locked immediately on success.
- Soft lock: draft updates rejected with 409 when status is already final.

### Snapshot / PDF / Living Report

[`buildSnapshot`](../src/lib/reports/buildSnapshot.ts) loads materiality **only** where `status: "final"`. Drafts never enter published reports. Living Report lists material topic codes from the snapshot points.
