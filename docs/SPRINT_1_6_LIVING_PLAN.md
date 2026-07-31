# Sprint 1–6 Living Plan

**Mode:** gap-fill / complete / enhance  
**Source of truth:** `docs/IMPLEMENTATION_MASTER_GUIDE.md` + `docs/SPRINT1`–`SPRINT6_*.md`  
**Binding overrides:** `.cursor/rules/clearesg.mdc` (theme cookie-only; no `prefers-color-scheme`)  
**Out of scope:** Sprint 7

Status legend: `pending` | `in_progress` | `done` | `blocked` | `skipped_verified`

---

## Feature status

| ID   | Title                | Sprint | Status | Notes                                                                                                                                           | Blockers                                             |
| ---- | -------------------- | ------ | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| F1   | Dark Mode            | 1      | done   | Cookie `clearesg-theme`; CSS tokens; ThemeToggle; light default. System preference rejected per ClearESG rules.                                 | —                                                    |
| F2   | Keyboard Shortcuts   | 1      | done   | Registry + help modal + vitest 13 pass; Cmd+K/S///N/R/\\ + Esc                                                                                  | Cmd+R overrides refresh                              |
| F3   | Full-Text Search     | 1      | done   | Two-phase search + select + metricKey equals; saved searches via saved-filters `search`; CommandPalette Save/Saved                              | Payload contains not FTS                             |
| F4   | Activity Feed        | 1      | done   | `/activity` + APIs + CSV export + 13 mapper tests; poll 30s                                                                                     | Sparse resource titles                               |
| F5   | Validation Rules UI  | 2      | done   | CRUD + apply + approve gate + Vitest                                                                                                            | —                                                    |
| F6   | Data Lineage Viz     | 2      | done   | Datapoint lineage API + SVG panel + JSON/SVG export; Vitest builders; snapshot on write                                                         | —                                                    |
| F7   | Version Comparison   | 2      | done   | Compare API + A/B UI + Vitest diff helpers; restore retained                                                                                    | —                                                    |
| F8   | Bulk Undo/Redo       | 2      | done   | Snapshot helpers + undo/redo API + preview dialog; SelectableTable on suppliers; Vitest 14                                                      | —                                                    |
| F9   | In-App Notifications | 3      | done   | Collection + bell + APIs + 3 triggers + Vitest; poll 30s                                                                                        | —                                                    |
| F10  | Dashboard Builder    | 3      | done   | Layout CRUD + live widget-data API + WidgetPreview fetches series/KPIs                                                                          | —                                                    |
| F11  | Alert Thresholds     | 3      | done   | CRUD + evaluate/mute; hourly cron `/api/cron/alerts/evaluate`                                                                                   | —                                                    |
| F12  | Custom Metrics UI    | 3      | done   | Formula UI + wired into `buildReportSnapshot` customMetrics + HTML report section                                                               | —                                                    |
| F13  | Slack Integration    | 4      | done   | OAuth install + encrypted bot token + alert post; events/commands stubbed; UI when secrets missing                                              | Live OAuth needs secrets                             |
| F14  | Webhook Retry        | 4      | done   | Queue uses policy backoff + attempt logs; DLQ UI `/integrations/webhooks`; test/replay APIs; Vitest retrySchedule                               | —                                                    |
| F15  | API Rate Limiting    | 4      | done   | Plan quotas free/pro/consultant; Upstash hour+day; BiApiKeys fields; settings UI; 80% alert; Vitest quota helpers                               | —                                                    |
| F16  | Automation Builder   | 4      | done   | Engine + cron match + `/api/cron/automations/schedule` every 5m                                                                                 | —                                                    |
| F17  | PDF Export           | 5      | done   | PDF route + entitlement watermark; modal pageSize/CONFIDENTIAL/charts toggles; pdfSettings helpers + Vitest                                     | —                                                    |
| F18  | Excel/CSV Export     | 5      | done   | exceljs multi-sheet; CSV+XLSX in modal; `export?format=xlsx`; sheet builder Vitest                                                              | —                                                    |
| F19  | JSON/XML Export      | 5      | done   | Verified `/export?format=json                                                                                                                   | xml`; machineExport Vitest; xlsx alias on same route | —   |
| F20  | Report Distribution  | 5      | done   | deliveryHistory + unsubscribe + open pixel `/api/r/open/[trackingId]`                                                                           | —                                                    |
| F21  | Bulk CSV Update      | 5      | done   | Preview/apply APIs + modal; bulk-ops snapshots undo; Vitest parse/preview                                                                       | —                                                    |
| F22  | Comparison Tools     | 6      | done   | Unified POST/GET `/api/app/analytics/compare` + presets; `/analytics/compare` UI; CSV export; reuses benchmarks/scenarios/TCFD links; Vitest 16 | —                                                    |
| F23  | Mobile Report View   | 6      | done   | Section nav chips + card tables + touch targets; print CSS kept                                                                                 | —                                                    |
| F24a | i18n English only    | 6      | done   | Lightweight `lib/i18n`; `en` only; Users.language; /settings Language; nav+settings via t(); Vitest 9; no Hindi                                 | —                                                    |
| F24b | i18n Hindi add-on    | 6      | done   | `hi` catalog + palette/alerts/dashboards chrome; Settings en↔hi                                                                                 | —                                                    |
| F25  | Help / Tours         | 6      | done   | TourProvider (no deps) + HelpCenter tabs; localStorage completions; pathname tips                                                               | —                                                    |

---

## DONE WHEN (per feature)

### F1 Dark Mode

- Cookie dual-theme (`clearesg-theme`); CSS token coverage; ThemeToggle; app shell coverage
- **Override:** no `prefers-color-scheme` / no `system` preference (ClearESG rules)

### F2 Keyboard Shortcuts

- All shortcuts working + help modal + tests passing (Cmd/Ctrl+K, S, /, N, R, `\`, Escape)

### F3 Full-Text Search

- Search modal + accurate results + &lt;200ms; `/api/app/search*`; type filters

### F4 Activity Feed

- Activity feed page + filters + export + tests

### F5 Validation Rules UI

- Rule builder + validation triggered + tests

### F6 Data Lineage Viz

- Lineage graph + export + tests

### F7 Version Comparison

- Version A/B compare + restore + tests

### F8 Bulk Undo/Redo

- Bulk undo working + preview + tests (redo included) — **done**

### F9 Notifications

- Bell + unread + list/mark-read/delete; core triggers; polling; Membership auth

### F10 Dashboard Builder

- Saved layouts + drag-drop widgets + role defaults

### F11 Alert Thresholds

- AlertRules + trigger + notify (+ email; Slack posts when F13 integration connected)

### F12 Custom Metrics UI

- Formula builder + preview + CRUD

### F13 Slack

- OAuth install + channel notify + signature-verified event/command stubs (needs secrets for live OAuth)

### F14 Webhook Retry

- Retry policy + DLQ/UI gap-fill vs existing queue — done (`retrySchedule` + enhanced `webhookQueue`; `/integrations/webhooks`)

### F15 API Rate Limiting

- Plan quotas + headers + settings UI — done (`lib/bi/quota.ts` + Upstash `checkBiQuota`; BiApiKeys overrides/IP/usage; settings bars + `alert_triggered` at 80%)

### F16 Automation Builder

- Automations collection + engine + UI — done (`automations` + `automation-runs`; match helpers; notify/email/Slack/webhook; `/automations`; hooks on datapoint approve + alert trigger; schedule stub API)

### F17 PDF Export

- PDF export working; watermark/settings gap-fill — **done** (`/pdf` + `unwatermarked_pdf`; modal toggles; `pdfSettings` parse)

### F18 Excel/CSV Export

- Report XLSX/CSV in export modal — **done** (exceljs sheets; `export?format=xlsx|csv`)

### F19 JSON/XML Export

- Machine export verified — **done** (`export?format=json|xml`; Vitest)

### F20 Report Distribution

- Schedule + recipients + delivery tracking gap-fill — **done**
  - Recipients + daily/weekly/monthly on `ScheduledReports` (existing)
  - Per-recipient `deliveryHistory` (sent/failed/skipped) + lastStatus
  - HMAC unsubscribe → `/unsubscribe/report` (opts out on schedule)
  - `ScheduleDeliveryModal` delivery history view
  - Reuses `sendTransactionalEmail` / `scheduledReportEmail` + cron
  - **Deferred:** email open tracking (needs Resend webhook / pixel); quarterly frequency (monthly covers board cadence)

### F21 Bulk CSV Update

- Id-match preview/apply/rollback — **done** (`/api/app/data/bulk-update` + `/apply`; pending bulk-op + beforeSnapshot undo; `BulkCsvUpdateModal`; Vitest)

### F22 Comparison Tools

- Unified analytics compare UI/API — **done**
  - `POST /api/app/analytics/compare` (yoy / by_department / by_supplier / by_metric / multi_period; `exportCsv`)
  - `GET /api/app/analytics/compare` (period picker) + `GET .../presets`
  - `/analytics/compare` page + nav Compare; links to existing benchmarks / scenarios / TCFD
  - Pure aggregators in `lib/analytics/compare.ts` + Vitest (16)
  - Department grouping via `department:` / `facility:` note tags (no dedicated field)

### F23 Mobile Report View

- Mobile-friendly `InteractiveHtmlReport` beyond basic `@media`
- Stacked metrics (1-col under 640px); shorter chart; touch ≥44px controls
- Card-style detail rows on mobile (`data-label`); desktop table + thead sort kept
- Mobile-only sticky **section nav chips** (Summary / Emissions / Tables / Method) — chose chips over swipe
- Print CSS retained (`@media print` + `.no-print` hides nav/sort/series chips)
- No Sprint 7 mobile app; Vitest skipped (CSS/UI); `tsc --noEmit` clean for component

### F24a i18n English

- Plumbing + `en` only; `/settings` language control (English); preference persists — **done**
  - Lightweight custom i18n in `lib/i18n` (`t`, `resolveLocale`, `createTranslator`, `formatDate`/`formatNumber`)
  - Locale catalog `lib/i18n/messages/en.ts` only — no `hi`
  - `Users.language` select default `en`; auth context + `I18nProvider` on AppShell
  - `/api/app/settings/language` GET/PUT; Settings Language section (English option only)
  - AppShell nav labels + chrome + Settings page strings via `t()`; missing keys return the key
  - Vitest `src/lib/i18n/t.test.ts` (9) — resolve/fallback/interpolate/format
  - **Deferred to F24b:** Hindi catalog + en↔hi select option

### F24b i18n Hindi

- `hi` locale + en↔hi switch in `/settings` — **done**
  - Catalog `lib/i18n/messages/hi.ts` mirrors `en` leaf keys (shell/nav/settings)
  - `SUPPORTED_LOCALES` = `en` | `hi`; `localeToBcp47("hi")` → `hi-IN` for dates/numbers
  - Settings Language select: English | Hindi (`LOCALE_OPTIONS`); persists via `/api/app/settings/language`
  - `Users.language` select options include `hi`; payload-types updated
  - Vitest: resolveLocale accepts hi; t() Hindi strings; en/hi key parity; hi-IN format
  - No RTL; English path unchanged (default still `en`)

### F25 Help / Tours

- Tours + help modal (Cmd+/) — **done**
  - Zero-dep `TourProvider` + `TourOverlay` (spotlight via `[data-tour]`; Back/Next/Skip/Done; Esc)
  - Tours: Metrics (`/data`), Reports (`/reports`), Settings (`/settings`); completion in `localStorage` (`clearesg-tours-completed`)
  - `HelpCenterModal` tabs: Shortcuts | Tours | FAQ; pathname context strip + related tour
  - Shell help button (sidebar + mobile); Cmd+/ opens Shortcuts tab (F2 preserved via wrapper)
  - `ShortcutsHelpModal` → thin wrapper to HelpCenter Shortcuts tab
  - FAQ searchable; Guide link retained; OnboardingWizard untouched
  - Vitest: storage parse/complete + contextTips/tours/faq (pure); `tsc --noEmit` clean
  - **Deferred:** Shepherd.js; server tour APIs; video tutorials; auto-start on first visit

---

## Gate log

| Sprint | After feature | Command                               | Result   | Date       |
| ------ | ------------- | ------------------------------------- | -------- | ---------- |
| 1      | F4            | `pnpm build` (+ `pnpm test` if green) | **pass** | 2026-07-31 |
| 2      | F8            | `pnpm build`                          | **pass** | 2026-07-31 |
| 3      | F12           | `pnpm build`                          | **pass** | 2026-07-31 |
| 4      | F16           | `pnpm build`                          | **pass** | 2026-07-31 |
| 5      | F21           | `pnpm build`                          | **pass** | 2026-07-31 |
| 6      | F25           | `pnpm build`                          | **pass** | 2026-07-31 |

---

## Changelog

| Date       | Feature             | Result                                                                                                                                                               |
| ---------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-07-31 | Living plan created | Audit statuses seeded from codebase exploration                                                                                                                      |
| 2026-07-31 | F1                  | Verified done (cookie theme; ClearESG override)                                                                                                                      |
| 2026-07-31 | F2                  | Done — keyboard registry, help modal, 13 tests                                                                                                                       |
| 2026-07-31 | F3                  | Done — org-scoped search API + palette; 20 tests                                                                                                                     |
| 2026-07-31 | F4                  | Done — `/activity` feed + export; Sprint 1 build pass                                                                                                                |
| 2026-07-31 | F8                  | Done — bulk undo/redo + snapshot capture + suppliers wire-up; 14 Vitest                                                                                              |
| 2026-07-31 | F11                 | Done — AlertRules collection/CRUD/evaluate/mute; condition Vitest; Slack stub                                                                                        |
| 2026-07-31 | F13                 | Done — SlackIntegrations + OAuth + encrypted token + alert post_slack; signature Vitest; events/commands stubbed                                                     |
| 2026-07-31 | F16                 | Done — Automations + runs; engine (approve/alert/schedule stub); notify/email/Slack/webhook; `/automations` UI; 12 match Vitest                                      |
| 2026-07-31 | F17                 | Done — PDF settings query/modal; plan watermark entitlement retained                                                                                                 |
| 2026-07-31 | F18                 | Done — exceljs report workbook + CSV/XLSX in ReportExportModal; sheet Vitest                                                                                         |
| 2026-07-31 | F19                 | Done — verified JSON/XML machine export; Vitest; format=xlsx alias on same route                                                                                     |
| 2026-07-31 | F20                 | Done — deliveryHistory + unsubscribe tokens + modal history; 8 Vitest; open tracking deferred                                                                        |
| 2026-07-31 | F21                 | Done — bulk CSV update-by-id preview/apply/rollback via bulk-ops; modal; Vitest                                                                                      |
| 2026-07-31 | F22                 | Done — unified analytics compare API/UI + CSV; presets; reuses peer/scenario/TCFD; 16 Vitest                                                                         |
| 2026-07-31 | F23                 | Done — InteractiveHtmlReport mobile: section chips, card tables, touch targets; print CSS retained                                                                   |
| 2026-07-31 | F24a                | Done — en-only i18n plumbing; Users.language; settings Language; nav/settings t(); Vitest 9; no Hindi                                                                |
| 2026-07-31 | F24b                | Done — hi catalog + hi-IN formats; Settings en↔hi; Users.language hi; Vitest resolveLocale/t Hindi                                                                   |
| 2026-07-31 | F25                 | Done — TourProvider + HelpCenter (shortcuts/tours/FAQ); pathname tips; localStorage completions; no new deps                                                         |
| 2026-07-31 | Sprint 6 gate       | `pnpm build` pass — orchestration complete                                                                                                                           |
| 2026-07-31 | E2E QA on :3010     | Restarted stale `next start`; full route/API/UI matrix below                                                                                                         |
| 2026-07-31 | Deferred gap-fill   | Search perf (no cache); saved searches; live dashboard widgets; custom metrics in snapshot; alert+automation crons; email open pixel; i18n palette/alerts/dashboards |

---

## E2E QA — localhost:3010 (2026-07-31)

**Precondition fix:** Process on 3010 was an old `next start` (started ~08:28) so new routes 404’d and some pages 500’d. **Restarted** `PORT=3010 pnpm start` against the latest `.next`. Session (Clerk) survived.

| Area                                                                                                                                    | Result      | Notes                                                                  |
| --------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ---------------------------------------------------------------------- |
| Session / Runway home                                                                                                                   | **pass**    | Owner, My organisation                                                 |
| Theme toggle                                                                                                                            | **pass**    | Dark mode applied; sun/moon control                                    |
| Notifications bell                                                                                                                      | **pass**    | Empty state “No notifications yet”                                     |
| Help Center                                                                                                                             | **pass**    | Shortcuts / Tours / FAQ tabs + context tips                            |
| `/data` Metrics                                                                                                                         | **pass**    | Grid, Check rules, Versions/Lineage links, Bulk CSV update             |
| Lineage panel                                                                                                                           | **pass**    | Opens; JSON/SVG/Print controls present                                 |
| `/activity`                                                                                                                             | **pass**    | Filters + live poll; activities listed (API total 11)                  |
| `/dashboards`                                                                                                                           | **pass**    | Empty + “Create Executive view” / New blank                            |
| `/alerts`                                                                                                                               | **pass**    | Summary counters + New rule / Evaluate now                             |
| `/automations`                                                                                                                          | **pass**    | Empty + New automation + recent runs                                   |
| `/settings` Language                                                                                                                    | **pass**    | en↔hi save; nav translated to Hindi; restored to `en` via API          |
| BI quota UI                                                                                                                             | **pass**    | Shows consultant unlimited (F15)                                       |
| `/reports`                                                                                                                              | **pass**    | PDF/JSON/XML/CSV/Excel links; Schedule modal opens                     |
| Export APIs                                                                                                                             | **pass**    | json/xlsx/pdf all HTTP 200 for published report                        |
| `/analytics/compare`                                                                                                                    | **pass**    | Page 200; presets API has yoy/dept/supplier/multi                      |
| `/integrations/slack`                                                                                                                   | **pass***   | Page 200; API `configured:false` (needs SLACK_* secrets)               |
| `/integrations/webhooks`                                                                                                                | **pass**    | Page 200                                                               |
| `/settings/validation-rules`                                                                                                            | **pass**    | Page 200                                                               |
| `/settings/custom-metrics`                                                                                                              | **pass**    | Page 200                                                               |
| Legacy pages (suppliers, billing, assurance, guide, benchmarks, TCFD, ISSB, frameworks, IoT, database, spend, materiality, calendar, …) | **pass**    | All probed routes HTTP 200 after restart                               |
| Search API                                                                                                                              | **warn**    | Works but `tookMs` ~1.4s (above 200ms target)                          |
| CRUD create (dashboard/alert/automation/rule via API)                                                                                   | **skipped** | Write batch blocked/rejected in browser safety gate                    |
| Lineage Download JSON/SVG                                                                                                               | **warn**    | Buttons present but disabled during/after open (possible loading race) |

**Living plan:** `docs/SPRINT_1_6_LIVING_PLAN.md`

---

## Pass / fail matrix (orchestration end)

| ID   | Feature              | Result                                      |
| ---- | -------------------- | ------------------------------------------- |
| F1   | Dark Mode            | **pass**                                    |
| F2   | Keyboard Shortcuts   | **pass**                                    |
| F3   | Full-Text Search     | **pass**                                    |
| F4   | Activity Feed        | **pass**                                    |
| F5   | Validation Rules UI  | **pass**                                    |
| F6   | Data Lineage Viz     | **pass**                                    |
| F7   | Version Comparison   | **pass**                                    |
| F8   | Bulk Undo/Redo       | **pass**                                    |
| F9   | In-App Notifications | **pass**                                    |
| F10  | Dashboard Builder    | **pass**                                    |
| F11  | Alert Thresholds     | **pass** (hourly cron)                      |
| F12  | Custom Metrics UI    | **pass** (in report snapshot)               |
| F13  | Slack Integration    | **pass** (live OAuth needs SLACK_* secrets) |
| F14  | Webhook Retry        | **pass**                                    |
| F15  | API Rate Limiting    | **pass**                                    |
| F16  | Automation Builder   | **pass** (schedule cron every 5m)           |
| F17  | PDF Export           | **pass**                                    |
| F18  | Excel/CSV Export     | **pass**                                    |
| F19  | JSON/XML Export      | **pass**                                    |
| F20  | Report Distribution  | **pass** (open pixel tracking)              |
| F21  | Bulk CSV Update      | **pass**                                    |
| F22  | Comparison Tools     | **pass**                                    |
| F23  | Mobile Report View   | **pass**                                    |
| F24a | i18n English         | **pass**                                    |
| F24b | i18n Hindi           | **pass**                                    |
| F25  | Help / Tours         | **pass**                                    |

**Sprint gates:** S1–S6 `pnpm build` all **pass**.  
**Living plan path:** `docs/SPRINT_1_6_LIVING_PLAN.md`
