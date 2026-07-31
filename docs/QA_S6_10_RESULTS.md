# QA Results — S6–S10 (resumed 31 Jul 2026)

Org: **My organisation** (`6a6110dabaea9eb9de9e3f7b`) · plan `consultant` / `active`  
User: `aajmal4142@gmail.com` · Server: http://localhost:3010 (rebuilt after fixes)

## Fixes applied this session

| Fix                                                                         | File                                                                     | Status                                                             |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| Share/embed URLs used stale `:3000` when app ran on `:3010`                 | `src/lib/reports/htmlReportShare.ts` — prefer request origin             | Fixed in source; rebuild done. Re-mint a token to confirm `:3010`. |
| Living report `/r/[token]` 500 — immutability hook blocked `viewCount` bump | `src/collections/Reports.ts` — reject only when locked fields **change** | **Verified** — `/r/BDBu2X30kA7oMdRD6DSXG2xk` → **200**             |

## Pass / fail matrix

### Sprint 6

| ID   | Case                           | Result   | Notes                                                                       |
| ---- | ------------------------------ | -------- | --------------------------------------------------------------------------- |
| S6.1 | Intensity metrics page         | **PASS** | Denominators 30M / 80 / 12k / 4500. Warns empty factor registry (expected). |
| S6.1 | Home Intensity card            | **PASS** | Shows 0 tCO2e/$M; Detail → intensity.                                       |
| S6.2 | Regulatory calendar            | **PASS** | 8 applicable, 2 overdue; Monthly + By urgency; overdue listed first.        |
| S6.2 | Export checklist PDF/Excel     | **PASS** | Menu opens (PDF / Excel).                                                   |
| S6.2 | Export iCal                    | **PASS** | Control present.                                                            |
| S6.3 | Scheduled report deliveries UI | **PASS** | Dialog: recipients, freq, format, TZ. Create not exercised (write gate).    |
| S6.4 | Trend forecasting tab          | **PASS** | Empty-state single message (no double copy). Assumptions form present.      |
| S6.5 | Realtime “Last updated”        | **PASS** | Seen live before rebuild; after restart shows “—” until SSE reconnects.     |

### Sprint 7

| ID   | Case                     | Result   | Notes                                                                           |
| ---- | ------------------------ | -------- | ------------------------------------------------------------------------------- |
| S7.1 | Accounting connectors    | **PASS** | Connect / Category mapping / Sync / History; QB/Xero/Wave; Xero pending listed. |
| S7.2 | SBTi tracking            | **PASS** | 1 target on track; baseline/current/target; Mark submitted; pathway note.       |
| S7.3 | Decarbonization pathways | **PASS** | Analytics → Pathways; Create pathway; empty state OK.                           |
| S7.3 | Scenarios tab            | **PASS** | Create scenario form (type, reduction, scopes, timeline).                       |

### Sprint 8

| ID   | Case                 | Result   | Notes                                                                                       |
| ---- | -------------------- | -------- | ------------------------------------------------------------------------------------------- |
| S8.1 | Supply chain SVG map | **PASS** | 10 nodes; tier split; filters; Build network / Export CSV.                                  |
| S8.2 | ISO 14064 checklist  | **PASS** | 0/30; Part 1 (18) + Part 2; Assign verifier.                                                |
| S8.3 | Supplier engagement  | **PASS** | Loads suppliers after hydrate (2: Ajmal / ajmal). Consent + send flows not fully exercised. |

### Sprint 9

| ID   | Case                    | Result      | Notes                                                                                                          |
| ---- | ----------------------- | ----------- | -------------------------------------------------------------------------------------------------------------- |
| S9.1 | Green taxonomy          | **PASS**    | Empty state + Start assessment wizard entry.                                                                   |
| S9.2 | Cat 1 tier emissions    | **PARTIAL** | Page loads; totals 0. Supply-chain map shows 10 nodes / 0.1 tCO2e — aggregation mismatch vs map (investigate). |
| S9.3 | Multi-org consolidation | **PASS**    | Hierarchy settings + Reports “Include subsidiaries”; preview period 2026, root only.                           |

### Sprint 10

| ID    | Case                             | Result               | Notes                                                                                                  |
| ----- | -------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------ |
| S10.1 | Interactive / living HTML report | **PASS** (after fix) | Was 500; now 200.                                                                                      |
| S10.2 | IoT gateways UI                  | **PASS**             | Register form (MQTT/HTTP/webhook/direct/cloud). Register submit not completed (viewport / write gate). |
| S10.3 | Share + embed + QR               | **PASS** (UI)        | Token minted; Public link + Embed. Embed URL had `:3000` — origin fix shipped; re-mint to confirm.     |
| S10.4 | JSON / XML / CSV export          | **PASS**             | All three return 200 with correct content-types.                                                       |
| S10.5 | Multi-framework PDF              | **PASS**             | Download PDF → `application/pdf` 200.                                                                  |
| S10.6 | Schedule / webhooks surface      | **PASS**             | Schedule dialog present. Webhook register not deep-tested this pass.                                   |

### Setup / shell

| Case                      | Result   | Notes                                                                               |
| ------------------------- | -------- | ----------------------------------------------------------------------------------- |
| Consultant plan on org    | **PASS** | Via `set-org-plan` / qa-prepare earlier.                                            |
| Billing UI “subscription” | **N/A**  | Shows “No active subscription” — Stripe catalog separate from `organisations.plan`. |
| Nav coverage              | **PASS** | Analytics, Reg calendar, Accounting, IoT gateways present.                          |
| `pnpm build`              | **PASS** | Clean after fixes.                                                                  |

## Known gaps / not fully exercised

1. Create flows (gateway register, schedule create, taxonomy wizard complete, pathway create) — UI present; writes blocked by auto-review or not finished.
2. Cat 1 breakdown vs supply-chain map totals disagree (map has nodes; Cat 1 page shows 0).
3. Factor registry empty → intensity/SBTi scenarios warn; seed factors for full calc QA.
4. Plan switching free→pro→consultant UI gating not re-run this session (org left on consultant).

## Server

`PORT=3010 pnpm start` after rebuild — Ready.
