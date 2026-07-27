# Phase 4 — The Assurance Room

## Access model

| Surface                | Auth                                          |
| ---------------------- | --------------------------------------------- |
| `/dashboard/assurance` | Clerk + Membership (same as rest of app)      |
| `/a/[token]`           | Token only — **no** Membership `auditor` role |

`assuranceToken` is minted on publish alongside `shareToken`. Same expiry as the living-report share link. Token isolation: lookup is by `assuranceToken` + `status: published` only — never another org’s data.

## Evidence bind

Upload (`POST /api/evidence`) with `datapointId`:

1. Sets `evidence.linkedDatapoints`
2. Appends evidence id to `datapoint.evidence`
3. Writes `evidence.upload` audit

Without `datapointId`, evidence is stored but **unverified** for figure lineage.

Manual re-bind: `POST /api/app/evidence/rebind` `{ evidenceId, datapointId }` — Owner/Admin/Contributor; writes `evidence.rebind` audit.

Data UI: drop requires a saved datapoint `id`; otherwise asks to save first.

## Coverage / freshness

Additive fields on Evidence: `coverageStart`, `coverageEnd`.

| State    | When                             | UI                                            |
| -------- | -------------------------------- | --------------------------------------------- |
| unknown  | either date unset                | amber — “Coverage unknown” (never green pass) |
| mismatch | no overlap with reporting period | amber                                         |
| ok       | dates overlap period             | signal                                        |

## Lineage factors = pinned at publish

Auditor / Assurance Room resolve factors via:

1. `datapoint.factorId` if present **and** found in `snapshot.factorsUsed`, else
2. `snapshot.factorsUsed` entry matching `metricKey` among **pins only**

**Never** “latest emission-factor by metricKey” from the live registry.

On publish, `factorVersionsUsed` is populated from `snapshot.factorsUsed[].factorId`.

## Legacy unlinked evidence — backfill policy

- **No silent auto-link** of legacy files to figures.
- Soft matches via `extractedData.metricKey` alone are **not** verified.
- Optional **manual** re-bind (above) creates a proper bidirectional link + audit — only then “Evidence link verified”.
- Assurance Room shows explicit **“Evidence link unverified”** (`--rust`) when the bidirectional link is absent.

## Diff

`diffSnapshots` now includes factors (by factorId), evidence index (by sha256), and materiality narrative, in addition to scores/emissions. Diffs are computed from frozen snapshots only — snapshots are never mutated after publish.

## PDF

Factor appendix (section 03) already renders `snapshot.factorsUsed` — the same pins the Assurance Room uses.
