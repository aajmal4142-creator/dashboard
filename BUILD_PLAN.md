# ClearESG — Full Build Plan

> **How to use this file**
> This is the single source of truth for the build. Work through it **phase by phase, in order**.
> After each phase: run `pnpm build`, fix all type errors, commit with the stated message, then update
> the Progress Ledger at the bottom of this file (change `[ ]` to `[x]` and add a one-line note).
> Do not skip ahead. Do not start Phase N+1 until Phase N builds clean and is committed.
> If a decision in this file conflicts with your instinct, follow this file and note the objection in the ledger.
>
> **Status key:** Ledger `[x]` = phase **surface shipped in-repo**. It does **not** mean production-ready
> or §1 fully deep. After phases 0–14, continue with **§12 Remaining work** and keep **§11 Open decisions**
> unresolved until a human decides. Reconcile the ledger whenever reality drifts from the notes.

---

## 0. Product Context

**ClearESG** is an ESG compliance platform for small/mid-sized companies and the ESG consultants who serve them.

The thesis: the money is not in "being green." It is in **mandatory reporting law**. The EU's CSRD pulls
~49,000–50,000 companies into required disclosure from 2025–2026. India's SEBI BRSR binds the top listed firms
and is cascading down their supply chains. Demand is regulation-driven, so it survives political swings in ESG
sentiment. Companies do not buy this because they want to; they buy it because a deadline exists.

**Who we sell to (two audiences, one platform):**

1. **SME (direct)** — a 40–400 person company that just learned it must report, either because it fell into CSRD
   scope or because a large customer sent them a supplier questionnaire. Has no sustainability team. The CFO or
   an ops manager got handed this. They are frightened and time-poor. They want to be told exactly what to do.
2. **Consultant (multi-tenant)** — a boutique ESG advisory with 5–40 SME clients, currently drowning in
   spreadsheets. They want to run all clients in one place, white-label the output, and bill for it.
   **The consultant is the growth engine.** Every consultant brings their whole client book. Optimise for them.

**Beachhead:** India/BRSR and the SME tier. Enterprise (Workiva, IBM Envizi, Persefoni, Sphera) is crowded,
sells six-figure contracts, and takes six months to implement. They are not our competitor — they are our
credibility ceiling. We win where they will not go.

**Positioning line:** _Enterprise ESG software costs six figures and takes six months. ClearESG gets you
audit-ready this quarter._

---

## 1. Competitive Gap Analysis — What We Build That They Don't

This section is the reason the product wins. Every feature below is a deliberate answer to a hole in the market.
Do not treat these as optional polish. They are the product.

| #   | Gap in the market                                                                                                           | What ClearESG does                                                                                                                                                                                                                                                                                                 | Why it wins                                                                                                                                                     |
| --- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Everyone sells a dashboard. Nobody sells a deadline.** Competitors show you data. They don't tell you what happens next.  | **Compliance Runway** — the home screen is not a dashboard, it's a countdown. "You are 87 days from your first CSRD filing. 14 of 31 datapoints collected. At your current rate you will miss it by 22 days."                                                                                                      | Reframes the product from "reporting tool" to "the thing that stops you getting fined." Anxiety is the buying trigger; we address it directly.                  |
| 2   | **Scope 3 is where everyone gives up.** Tools either ignore it or dump a spreadsheet on you.                                | **Supplier Request Chains** — generate a tokenised public link per supplier, they fill a 6-field form with no account, data flows straight into your Scope 3. Track response rates. Auto-chase.                                                                                                                    | Scope 3 is 70–90% of most footprints and the #1 reason SMEs fail an audit. Nobody has made it _easy_. This is the single strongest moat.                        |
| 3   | **Double materiality is a consultancy service, not a feature.** CSRD legally requires it; software makes you do it in Word. | **Guided Double Materiality Workshop** — structured impact × financial scoring across ESRS topics, drag-to-position matrix, auto-generates the assessment narrative and the audit trail of who decided what and when.                                                                                              | This is a €15–40k consulting engagement. Shipping it as software is a category-defining move for the SME tier.                                                  |
| 4   | **Auditors reject reports because there's no evidence trail.** Tools export a PDF and wish you luck.                        | **Evidence Vault** — every single number is clickable back to the uploaded invoice/bill/certificate, with uploader, timestamp, and an immutable hash. Any figure without evidence is visibly flagged.                                                                                                              | Turns "we made a report" into "we made a _defensible_ report." This is what assurance actually costs money for.                                                 |
| 5   | **Emission factors are hardcoded and stale.** Users have no idea if the number is right or which year's factor was used.    | **Versioned Factor Registry** — every factor is a database row with source (DEFRA/EPA/IEA/CEA India), publication year, region, unit, and validity window. Reports pin the factor version used. Recalculate on new factor release with a visible diff.                                                             | Auditors ask "which factor, which year, which source?" Every competitor at this price point fails this question. This is defensibility as a feature.            |
| 6   | **CSRD vs BRSR are treated as separate products.** Nobody serves companies caught by both.                                  | **Enter Once, Map Everywhere** — one canonical datapoint model; frameworks are _views_ over it. Enter electricity once, it satisfies ESRS E1-6 and BRSR Principle 6 simultaneously.                                                                                                                                | Indian subsidiaries of EU parents are a real, growing, badly-served segment. Also future-proofs for ISSB/IFRS S2, CDP, GRI.                                     |
| 7   | **Consultant tooling is an afterthought.** They get "team seats," not a workflow.                                           | **Consultant Command Centre** — all clients in one table sorted by deadline risk, bulk-nudge, reusable data templates by sector, full white-label (their logo/colours/domain on the client portal and the PDF), per-client billing view.                                                                           | The consultant is a distribution channel disguised as a customer. Serve them properly and they onboard 20 SMEs for us.                                          |
| 8   | **Onboarding takes weeks and starts with a blank form.**                                                                    | **60-Second Baseline** — answer 6 questions (sector, headcount, country, revenue band, sites, own/lease), get an _estimated_ footprint and score immediately from sector intensity benchmarks, clearly marked ESTIMATED. Then replace estimates with real data one at a time, watching the confidence meter climb. | Time-to-value goes from weeks to under a minute. The estimate creates an itch: nobody can leave a number marked "estimated" alone. This drives activation.      |
| 9   | **No competitor tells you how you compare.**                                                                                | **Sector Benchmarking** — anonymised percentile vs same-sector, same-size cohort. "Your energy intensity is worse than 71% of manufacturers your size." Requires n≥8 in cohort before displaying.                                                                                                                  | The only feature that gets better as we get more customers — a genuine data network effect. Also the most screenshot-able, most shareable thing in the product. |
| 10  | **Reports are a dead PDF.**                                                                                                 | **Living Report** — versioned, shareable via signed link with an expiry, viewable as a branded microsite with the evidence trail attached, plus the PDF and the XBRL-ready structured export.                                                                                                                      | Buyers/banks/customers asking for your ESG data get a link, not an email attachment. Every share is a marketing impression.                                     |
| 11  | **Data quality is invisible.**                                                                                              | **Confidence Score** — every metric carries measured / calculated / estimated / missing, and the report shows an overall data quality percentage.                                                                                                                                                                  | Auditors _love_ this. It is also honest, which is the brand.                                                                                                    |
| 12  | **Nobody explains WHY the number moved.**                                                                                   | **Narrative Engine** — deterministic, template-based plain-English explanations of every score and every change. "Your E score fell 6 points because diesel use rose 31% while headcount stayed flat."                                                                                                             | Non-experts cannot act on a number. They can act on a sentence.                                                                                                 |

**Anti-features — deliberately NOT building:**

- Full-fat carbon accounting for heavy industry (that's Sphera/Persefoni, we lose)
- Real-time IoT sensor ingestion (wrong segment)
- Live assurance marketplace v1 (later, needs auditor supply)
- An AI chatbot that guesses regulation (liability; the Copilot is scoped and cited only)

---

## 2. Non-Negotiable Technical Decisions

Locked. Do not deviate.

| Layer           | Choice                                                                                   | Notes                                                                                    |
| --------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Framework       | **Next.js 16, App Router, TypeScript strict**                                            | Server Components by default. `"use client"` only at interactive leaves.                 |
| CMS/Admin/ORM   | **Payload CMS 3**                                                                        | Runs natively inside the Next app (`(payload)` route group). Not a separate service.     |
| Database        | **MongoDB** via `@payloadcms/db-mongodb`                                                 | Atlas. Never a free M0 tier for anything real — a prior project lost collections on M0.  |
| Auth            | **Clerk**                                                                                | Clerk owns identity. Payload owns authorisation. Sync via webhook. Details in Phase 2.   |
| UI              | **shadcn/ui + Tailwind v4**                                                              | `@theme inline` referencing CSS custom properties so white-labelling works via CSS vars. |
| Animation       | **Motion (`motion/react`)**                                                              | The successor to Framer Motion.                                                          |
| Charts          | **Recharts**                                                                             | Themed via the same CSS vars.                                                            |
| Package manager | **pnpm**                                                                                 |                                                                                          |
| Validation      | **Zod** — single schema, shared client + server                                          |                                                                                          |
| Forms           | **react-hook-form** + zodResolver                                                        |                                                                                          |
| Server state    | **TanStack Query** for client-fetched lists only. Server Components for everything else. |                                                                                          |
| PDF             | **React-PDF (`@react-pdf/renderer`)** rendered in a Node route handler                   | NOT html2canvas. Must be vector, selectable, accessible.                                 |
| Email           | **Resend** + React Email                                                                 |                                                                                          |
| Payments        | **Stripe** — Checkout + Billing Portal + webhooks                                        |                                                                                          |
| Rate limiting   | **Upstash Redis** on all public/unauthed endpoints                                       |                                                                                          |
| File storage    | **UploadThing** or S3-compatible via `@payloadcms/storage-s3`                            | Evidence files.                                                                          |
| Testing         | **Vitest** (unit — calc engine is non-negotiable coverage) + **Playwright** (e2e)        |                                                                                          |
| Deploy          | **Vercel**                                                                               |                                                                                          |

**Node 20+. pnpm. `strict: true`. No `any` — if you reach for it, model the type properly.**

---

## 3. Design Direction

The brief: high-class, heavily animated, and it must be loved more than the competition. Competition here is
enterprise SaaS — Workiva and Persefoni look like 2016 Salesforce. Greenly and Plan A are the modern-startup
default: white, rounded, soft-green, Inter, blob illustrations. **Both are what we are not.**

### The concept: _Editorial_

The Instrument concept — achromatic chrome, colour only for data — executed correctly and read as unfinished
rather than restrained. The buyer is a frightened CFO, not a designer. The core artefact is a report filed with
a regulator and shared with banks and buyers. **Authority, not austerity.**

ClearESG’s visual language is a well-made annual report or a serious financial newspaper. Warm, dense,
typographic, confident. Colour is promoted to chrome. Enterprise competitors are cold; startup competitors are
white-and-soft-green. We are neither. The Gauge survives — it moves from lab equipment to a printed instrument
on good paper.

### Fonts

Via `next/font` — remove Instrument Serif, Geist, Geist Mono:

- **Display + headings:** `Fraunces` (variable). Use the opsz axis. Weight 400–600.
  `font-variation-settings: "SOFT" 30, "WONK" 1` on display sizes only.
- **Body/UI:** `Inter Tight` (variable). Tighter than Inter, more editorial.
- **Data:** `JetBrains Mono`. Warmer than Geist Mono, unmistakably data.
  `font-variant-numeric: tabular-nums slashed-zero` always.

Scale: 12 / 14 / 16 / 18 / 22 / 28 / 40 / 56 / 80 / 112.
Body 17/1.65. Measure 66ch body, 58ch marketing prose.
Fraunces tracking: 40px → -0.01em, 56px → -0.02em, 80px+ → -0.03em.
Labels: 12px, uppercase, 0.08em, weight 600, `--ink-muted`.

### Tokens — dual theme, every token pairs

Both themes are first-class. Neither is “the dark version of” the other. CSS custom properties on
`[data-theme="light"]` and `[data-theme="dark"]`, mapped through Tailwind v4 `@theme inline`.
**Zero hex in components** — hex only in `globals.css` (exception: white-label `--accent` injection).

**LIGHT (default — the report)**

```
--canvas:        #FBF9F5   warm cream, not white
--surface-1:     #FFFFFF   raised panels
--surface-2:     #F5F2EC   recessed wells, table zebra
--ink:           #1A1714   warm near-black, body text
--ink-muted:     #6B635A   secondary text, labels
--rule:          #E0DAD0   hairlines, borders
--rule-strong:   #C4BBAE   emphasis rules
```

**DARK (the terminal)**

```
--canvas:        #14120F   warm near-black — NOT blue-black
--surface-1:     #1C1916
--surface-2:     #100E0C
--ink:           #F0EBE3
--ink-muted:     #9A9188
--rule:          #322D27
--rule-strong:   #4A443C
```

**BRAND — chrome colour, both themes**

```
--accent:        #7A2E2E   oxblood — buttons, links, active nav, emphasis rules, PDF cover
--accent-hover:  #8F3838
--accent-quiet:  #7A2E2E at 8%   backgrounds, active row tint
```

**DATA — louder than chrome, both themes** (adjust lightness per theme only if contrast fails 4.5:1)

```
--signal:        #0E7C4A   good / on-track / verified
--amber:         #B87309   estimated / at-risk
--rust:          #B03A2E   gap / overdue / missing
--cobalt:        #2C5AA0   benchmark cohort / informational
```

Theme toggle in the app shell. Persist to a cookie, read server-side, set `data-theme` on `<html>` before paint —
no flash. **Cream (`light`) is the forced primary default** — never infer dark from
`prefers-color-scheme` (that re-introduced the unfinished black canvas). Dark is secondary
and opt-in via the toggle only. White-label consultant colour overrides `--accent`
only, never the data colours.

### Surface & material

- Elevation via warmth and rules, not shadow. `--surface-1` on `--canvas` with a 1px `--rule` border.
- Floating elements: soft warm shadow — light `0 12px 32px -8px rgba(26,23,20,0.14)`, dark
  `0 12px 32px -8px rgba(0,0,0,0.6)`.
- Inputs recessed: `--surface-2` fill, 1px `--rule`, no inner shadow.
- Radius: 6px panels, 4px inputs/buttons, 2px chips.
- Paper grain: fixed root overlay, inline SVG `feTurbulence` (baseFrequency 0.9, numOctaves 4), opacity 0.02
  light / 0.03 dark, `mix-blend-mode: multiply` light / `overlay` dark.
- Rules do structural work: 1px `--rule` under section headings; 2px `--accent` rule above page titles.

### Layout

Editorial density: generous type, tight gutters, 8px grid. Whitespace is report margin —
tighten section rhythm so gaps never read as “content failed to load.”

- **App:** 2-column where content allows — primary 66ch, secondary rail 280px (metadata, evidence, factors),
  separated by a 1px `--rule`, not a card. Runway: Gauge leads the data rail above the fold.
- **Marketing home (Option A):** two-column hero above the fold — left masthead (oxblood mono
  eyebrow → Fraunces headline → Inter Tight subhead → CTAs), right printed-dial Gauge.
  Structural oxblood rule draws (~600ms) above the hero on load. Long-form sections below
  use a single 58ch measure, centred.
- **Tables:** no card wrapper, full-bleed, hairline rules. Header 12px uppercase `--ink-muted` with 2px
  `--rule-strong` beneath. Numerics right-aligned, JetBrains Mono, tabular. Zebra via `--surface-2`.

### The `<Metric>` primitive

`<Metric value={4.2} unit="tCO2e" />` — integer at full `--ink` weight 500; decimal at `--ink-muted` 0.85em;
unit as 12px uppercase `--ink-muted` with 0.4em left margin. JetBrains Mono, tabular, slashed zero.
**Zero raw number renders** anywhere — every score, tonne, date, percentage, delta, ID.

### Signature element: **The Gauge**

Three placements only: marketing hero (leads the fold), dashboard, PDF page 1. SVG.
Printed dial on good paper — no glow, no chrome speedometer bezel.

- Dish: `--surface-2` circle, 1px `--dial-ring` (`#E4DFD4` light / warm ring on dark).
- 240° arc opening downward. Thin `--dial-ring` track. Fill ~3.5px band colour
  (signal/amber/rust by score — signal green when on track).
- Engraved ticks inside: minor every 5, major every 20 with JetBrains Mono labels in `--ink`.
- Needle: tapered 7px→1.5px, **oxblood `--accent`**, hairline `--canvas` spine; hub inner
  disc also `--accent`.
- Ghost needle: previous period, `--rule-strong`, 1px, opacity 0.6, static.
- Centre readout: `<Metric>`, 112px JetBrains Mono weight 500, below the hub.
- Dark theme: invert to warm-paper-on-black (dial ring / dish warmer; needle stays oxblood).

Motion (the one bravura moment): underdamped needle spring `{ stiffness: 180, damping: 12, mass: 1.2 }` with
visible overshoot; arc trails by 40ms; ticks stagger opacity; readout counts and lands 100ms after needle rest.
`prefers-reduced-motion` → final position, full arc, no count.
**Oscillation is a SPEC — do not damp it.**

### Motion — printed-report assembly

One metaphor: **a regulatory report being printed and assembled live.** Motion reads as
craft and authority, never startup flourish. If an animation does not reinforce “serious
document being produced,” cut it.

`lib/motion.ts` is the motion layer: three public springs (`spring` / `springSoft` /
`springSnap`), authoritative ink easing (`inkEase`), page-layer delays, hero staging, and
hooks — `useInkReveal`, `useRuleDraw`, `useCountUp`, `useMotionSafe`,
`usePrefersReducedMotion`. Components compose from `@/components/motion` primitives
(`Assemble`, `InkReveal`, `RuleDraw`, `InkStagger`, `PageMasthead`) — not one-off
transitions. Zero per-component spring objects outside Gauge.

**Five behaviours (scroll-driven, one-shot — never re-trigger on scroll-back):**

1. **Rules draw themselves.** Structural rules animate via `scaleX` / `scaleY` from origin,
   400–600ms, on scroll-enter (or mount for chrome). Rules arrive **before** the content
   they frame.
2. **Metrics count up.** Every `<Metric>` mechanically tick-counts to its value on enter
   (JetBrains Mono, tabular — no layout shift). Printed counter rolling into place.
3. **Ink-settle reveals.** Text/section blocks enter with short opacity + 8–12px rise,
   staggered per child. Feels like ink hitting paper, not slide-in. Easing is authoritative
   (`inkEase`), not bouncy — except the Gauge needle.
4. **Gauge arrival.** On enter, the dial needle sweeps past target and settles with its
   underdamped oscillation (SPEC, not a bug). Arc trails ~40ms; readout counts ~100ms after
   needle rest. Hero moment — stage deliberately via `playDelay` / `heroStage`.
5. **Hero print order.** On load: oxblood rule draws (~600ms) → masthead ink-settles →
   hero Gauge sweeps (right column, above the fold) → primary controls land.
   Gauge leads the composition — never buried below the fold.

**Choreography**

- Assembly order is always **chrome → structure → data** (`pageLayer`: 0 / 40ms / 80ms).
- Stagger children; never simultaneous.
- Hover on rows/panels: `--accent-quiet` tint + left 2px `--accent` bar (`scaleY`,
  `springSnap`). No lift / scale / shadow.
- Numbers never fade — they count.
- `prefers-reduced-motion`: all of the above collapse to instant final state. No exceptions.
- Forbidden: parallax-for-its-own-sake, infinite loops, decorative particles, theme-flashing,
  glassmorphism, blobs, cursor followers, card tilt, scroll-jacking, gradient meshes,
  floating 3D, soft green.

**PDF:** always static light cover. Motion is app-only; the PDF is the finished print.

### PDF (React-PDF)

Always renders **LIGHT**, regardless of app theme. Cover: `--canvas`, 2px `--accent` rule at top, Fraunces
56px title, Gauge at final position, org/period in JetBrains Mono. Flagship artefact for banks, buyers, auditors.

### Copy voice

Direct, technical, calm, never cute. Never apologises. Never says "Oops!" Never uses an exclamation mark.
Never narrates the aesthetic — the page shows cream, oxblood, and the dial; copy does not
describe “warm paper” or “precision instrument.”
Errors state what happened and what to do: _"Electricity data missing for Q3. Upload a bill or enter kWh
manually."_ Empty states are instructions, not illustrations: _"No suppliers yet. Add one to start collecting
Scope 3 data."_ Actions are verbs and keep their name through the whole flow — the button that says **Publish**
produces a toast that says **Published**.

---

## 4. Data Model (Payload Collections)

The whole product depends on getting this right. **The core insight: `Datapoint` is canonical and
framework-agnostic. Frameworks are _views_ over datapoints, never storage.** Never write a CSRD field and a
BRSR field for the same underlying fact.

```
Organisation      name, slug, type(company|consultancy), sector(NACE), country, employeeCount,
                  revenueBand, fiscalYearEnd, parentOrg?(rel:self), brand{logo,primaryColor,domain},
                  stripeCustomerId, plan(free|pro|consultant), subscriptionStatus, onboardedAt

Membership        user(rel:Users), organisation(rel), role(owner|admin|contributor|viewer),
                  status(active|invited|revoked), invitedBy, invitedAt, acceptedAt
                  -- ALL access resolves through this. Login ≠ access. Never read role off Clerk.

Users             clerkId(unique,index), email, firstName, lastName, avatarUrl, lastSeenAt
                  -- mirror only. Clerk is source of truth for identity. Payload local auth DISABLED.

ReportingPeriod   organisation(rel), label("FY2025"), startDate, endDate,
                  status(open|locked|published), lockedAt, lockedBy
                  -- locking freezes datapoints. Published reports must be immutable.

Datapoint         organisation(rel), period(rel), metricKey(index), value(number),
                  unit, quality(measured|calculated|estimated|missing),
                  evidence(rel:Evidence, hasMany), source(manual|import|supplier|estimate|api),
                  enteredBy, enteredAt, note
                  -- compound index: {organisation, period, metricKey}

MetricDefinition  key(unique), label, description, unit, category(E|S|G),
                  inputType(number|boolean|select), helpText, exampleSource,
                  frameworkMappings[{framework, datapointRef, required}]
                  -- SEEDED, not user-created. This IS the enter-once-map-everywhere layer.

EmissionFactor    key, label, value(number), unit("kgCO2e/kWh"), scope(1|2|3),
                  source(DEFRA|EPA|IEA|CEA_India|GHGProtocol), sourceUrl, publicationYear,
                  region(ISO2|"GLOBAL"), validFrom, validUntil, supersededBy(rel:self)
                  -- NEVER hardcode a factor. Every calculation resolves a row and pins its ID.

Evidence          organisation(rel), file(upload), filename, mimeType, size,
                  sha256(index), uploadedBy, uploadedAt, linkedDatapoints(rel,hasMany),
                  extractedData(json), ocrStatus(pending|done|failed)

Supplier          organisation(rel), name, contactEmail, category(spendCategory),
                  annualSpend, requestToken(unique,index), requestStatus(not_sent|sent|opened|
                  submitted|declined), sentAt, respondedAt, submittedData(json), reminderCount

MaterialityAssessment  organisation(rel), period(rel), status(draft|final),
                  topics[{esrsTopic, impactScore(0-5), financialScore(0-5), rationale,
                  decidedBy, decidedAt}], matrixSnapshot(json), finalisedAt

Report            organisation(rel), period(rel), framework(CSRD|BRSR|GRI|CUSTOM),
                  version(int), status(draft|published), scores{overall,e,s,g},
                  emissions{scope1,scope2,scope3}, dataQualityPct, factorVersionsUsed[rel],
                  pdfUrl, shareToken(unique), shareExpiresAt, publishedAt, publishedBy
                  -- version increments, never overwrite. A published report is immutable forever.

AuditLog          organisation(rel), actor(rel:Users), action, entityType, entityId,
                  before(json), after(json), ip, userAgent, createdAt
                  -- append-only. No update, no delete hooks. This is what auditors read.

BenchmarkStat     sector, sizeBand, metricKey, period, p25, p50, p75, cohortSize
                  -- computed nightly. NEVER expose if cohortSize < 8.
```

**Access control — implement as Payload `access` functions on every collection:**

- Every read/write filters by `organisation` ∈ user's active Memberships. No exceptions.
- Consultancy orgs see child orgs via `parentOrg`. One level deep only.
- `viewer` cannot write. `contributor` writes Datapoints/Evidence only. `admin` everything but billing +
  member removal. `owner` everything.
- `AuditLog`: create-only, read for admin+, **update/delete denied for everyone including admins.**
- Locked periods reject Datapoint writes at the collection hook, not the UI.

---

## 5. The Calculation Engine

Lives in `lib/calc/`. **Pure functions. Zero I/O. Zero framework imports. 100% unit test coverage — this is the
one place where that's mandatory.** If the maths is wrong the company gets fined and we get sued.

```ts
// lib/calc/types.ts — everything is explicit, nothing is implicit
export type Quality = "measured" | "calculated" | "estimated" | "missing";
export interface Measured {
  value: number;
  unit: string;
  quality: Quality;
  factorId?: string;
}
export interface CalcInput {
  /* all datapoints for a period, keyed by metricKey */
}
export interface CalcResult {
  scores: { overall: number; e: number; s: number; g: number };
  emissions: {
    scope1: Measured;
    scope2: Measured;
    scope3: Measured;
    total: Measured;
  };
  dataQualityPct: number;
  factorsUsed: Array<{
    factorId: string;
    key: string;
    value: number;
    source: string;
    year: number;
  }>;
  breakdown: Array<{
    component: string;
    contribution: number;
    explanation: string;
  }>;
  band: "strong" | "moderate" | "early";
}
```

**Formulas — carried over from the agreed v1 spec. Implement EXACTLY. Do not "improve" them.**

```
Scope 2  = electricity_kWh × factor(grid, region, year) / 1000        → tCO2e
Scope 1  = (diesel_L × factor(diesel) + gas_m3 × factor(gas)) / 1000  → tCO2e
Scope 3  = Σ(supplier_spend × spendFactor(category))  +  Σ(direct supplier-reported)

E = clamp(0, 100,  100 − max(0, carbonPerEmployee − 1) × 12 + renewablePct × 0.15)
S = clamp(0, 100,  min(55, diversityPct / 40 × 55) + max(0, 35 − injuryRate × 8) + trainingBonus)
G = clamp(0, 100,  boardIndependencePct × 0.5 + policyToggleScore)
Overall = round((E + S + G) / 3)
Band: ≥70 strong | 45–69 moderate | <45 early
```

**Hard rules:**

1. **Factors are resolved, never hardcoded.** `resolveFactor(key, region, year)` reads the registry.
   The 0.71 / 2.68 / 1.90 values from the v1 prototype become **seed rows** with source and year, not constants
   in the code. If no factor matches, throw — never silently fall back.
2. **Every result pins `factorsUsed`.** A published report must be reproducible in 5 years.
3. **Missing data never becomes zero.** Zero is a measurement. Missing is `quality: 'missing'` and it lowers
   `dataQualityPct` and is visibly flagged. This distinction is the whole credibility of the product.
4. **`breakdown[]` powers the Narrative Engine.** Every component states its own contribution and a
   template-generated sentence. Deterministic strings, no LLM. e.g.
   `"Diesel contributed 4.2 tCO2e (31% of Scope 1)."`
5. Golden-file tests: `__fixtures__/` holds 12 known input→output cases including all edge cases
   (zero employees, missing everything, 100% renewable, extreme outliers). These must never drift.

---

## 6. Build Phases

Work top to bottom. Commit after each. Update the ledger.

### PHASE 0 — Foundation

- `pnpm create next-app@latest` → TS, App Router, Tailwind, src dir, `@/*` alias.
- Install Payload 3 + `@payloadcms/db-mongodb` + `@payloadcms/richtext-lexical`. Wire the `(payload)` route
  group per Payload 3 Next-native install. Confirm `/admin` renders.
- `shadcn@latest init`. Add: button, input, card, table, dialog, sheet, dropdown-menu, select, tabs, badge,
  toast(sonner), form, tooltip, skeleton, separator, avatar, progress, alert, popover, command, checkbox,
  radio-group, textarea, calendar, scroll-area.
- Tailwind v4 `@theme inline` mapping every token from §3 to CSS custom properties on `:root` and `[data-theme]`.
  **Every colour in the entire app references a var. Zero hex values in components.** This is what makes
  white-labelling work later.
- Fonts via `next/font`: Instrument Serif, Geist, Geist Mono. Preload, `display: swap`.
- `lib/motion.ts` — three springs, ink/rule transitions, `useInkReveal` / `useRuleDraw` /
  `useCountUp` / `useMotionSafe`; compose via `@/components/motion`.
- ESLint strict, Prettier, Husky + lint-staged, Vitest, Playwright.
- `.env.example` with every var named and commented.
- **Commit:** `chore: scaffold next16 + payload3 + shadcn + design tokens`

### PHASE 1 — Data model

- Every collection from §4 with full field configs, indexes, and validation.
- Access control functions on all of them. Write the Membership resolver in `lib/access/` once, use everywhere.
- Seed script `pnpm seed`:
  - ~60 `MetricDefinition` rows covering E/S/G with real framework mappings
  - `EmissionFactor` rows: DEFRA 2024 (UK), EPA 2024 (US), IEA 2024 (EU avg), CEA 2024 (India grid), plus
    spend-based Scope 3 factors by category. **Each with a real sourceUrl.**
  - 3 demo orgs (SME manufacturer, SME services, consultancy with 4 child clients) with a full year of
    realistic datapoints — the seed must produce a product that looks alive on first run.
- Vitest on access control: a user from org A must not read org B. Prove it.
- **Commit:** `feat: payload collections, access control, seed data`

### PHASE 2 — Auth

Clerk owns identity. Payload owns authorisation. They meet in exactly two places.

- Clerk `<ClerkProvider>`, middleware, sign-in/up pages **styled with our tokens** (Clerk `appearance` prop —
  do not ship default Clerk purple).
- Payload `Users`: local auth **disabled**. `clerkId` unique+indexed.
- **Webhook** `/api/webhooks/clerk` — verify with svix, handle `user.created|updated|deleted`, upsert the
  Payload `Users` mirror. Idempotent.
- **`getCurrentContext()`** in `lib/auth/` — the single function every server component and route handler calls.
  Returns `{ user, memberships, activeOrg, role }` or redirects. React `cache()` wrapped so it's free to call
  repeatedly in one render. **Nothing else reads auth state.**
- Org switcher in the shell reading Memberships. Active org in a signed httpOnly cookie, **re-validated against
  Membership on every request** — never trust the cookie alone.
- Invite flow: `owner|admin` invites by email → Membership `status: invited` → Resend email → accept links
  Clerk user to the pending Membership.
- **Commit:** `feat: clerk auth, membership authorisation, org switching, invites`

### PHASE 3 — Calculation engine

- `lib/calc/` exactly per §5. Pure. No imports from `next` or `payload`.
- `resolveFactor()` with the region/year fallback ladder: exact region+year → region+latest → GLOBAL+year →
  **throw**. Never silently default.
- The 12 golden fixtures. `pnpm test:calc` must be green and must stay green forever.
- Narrative Engine `lib/narrative/` — deterministic templates keyed off `breakdown[]`. Include the delta
  narratives ("fell 6 points because…") which need the previous period as an argument.
- **Commit:** `feat: calculation engine + factor registry + narrative engine, 100% covered`

### PHASE 4 — Onboarding: the 60-Second Baseline

The activation moment. Get this wrong and nothing else matters.

- 6 questions, one per screen, spring-transitioned horizontally. Progress as a hairline bar, not a stepper.
- Sector intensity benchmarks (seeded) → instant estimated footprint + estimated Gauge reading.
- **The Gauge sweeps for the first time here.** This is the moment they decide if they like us.
- Every estimated figure carries an Amber `ESTIMATED` chip and a "Replace with real data" affordance.
- Ends on the Compliance Runway with real deadline maths from their country + sector + fiscal year end.
- **Commit:** `feat: 60-second baseline onboarding`

### PHASE 5 — The Compliance Runway (home)

Not a dashboard. A countdown.

- Days-to-deadline, monospace, 96px, counts up on load.
- Datapoints collected / required, with the **projected miss** calculation from current velocity.
- The Gauge with the ghost needle for previous period.
- Next 3 actions, ranked by (impact on score × ease). Each is one click to the exact form field.
- Scope 1/2/3 stacked bar that draws in.
- Recent activity from AuditLog.
- **Commit:** `feat: compliance runway dashboard`

### PHASE 6 — Data collection

- The metric wizard: grouped by category, autosave on blur (optimistic, with rollback on failure), inline unit
  conversion (kWh/MWh/GJ), and a **quality selector on every field** — the user must actively say whether a
  number is measured or estimated.
- Evidence upload: drag-drop, sha256 on the client before upload, link to datapoints, preview inline.
- CSV import with column mapping UI + dry-run diff before commit.
- **Every field shows its framework mappings** — "this satisfies ESRS E1-6 and BRSR P6 Q1." This is the
  enter-once-map-everywhere promise made visible, and it's the moment users understand why we're different.
- **Commit:** `feat: data collection wizard, evidence vault, csv import`

### PHASE 7 — Supplier chains (the moat)

- Supplier CRUD + spend categories.
- **Public tokenised form** `/s/[token]` — no account, 6 fields, mobile-first, ~90 seconds to complete,
  rate-limited hard, token single-use with expiry, branded to the _requesting_ org.
- Request email via Resend + React Email. Auto-reminder at day 7 and 14. Response-rate tracking.
- Submitted data → Datapoints with `source: 'supplier'`, `quality: 'measured'`, flows into Scope 3.
- Coverage meter: "% of spend covered by supplier-reported data" — the number that gets them past an audit.
- **Commit:** `feat: supplier request chains + public collection form`

### PHASE 8 — Double materiality

- ESRS topic list seeded.
- Guided scoring: impact severity/scope/irremediability + financial magnitude/likelihood, per topic.
- Drag-to-position matrix (Motion drag + spring). Quadrant thresholds. Material topics highlighted in Signal.
- Auto-generated narrative + full decision audit trail (who scored what, when, why).
- Export as report appendix.
- **Commit:** `feat: double materiality workshop`

### PHASE 9 — Reports

- React-PDF templates: CSRD and BRSR. Cover with the Gauge, exec summary, scores, emissions, data quality,
  materiality matrix, evidence index, factor versions appendix. **Vector, selectable, tagged, brand-themed.**
- Living Report: share token → branded microsite, optional expiry, view analytics.
- Versioning: publish snapshots everything and locks it. Immutable. Diff view between versions.
- Structured export (JSON + CSV) shaped for XBRL later.
- **Commit:** `feat: pdf reports, living report sharing, versioning`

### PHASE 10 — Consultant Command Centre

- Client table sorted by deadline risk, with per-client Gauge sparkline.
- Bulk actions: nudge, assign template, export all.
- Sector templates: reusable datapoint sets.
- **White-label:** logo, primary colour, custom domain → injected as CSS vars server-side on `<html>`.
  Applies to portal AND PDF.
- Per-client billing view.
- **Commit:** `feat: consultant command centre + white-label`

### PHASE 11 — Benchmarking

- Nightly job → BenchmarkStat.
- **Hard gate: never render a cohort with n < 8.** Enforce in the query, not the component.
- Percentile display with a distribution curve, the user's position marked.
- "How to improve" links to the highest-leverage actions.
- **Commit:** `feat: sector benchmarking`

### PHASE 12 — Billing

- Stripe Checkout, Billing Portal, webhooks (`checkout.session.completed`, `customer.subscription.*`,
  `invoice.payment_failed`).
- Plans: **Free** €0 (1 org, 1 period, watermarked PDF) / **Pro** €49/mo (unlimited periods, full PDF,
  10 suppliers, evidence vault) / **Consultant** €199/mo (10 clients, white-label, bulk, +€15/client after).
- Entitlement checks server-side in `lib/billing/can()`. Never gate in the UI only.
- Usage meters in-app before the limit bites.
- **Commit:** `feat: stripe billing + entitlements`

### PHASE 13 — Marketing site + SEO/AEO

See §7. This is where revenue actually comes from.

- **Commit:** `feat: marketing site, programmatic seo, aeo`

### PHASE 14 — Hardening

- Playwright: signup → onboard → enter data → invite supplier → publish report → share link.
- Rate limits on every public endpoint.
- Sentry. Structured logging. Health check.
- a11y: axe clean, keyboard-complete, focus visible, contrast ≥ 4.5:1, reduced-motion honoured everywhere.
- Lighthouse ≥ 95 across the board on marketing pages.
- **Commit:** `chore: hardening, e2e, a11y, perf`

---

## 7. SEO & AEO

Two different jobs. **SEO** = rank in Google. **AEO** (Answer Engine Optimisation) = get _cited_ by ChatGPT,
Claude, Perplexity, and Google AI Overviews. Our buyer is a panicking CFO who asks an LLM _"do I have to comply
with CSRD?"_ before they ever open Google. **If we are not the answer to that question, we lose the deal before
it exists.** AEO is the higher-leverage of the two for this product. Build for it deliberately.

### Technical SEO — the floor

- Metadata API on every route. Unique title + description. Never a template default.
- `opengraph-image.tsx` per route — dynamic OG images rendered with `ImageResponse`, in our tokens, showing
  real content (e.g. the Gauge with that page's number).
- `sitemap.ts` dynamic (includes every programmatic page), `robots.ts`.
- Canonicals on everything. `hreflang` for en-GB / en-IN — different regulation, genuinely different pages, not
  a translation.
- **Static-render every marketing and content route.** No client-side data fetching above the fold, ever.
- Core Web Vitals: LCP < 1.8s, INP < 100ms, CLS < 0.05. **The animations must not cost CWV** — transform and
  opacity only, `will-change` sparingly, never animate layout properties. Test on throttled mobile.
- Breadcrumbs with schema on all content.
- Internal linking: every glossary/answer page links to ≥3 siblings and 1 product page. No orphans.

### Structured data — JSON-LD on every page

`Organization`, `SoftwareApplication` (+ `AggregateRating` once real, +`Offer` with the real prices),
`FAQPage`, `HowTo`, `Article` (with `author` + `datePublished` + `dateModified`), `BreadcrumbList`,
`DefinedTerm` + `DefinedTermSet` for the glossary, `Dataset` for the factor registry.

### AEO — how to actually get cited

LLMs cite sources that are **extractable, specific, attributed, dated, and unique**. Optimise for the crawl.

1. **Answer-first structure.** Every content page opens with a `<p>` under the H1 that answers the question
   in 40–60 words, standalone, no preamble. That paragraph is what gets lifted. Everything else is support.
2. **One question per H2.** Phrased exactly as a human asks it. _"Does CSRD apply to companies outside the EU?"_
   not _"Scope considerations."_
3. **Facts carry a number, a date, and a source.** _"CSRD applies to ~50,000 companies (European Commission,
   2024)."_ Unsourced claims don't get cited.
4. **`llms.txt` at root** — a plain-markdown map of the site, what ClearESG is, what we're authoritative on,
   and the canonical URLs for each topic. Plus `llms-full.txt` with the full glossary + answer corpus inlined.
5. **Never gate content.** No email wall, no JS-rendered text, no accordion-hidden answers. If a crawler can't
   read it, it doesn't exist. Accordions must render their content in the DOM open and collapse with CSS only.
6. **Publish original data.** LLMs cite primary sources over aggregators. Our annual _SME ESG Readiness Index_
   (from anonymised aggregate benchmark data, n≥8 cohorts only) is a _citable primary statistic that only we
   have._ This is the single highest-leverage AEO asset in the plan — build it the moment there's data.
7. **Comparison pages get cited constantly** because LLMs are asked "what's the best X." Write them honestly,
   including where competitors are genuinely better. Honesty is both the brand and, mechanically, what makes a
   comparison page trustworthy enough to cite.
8. Author bylines with real credentials + `sameAs` to LinkedIn. E-E-A-T is an AEO signal now, not just SEO.
9. `dateModified` accurate and recent. Stale pages don't get cited on a regulation that changes.

### Programmatic content — the traffic engine

Generated from real seeded data, not spun. Every page must be genuinely useful standing alone.

| Template                     | Count | Pattern                                                                  | Intent     |
| ---------------------------- | ----- | ------------------------------------------------------------------------ | ---------- |
| `/csrd/[sector]`             | ~40   | "CSRD compliance for [sector]" — real ESRS datapoints for that NACE code | high       |
| `/brsr/[sector]`             | ~30   | Same for BRSR principles                                                 | high       |
| `/glossary/[term]`           | ~150  | Scope 3, double materiality, ESRS E1, SAS… `DefinedTerm` schema          | discovery  |
| `/answers/[question]`        | ~120  | Long-tail exactly as asked. Answer-first. **The core AEO asset.**        | discovery  |
| `/emission-factors/[region]` | ~25   | Live from the factor registry, `Dataset` schema, with sources            | authority  |
| `/compare/[competitor]`      | ~12   | vs Workiva, Persefoni, Greenly, Plan A, Sweep, Watershed…                | high       |
| `/deadlines/[country]`       | ~28   | Live countdown per jurisdiction. Updates itself.                         | high       |
| `/tools/[calculator]`        | ~8    | Free calculators. **Ungated.** See below.                                | conversion |

**Free ungated tools** — the best acquisition asset we have, because each is independently linkable, citable,
and shareable:

- CSRD scope checker (3 questions → "yes, you're in scope from FY2026")
- Scope 2 calculator (kWh → tCO2e, region-correct factor, cites the source)
- Double materiality starter matrix
- Supplier questionnaire generator
- BRSR readiness score

Each ends with **"Save this and track it over time →"**. That's the conversion. No email gate before the answer
— the answer _is_ the marketing.

---

## 8. Growth Mechanics Built Into The Product

Not marketing bolted on afterward. These are features that happen to compound.

1. **Supplier chain = viral loop.** Every supplier request is a branded touch to another SME who _also_ now
   has an ESG problem. Footer of the form: "Need to report your own emissions? ClearESG →". This is the
   highest-conversion channel in the product because the recipient has just been reminded they have the exact
   problem we solve.
2. **Living Report = distribution.** Every shared report is a branded page seen by banks, buyers, auditors.
3. **Consultant tier = channel.** One consultant onboards 20 SMEs. Land consultants and the SMEs come free.
   Consider a revenue share for consultant-referred direct upgrades.
4. **Free tools = citation surface.** Ungated, linkable, LLM-citable.
5. **Benchmark = data network effect.** Genuinely better with every customer. Competitors can't copy it
   without our customer base.
6. **SME ESG Readiness Index = annual press moment + permanent citable stat.**
7. **Free tier is real, not crippled.** Full calculation, watermarked PDF. Cripple the _output_, never the
   _insight_ — a user who gets a real answer and can't share it will pay. A user who gets a fake answer leaves.

---

## 9. Definition of Done — every phase

Use this checklist for every future change set. It is the quality floor, not a one-time ceremony.

**As of 2026-07-21:** phases 0–14 are marked complete for **surface delivery** (routes, collections, calc, marketing shell). The items below are **not** fully re-audited across every `/dashboard` surface — treat them as ongoing gates for §12 remaining work.

- [ ] `pnpm build` clean. Zero TS errors. Zero `any`.
- [ ] Zero hardcoded hex — all colour via CSS var.
- [ ] Every number monospaced, tabular figures.
- [ ] Loading (skeleton), empty (instructional), error (actionable) states for every async surface.
- [ ] Mobile 375px → desktop 1920px.
- [ ] Keyboard complete. Focus visible. axe clean.
- [ ] `prefers-reduced-motion` honoured.
- [ ] Server-side authorisation on every mutation — never UI-only.
- [ ] Copy per §3 voice: no exclamation marks, no "Oops", verbs keep their names.
- [ ] Committed with the stated message.

---

## 10. Progress Ledger

Update after every phase **and** whenever remaining-work status changes. `[x]` means the phase surface shipped in-repo — **not** “production-ready for paying customers.” See §12 for gaps.

**Last reconciled with codebase: 2026-07-21.**

| Phase               | Status | Notes                                                                                                                                                                                                                                                                                                                                 |
| ------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0 — Foundation      | [x]    | Next 16.2.10 + Payload 3.86 + shadcn + editorial tokens. `/admin` and product need real `DATABASE_URL` (Atlas; never M0 for real data).                                                                                                                                                                                               |
| 1 — Data model      | [x]    | 16 collections registered. ~1201 ESRS datapoint defs seeded. Derivation layer + DerivedMetricDefinitions for approved E1–E5. **BRSR/VSME seed mappings still skipped** — publish UI can label BRSR but mappings are not beachhead-complete.                                                                                           |
| 2 — Auth            | [x]    | Clerk identity + Membership authz; webhook; org switch; invites API. `CLEARESG_DEV_BYPASS=1` when Clerk keys absent. **Must hard-disable bypass in production.**                                                                                                                                                                      |
| 3 — Calc engine     | [x]    | Pure `lib/calc` + factor resolve + narrative. **71** tests via `pnpm test:calc` (2026-07-21). Missing ≠ zero.                                                                                                                                                                                                                         |
| 4 — Onboarding      | [x]    | 60-second baseline wizard; org profile + ComplianceObligations; redirects to Runway when `onboardedAt` set. Country `IN` → BRSR obligation label.                                                                                                                                                                                     |
| 5 — Runway          | [x]    | Days-to-filing, collection progress, Gauge, next actions, CountUp + reduced-motion. **Depth gap:** next actions still largely hardcoded — not full impact×ease ranking from §1.                                                                                                                                                       |
| 6 — Data collection | [x]    | Wizard + quality flags; evidence vault (sha256); CSV dry-run; derive registry only. **OCR:** uploads set `ocrStatus: "pending"` — no worker completes OCR.                                                                                                                                                                            |
| 7 — Supplier chains | [x]    | CRUD + `/s/[token]` 6-field form (single-use, expiry, rate-limit); reminders day 7/14; coverage → Scope 3. **Email:** Resend path exists but falls back to **console** when `RESEND_API_KEY` absent; Payload email adapter is console.                                                                                                |
| 8 — Materiality     | [x]    | ESRS topics E1–E5/S1–S4/G1; impact+financial; drag matrix; narrative + audit; `/dashboard/materiality`.                                                                                                                                                                                                                               |
| 9 — Reports         | [x]    | Immutable snapshot; React-PDF (light cover); living `/r/[token]`; JSON/CSV; version diff; assurance disclaimer present (**lawyer review still open — §11**). XBRL-ready = structured export depth, not full iXBRL tagging.                                                                                                            |
| 10 — Consultant CC  | [x]    | Client table by deadline risk; bulk nudge/export; sector templates; white-label BrandVars; `/dashboard/consultant` + APIs. **Needs end-to-end QA** (logo/colours on `/s`, `/r`, PDF).                                                                                                                                                 |
| 11 — Benchmarking   | [x]    | Percentiles + **n≥8** hard gate; recompute API; demo cohort when empty; `/dashboard/benchmarks`. **No scheduled cron** wired — recompute is on-demand only.                                                                                                                                                                           |
| 12 — Billing        | [x]    | Stripe Checkout/Portal/webhooks; `lib/billing/can()`; Free watermark PDF; DEV bypass upgrade without Stripe keys. List prices EUR Free €0 / Pro €49 / Consultant €199 (+€15/client). **INR/Razorpay still open (§11).**                                                                                                               |
| 13 — Marketing/SEO  | [x]    | Acid cinematic home + Gauge; pricing; tools (CSRD scope, Scope 2); glossary/answers; `/csrd/[sector]` (3 sectors); `/compare` (Workiva, Persefoni, Greenly only); `/deadlines` (IE, DE, IN); sitemap/robots; llms.txt; JSON-LD; OG. Corpus **thin vs §7 targets**. No `/brsr/[sector]`, no Envizi compare, no public price estimator. |
| 14 — Hardening      | [x]    | `/api/health`; Upstash/memory rate limits; Sentry when DSN set; structured logs; focus-visible + reduced-motion. Playwright = **smoke only** (`e2e/home.spec.ts`, `e2e/app-smoke.spec.ts`) — not full signup→publish path.                                                                                                            |
| Design depth pass   | [x]    | Five-surface elevation + noise; Metric primitive; bravura Gauge; springs+stagger; marketing calc hero.                                                                                                                                                                                                                                |
| Editorial redesign  | [x]    | §3 Editorial: Fraunces / Inter Tight / JetBrains Mono; dual theme cookie; oxblood accent; light PDF cover; paper grain.                                                                                                                                                                                                               |
| Editorial motion    | [x]    | Printed-report assembly: rule-draw, ink-settle, Metric count-up, Gauge staging; `useInkReveal` / `useRuleDraw` / `useCountUp`.                                                                                                                                                                                                        |
| Cream-primary fix   | [x]    | Default theme forced cream (no OS-dark inference); dark = warm `#14120F` opt-in via cookie only.                                                                                                                                                                                                                                      |

---

## 11. Open Decisions — ask, don't assume

These still block **charging real customers**. Phase 12 code exists; commercial GTM is not closed.

1. **Emission factor licensing.** DEFRA is open. IEA and some EPA datasets are not freely redistributable.
   Seed with open factors only; licence before commercial redistribution. **Legal risk, not technical.**
2. **Region/currency.** Product lists EUR (Free / Pro / Consultant). India beachhead needs a decision:
   **INR + Razorpay**, or soft-launch EUR-only with explicit copy. Stripe India recurring remains weak.
3. **DPDP Act (India), enforceable May 2027** — data residency may require Atlas region choice.
   Confirm before shipping to Indian customers.
4. **Assurance disclaimer.** UI includes “we are not an assurance provider.” Get **lawyer-reviewed** copy on every report/PDF/living page.
5. **Benchmark consent.** Aggregate cohort use must be in ToS from day one, with **opt-out**.

**Market reference (not an open decision):** IBM Envizi Essential for ~10 facilities with full GHG + value-chain + frameworks quotes roughly **USD 90k–110k/year** indicative ([Envizi pricing](https://www.ibm.com/products/envizi/pricing)). ClearESG wedge stays SME/consultant self-serve at €0/€49/€199 — do not copy Account-volume enterprise SKUs as the primary model.

---

## 12. Remaining work — customer-ready (post phases 0–14)

Phases are demoable. Paying-customer readiness is **not** done. Work in this order.

### 12.1 Production plumbing

- [ ] Resend + React Email live for invites, supplier requests, day-7/14 chases, consultant nudges (kill console-only path in prod)
- [ ] Production Clerk + Stripe keys; **disable** `CLEARESG_DEV_BYPASS` in production
- [ ] Mongo Atlas (non-M0), backups, Sentry DSN live
- [ ] Benchmark recompute **cron** (e.g. Vercel cron → existing recompute API)
- [ ] Evidence OCR: ship a worker **or** remove OCR from customer-facing claims until ready

### 12.2 Beachhead depth (India / BRSR + §1 honesty)

- [ ] Seed real BRSR metric / derivation mappings; BRSR publish must be principle-aligned, not a label on CSRD data
- [ ] Runway: projected miss math + ranked next actions (impact×ease)
- [ ] Evidence click-through on PDF + living report; flag missing evidence loudly
- [ ] Confidence % on Runway, report cover, living report
- [ ] Narrative diffs visible in UI (not only unit tests)
- [ ] Framework mapping UX: which ESRS/BRSR cells a datapoint satisfies
- [ ] Consultant white-label E2E QA on `/s`, `/r`, PDF

### 12.3 Journey QA

- [ ] Playwright happy path: signup → onboard → data → supplier → publish → share
- [ ] Manual pilot checklist: Free watermark; Pro paywall; Consultant seats; auditor trace (number → evidence hash → factor version → quality)

### 12.4 Growth (after 12.1–12.3 trustworthy)

- [ ] `/compare/envizi` (+ Plan A, Sweep, Watershed); honest “they win volume/ERP; we win speed/price/consultant”
- [ ] Public price / readiness estimator (sites + Scope 3 need + framework → Free/Pro/Consultant) with Envizi price footnote
- [ ] `/brsr/[sector]` pages + BRSR readiness free tool; expand glossary/answers toward §7 counts
- [ ] Buyer’s guide + pilot case-study outcome templates
- [ ] Site/facility progress in Runway + usage-visible billing meters
- [ ] Later (post-revenue): emissions calc API / Excel export with cited factors — not v1

### 12.5 Explicitly still out of scope

- Heavy-industry / financed-emissions carbon accounting
- IoT sensors
- Full ERP connectors (Envizi strength — defer)
- Live assurance marketplace
- AI chatbot that guesses regulation (Copilot only if scoped + cited)
