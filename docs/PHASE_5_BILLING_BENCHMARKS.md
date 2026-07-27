# Phase 5 — Billing + Benchmarks

## Plan / caps (pricing unsigned)

Single source: [`src/lib/billing/plans.ts`](../src/lib/billing/plans.ts) `PLAN_LIMITS.priceEur`.

| Plan       | EUR / mo (display) | maxPeriods | maxSuppliers | maxClients | Clean PDF        |
| ---------- | ------------------ | ---------- | ------------ | ---------- | ---------------- |
| Free       | 0                  | 1          | 3            | 0          | No (watermarked) |
| Pro        | 49                 | ∞          | 10           | 0          | Yes              |
| Consultant | 199                | ∞          | 10           | 10         | Yes              |

**Pricing / currency needs human sign-off** (LAUNCH_DECISIONS #3 — EUR + Stripe provisional; INR/Razorpay deferred).

### Effective plan / `past_due`

[`resolveEffectivePlan`](../src/lib/billing/effectivePlan.ts): `past_due` / `unpaid` / `canceled` → entitlements as **Free**. Display `plan` may still say Pro for reactivation.

| State          | Publish     | PDF             |
| -------------- | ----------- | --------------- |
| Free           | Allowed     | Watermarked     |
| Pro active     | Allowed     | Clean           |
| Pro `past_due` | **Allowed** | **Watermarked** |

Publishing is never blocked by billing freeze.

### Server enforcement

- Period create: [`lib/org/period.ts`](../src/lib/org/period.ts); supplier wrapper delegates (no Free bypass).
- `maxClients` enforced on consultant invite.
- Watermark uses effective plan.
- Live Stripe Checkout / Portal require `CLEARESG_WS0_SIGNED_OFF=1`. Otherwise stub / `CLEARESG_DEV_BYPASS` only — never charges.
- Audit: `billing.plan_changed` on DEV bypass + Stripe webhook plan changes.

## Benchmark privacy / anonymity

| Rule         | Enforcement                                                                                |
| ------------ | ------------------------------------------------------------------------------------------ |
| n ≥ 8        | Compute + read; rows with n &lt; 8 deleted on recompute                                    |
| No min/max   | Schema and API expose only p25/p50/p75                                                     |
| Opt-out      | `benchmarkOptOut` — excluded from recompute; toggle + `benchmark.opt_out` / `opt_in` audit |
| Live cohorts | Gated by `CLEARESG_BENCHMARKS_LIVE=1` (LAUNCH_DECISIONS #5) until signed                   |
| Demo seed    | Only if `CLEARESG_BENCHMARK_DEMO=1` (off by default)                                       |
| As-of        | `computedAt` on each cohort row                                                            |

When unsure, show less.

## Recompute trigger

- On-demand: `POST /api/app/benchmarks/recompute` (admin/owner)
- Cron: `GET /api/cron/benchmarks` → recompute (`vercel.json`). **CRON_SECRET required in production.**

## Integration on-ramps

Spreadsheet import remains the default. Utility/ERP auto-fill is **scaffolded only** — see [`src/lib/integrations/utility.ts`](../src/lib/integrations/utility.ts). No live third-party credentials in this phase; never fabricate imported data. Any future auto-fill must set provenance honestly (not measured-by-default).

## Gates still unsigned

| Env                        | Purpose                               |
| -------------------------- | ------------------------------------- |
| `CLEARESG_WS0_SIGNED_OFF`  | Live paid Checkout / Portal           |
| `CLEARESG_BENCHMARKS_LIVE` | Publish real cohorts                  |
| `CLEARESG_BENCHMARK_DEMO`  | Fabricated demo cohort (dev only)     |
| `CLEARESG_DEV_BYPASS`      | Non-prod stub plan change (no charge) |
