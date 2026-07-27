# Phase 2 — Account-free Scope 3 pipeline

## Provenance model

Every Scope 3 contribution datapoint carries:

| Field                      | Values                                             | Meaning                                            |
| -------------------------- | -------------------------------------------------- | -------------------------------------------------- |
| `provenance`               | `supplier_primary` \| `spend_estimate` \| `manual` | Where the figure came from                         |
| `quality`                  | measured \| calculated \| estimated \| missing     | Measurement grade — **independent** of provenance  |
| `supplier` / `supplierKey` | relationship + sentinel string                     | Which supplier; `""` = no supplier                 |
| `factorId`                 | text                                               | Pinned EmissionFactor id when a factor was applied |

**Axes are separate:** a supplier-submitted `estimated_tco2e` is `provenance: supplier_primary` and **`quality: calculated`** unless the supplier checks “metered” (`is_metered`) → then `quality: measured`.

Spend×factor rows are `provenance: spend_estimate`, `quality: estimated`.

## Unique index

`{organisation, period, metricKey, supplierKey}` unique.

`supplierKey` is never null — empty string (`NO_SUPPLIER_KEY`) for org-level rows. MongoDB treats multiple nulls as distinct; the sentinel prevents silent duplicate org rows. See `src/lib/suppliers/supplierKey.test.ts`.

## How a response becomes a Scope 3 number

```
POST /api/s/[token]
  → validate token (exact match), rate limit, TTL
  → store submittedData on supplier (token remains valid for corrections)
  → reaggregateScope3Contributions(org, period)
       • submitted + estimated_tco2e → supplier_reported_tco2e row (primary)
       • supersede that supplier's spend_estimate (quality: missing + audit)
       • no response + annualSpend → supplier_spend_estimate_tco2e (estimated)
       • neither → gap (no row, never zero)
  → writeAuditLog(supplier.submit|resubmit) with reconstructable `after`
  → metricsAndCompositionFromDatapoints → calculate() → Runway / PDF / Living Report
```

## Supersession (fixes double-count)

Per `(org, period, supplier)`: if an active `supplier_primary` exists, that supplier’s `spend_estimate` is excluded from totals (row marked `quality: missing`). Composition helper also skips estimate when primary is present (defense in depth). Legacy org `supplier_spend_total` is dropped from calc metrics when contribution rows exist.

## Token lifecycle & security

- Entropy: 24 random bytes, base64url
- Scoped: exact `requestToken` match → one supplier → one org; `requestPeriod` bound at send
- TTL: 30 days; **corrections allowed** until expiry (not single-use)
- Rate limit: 12/hour per token+IP
- Isolation: token A cannot resolve supplier B / other org (see `tokenSecurity.test.ts`)
- Public audit `after`: `supplierId`, `tokenId`, `periodId`, `submittedAt`, `organisationId`, `values`, `isResubmit` (actor optional)

## Where provenance surfaces

- Runway emissions stack: quiet “X% supplier-verified” (`--signal`) vs spend estimate (`--amber`)
- Living Report + PDF: same proportion line under Scope 3

## Tests

```bash
pnpm exec vitest run src/lib/suppliers
pnpm test:calc
pnpm test:obligations
pnpm build
```
