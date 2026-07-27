# ClearESG — Workstream 0 launch decisions

> Status: **engineering provisional**. Production paid billing and publish require written
> sign-off below (or env `CLEARESG_WS0_SIGNED_OFF=1` + `CLEARESG_DISCLAIMER_REVIEWED=1`).
> Last updated: 2026-07-21.

## Sign-off checklist

| #   | Decision                  | Provisional stance (until human signs)                                                                                               | Signed |
| --- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| 1   | Emission factor licensing | Open/redistributable factors only (DEFRA-class). Do not redistribute IEA/restricted EPA without a licence.                           | [ ]    |
| 2   | Atlas region (DPDP)       | Default `eu-west-1` / EU Atlas until India residency is confirmed. **Do not provision India prod cluster until this row is signed.** | [ ]    |
| 3   | Currency / payments       | Soft-launch **EUR + Stripe**. INR + Razorpay deferred until India GTM. Pricing page must state EUR.                                  | [ ]    |
| 4   | Assurance disclaimer      | Use `REPORT_DISCLAIMER` in `src/lib/reports/types.ts`. Lawyer review required before production publish.                             | [ ]    |
| 5   | Benchmark consent         | Aggregate anonymised cohort stats with ToS opt-out. Opt-out field: org `benchmarkOptOut` (see Organisations).                        | [ ]    |

## Env gates (enforced in code)

- `CLEARESG_WS0_SIGNED_OFF=1` — required for Stripe Checkout / paid tier in production.
- `CLEARESG_DISCLAIMER_REVIEWED=1` — required to publish reports (Output section G).
- `CLEARESG_ATLAS_REGION` — recorded region string (e.g. `eu-west-1`); must match WS0 #2 before prod Atlas.
- `CLEARESG_DEV_BYPASS=1` — local only; refused when `NODE_ENV=production` or `VERCEL_ENV=production`.

## Human action

Print or PR-merge this file with checkboxes marked and names/dates under Signed before enabling live paid keys.
