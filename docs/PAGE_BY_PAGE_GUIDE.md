# ClearESG — Page-by-Page Guide

A detailed, plain-language walkthrough of the whole product: **why it exists, who it is for, what every dashboard page does (in user-flow order), and what happens after the report is downloaded.**

---

## ❓ What is the purpose of the project?

**ClearESG is an ESG compliance platform — not a "be greener" lifestyle app.**

- Companies buy it because a **legal reporting deadline exists** (EU CSRD, India SEBI BRSR, buyer questionnaires cascading down supply chains) — not because they want another dashboard.
- Enterprise ESG tools cost six figures and take months to roll out. ClearESG gets a **small/medium company (SME) audit-ready this quarter**:
  1. Enter data once.
  2. Attach evidence to every figure.
  3. Collect Scope 3 data from suppliers **without forcing them to create accounts**.
  4. Run the CSRD-required double-materiality workshop in-product.
  5. Publish an immutable **Living Report + PDF** that banks, buyers and auditors can trust.

**What it deliberately is NOT:** heavy-industry carbon platforms, IoT live sensors, or AI that invents regulation.

---

## ❓ Who are the targeted customers?

### 1. Primary — SME (direct customer)

|                 |                                                                                           |
| --------------- | ----------------------------------------------------------------------------------------- |
| **Size**        | Roughly 40–400 employees                                                                  |
| **Trigger**     | Fell into CSRD scope, or a large customer sent a supplier questionnaire                   |
| **Actual user** | CFO, ops manager, or "the person who got handed ESG" — usually **no sustainability team** |
| **Need**        | Be told exactly what to do next; finish before the filing / buyer deadline                |

### 2. Primary — ESG consultant (multi-tenant)

- Boutique advisory firms running many SME clients.
- Today they live in spreadsheets and email chasing; they need one **Command Centre**, white-label portal/PDF, and client health (RAG) at a glance.
- **Growth engine:** one consultant brings many SMEs onto the platform.

### 3. Secondary — readers of the output (not daily users)

- **Banks / buyers** reviewing a Living Report link or PDF.
- **Auditors / assurance reviewers** checking evidence hashes and factor versions.
- **Internal teammates** (contributors / viewers) filling assigned metrics.

### Roles inside an organisation

| Role          | Access                                           |
| ------------- | ------------------------------------------------ |
| Owner / Admin | Billing, publish, approve, invite, lock periods  |
| Contributor   | Enter data, upload evidence, respond to requests |
| Viewer        | Read-only runway, reports, audit log             |

---

# Pages — in user-flow order

The recommended order of work is: **setup → collect → collaborate → publish → assure.** Return to Runway whenever you are unsure what to do next.

---

## Page 1 — Onboarding (`/dashboard/onboarding`)

### ❓ What will this page do?

A 60-second wizard that asks six baseline questions: **sector, headcount, country, revenue band, number of sites, premises (owned/leased)**. On finish it creates/updates the organisation, marks it onboarded, and derives the company's **compliance obligation** (e.g. "You're likely in CSRD — X days to first report").

### ❓ What is the purpose of this page?

Turn a blank organisation into a usable baseline in under a minute. The product cannot show deadlines or gaps until it knows who the company is.

### ❓ How will this page help the user?

- Gives an immediate **estimated** footprint/score (clearly marked estimated) so the user is never staring at an empty screen.
- Tells the user whether they are in **mandatory scope** and how many days remain — the deadline that drives everything else.

### ❓ After this, where will the user go?

→ **Runway** (`/dashboard`). Once onboarded, this Baseline page drops out of the navigation.

---

## Page 2 — Runway (`/dashboard`)

### ❓ What will this page do?

The compliance **home page**. Shows: days to filing, readiness (% of required metrics present), a calm status (on track / at risk / critical), the overall score gauge with the Scope 1/2/3 stack, and the **next three gaps** in plain language.

### ❓ What is the purpose of this page?

Countdown and "what next" — not a chart zoo. It is the page the user returns to at the start of every session and whenever they are stuck.

### ❓ How will this page help the user?

- The user never has to guess what to do — the next three actions are spelled out.
- The deadline countdown creates urgency and keeps the work honest.

### ❓ After this, where will the user go?

→ Whatever the top gap points to — usually **Data**, sometimes Reports, Guide, or Audit.

---

## Page 3 — Data (`/dashboard/data`)

### ❓ What will this page do?

The interactive **collection spine**. The user enters values for Environmental / Social / Governance metrics (or Yes/No policies), sets a **quality level** (Measured / Calculated / Estimated / Missing), attaches **evidence files**, and can assign a metric owner to a teammate. Optional: spreadsheet template import (with dry-run diff) and duplicating a prior period's structure.

### ❓ What is the purpose of this page?

One place where every figure lives, with quality and proof attached — so the eventual report is defensible, not a guess.

### ❓ How will this page help the user?

- Rows without evidence stay **flagged**, so nothing "measured" is unproven.
- Missing data is explicitly `missing` — never silently zero — so the readiness % on Runway is truthful.
- Derived metrics are calculated by the engine, not typed by hand, so there are no arithmetic mistakes.

**Rules to know:** writes only work on an **open** period; locked/published periods are read-only; changing a value can reset its approval to pending.

### ❓ After this, where will the user go?

→ **Suppliers** (if Scope 3 matters) and/or **Requests** (if teammates should own some metrics).

---

## Page 4 — Suppliers (`/dashboard/suppliers`)

### ❓ What will this page do?

Scope 3 collection **without supplier accounts**. Add a supplier (name, email, category, annual spend), send them a tokenised public form link (`/s/[token]`), track response status, and send day-7/14 reminders. Submitted forms automatically re-aggregate into Scope 3 datapoints.

### ❓ What is the purpose of this page?

Scope 3 (purchased goods, travel, waste, spend) is usually the biggest and hardest part of a footprint. This page removes the biggest blocker: suppliers refusing to create yet another account.

### ❓ How will this page help the user?

- One link per supplier — no logins, no onboarding friction for them.
- Response tracking + reminders replace the manual email chase.
- Responses flow straight into the numbers; no re-keying.

### ❓ After this, where will the user go?

→ **Materiality** (once collection is under way), or back to **Runway** to check the readiness needle moved.

---

## Page 5 — Requests (`/dashboard/requests`)

### ❓ What will this page do?

**Internal** collaboration. Create a request with a title, an assignee (a teammate who signs in), a set of metric keys, and a due date. Track its status: not sent → sent → opened → submitted.

### ❓ What is the purpose of this page?

One person cannot own all metrics — energy sits with facilities, headcount with HR, spend with finance. This page splits the work formally instead of by email.

### ❓ How will this page help the user?

- Each teammate gets a clear checklist and deadline; they do the actual entry on the **Data** page.
- The ESG lead sees exactly who is blocking the report.

**Not for external suppliers** — that is what the Suppliers page is for.

### ❓ After this, where will the user go?

→ **Materiality**, once data collection is delegated and moving.

---

## Page 6 — Materiality (`/dashboard/materiality`)

### ❓ What will this page do?

The **double materiality workshop** (impact × financial) over ESRS topics. Score each topic, position it on the matrix, generate/edit the narrative, and **Finalise** when leadership agrees — finalising locks the assessment.

### ❓ What is the purpose of this page?

CSRD requires a double-materiality assessment. This runs the workshop in-product instead of in a consultant's slide deck.

### ❓ How will this page help the user?

- Decides which topics the report must actually cover (and which it can skip).
- Produces the narrative section that goes into the published report and PDF.
- The lock makes the assessment defensible — it cannot quietly drift after publishing.

### ❓ After this, where will the user go?

→ **Reports**, to publish.

---

## Page 7 — Reports (`/dashboard/reports`)

### ❓ What will this page do?

Publish an **immutable, versioned snapshot** of the period (never overwritten). Download the **PDF** (the flagship artefact), JSON, or CSV. Open the shareable **Living Report** link (`/r/[token]`). Optionally add narrative/FAQ to the share pack.

### ❓ What is the purpose of this page?

This is the payoff of the whole flow — the artefact banks, buyers and auditors actually consume.

### ❓ How will this page help the user?

- Versioned publishing means an auditor can always see exactly what was shared and when.
- The Living Report link is a living, always-current web view; the PDF is the formal document.
- One click replaces weeks of manual report assembly.

### ❓ After this, where will the user go?

→ Share the link/PDF externally, then → **Guide** (tick the checklist) and **Questionnaires** (if a buyer sent a specific pack).

---

## Page 8 — Questionnaires (`/dashboard/questionnaires`)

### ❓ What will this page do?

Generate a **deterministic mapped export** from the period's canonical datapoints into a buyer/EcoVadis-style questionnaire format. Review coverage, fill any gaps back on Data, regenerate.

### ❓ What is the purpose of this page?

Buyers send their own Excel questionnaires. This page answers them from data already entered — **no re-keying**.

### ❓ How will this page help the user?

- Enter data once, answer many questionnaires.
- Coverage view shows exactly which requested fields are still missing.

### ❓ After this, where will the user go?

→ Back to **Data** to fill gaps, then regenerate; or → **Guide**.

---

## Page 9 — Guide (`/dashboard/guide`)

### ❓ What will this page do?

A **first-report checklist** stored on the organisation (shared by the whole team, not per-browser). Typical steps: confirm sector/country → finish baseline → enter top three figures → request one supplier → publish a living report. Progress **auto-ticks from real product state** and can also be ticked manually.

### ❓ What is the purpose of this page?

Onboarding hand-holding for a new team working toward its first publish.

### ❓ How will this page help the user?

- A shared, honest to-do list — it cannot claim progress the org has not actually made.

### ❓ After this, where will the user go?

→ **Audit**, as the team shifts from "produce the report" to "defend the report."

---

## Page 10 — Audit (`/dashboard/audit`)

### ❓ What will this page do?

A governance **change log**: who published, assigned, approved, invited, and so on. Filter by entity type, read humanised actions with relative timestamps, export the full account log.

### ❓ What is the purpose of this page?

When an auditor (or a surprised CFO) asks "who changed this and when?", this page is the answer.

### ❓ How will this page help the user?

- Every sensitive action is attributable — essential for assurance reviews.
- Helps investigate unexpected score changes.

### ❓ After this, where will the user go?

→ **Benchmarks**, once the defensive work is done.

---

## Page 11 — Benchmarks (`/dashboard/benchmarks`)

### ❓ What will this page do?

Show **anonymised sector cohort percentiles** — your intensity vs peers. Only appears when the cohort has **n ≥ 8** comparable organisations (privacy rule). If empty, it explains why and what to do.

### ❓ What is the purpose of this page?

Context. A number alone means little; "you are in the 70th percentile of your sector" means something to leadership and buyers. This is also the platform's network effect.

### ❓ How will this page help the user?

- Gives leadership a defensible peer comparison.
- Never invents percentiles — empty state is honest.

### ❓ After this, where will the user go?

→ **Billing**, if usage is hitting plan limits.

---

## Page 12 — Billing (`/dashboard/billing`)

### ❓ What will this page do?

Show the current plan, usage caps, and upgrade/manage-subscription actions.

### ❓ What is the purpose of this page?

Convert: Free plan may watermark the PDF and limit reporting periods; **Pro** unlocks a clean PDF and higher limits; consultant plans unlock the client centre.

### ❓ How will this page help the user?

- The user hits it exactly when the product has proven its value (watermarked PDF, period cap) — the upgrade decision is obvious, not pushy.

### ❓ After this, where will the user go?

→ Back to **Runway** for the next period — or, for advisory firms, → **Consultant**.

---

## Page 13 — Consultant → Clients (`/dashboard/consultant`)

### ❓ What will this page do?

A **multi-client health board** (visible only to consultancy-type organisations). Invite pre-branded clients, see RAG health (deadlines, gaps) per client, configure white-label brand/domain, and **switch into a client org** to run the normal company flow on their behalf.

### ❓ What is the purpose of this page?

Let one advisory firm run many SMEs from one Command Centre instead of many spreadsheets.

### ❓ How will this page help the user?

- RAG view surfaces the client most at risk of missing a deadline.
- White-label means the client sees the consultant's brand on portal and PDF.

### ❓ After this, where will the user go?

→ Into each client org's **Runway**, repeating the whole flow per client.

---

# After the report

## ❓ What happens once all the fields are filled and the report is downloaded?

Downloading the PDF is **not the end** — it is the end of _one reporting period_. What follows:

1. **Share externally** — send the PDF / Living Report link to the bank, buyer, or regulator. The Living Report keeps working as a live link (test it in an incognito window first).
2. **Defend it** — auditors or buyers may push back. The user answers from the **Audit log** (who changed what), **evidence hashes** on Data, and the **factor registry** printed in the PDF appendix. This is why every figure was tied to proof.
3. **The period gets locked/published** — it becomes read-only. Nothing can quietly change under a shared report.

## ❓ Will the user create another project?

**Yes — but it is called a new "reporting period", not a project.** ESG reporting is cyclical (typically annual, sometimes quarterly for buyer requests). For the next cycle the user:

1. Opens or **duplicates the previous period's structure** (so they don't rebuild the metric list from scratch).
2. Collects fresh data → approves → publishes a **new version**.
3. Chases suppliers and teammates again (the supplier list carries over).
4. Recomputes benchmarks when prompted.
5. Reviews Billing before year-end renewal.

Each published version stays immutable forever — so over the years the org builds a defensible history.

## ❓ How often will the user use this website?

Usage is **deadline-shaped, not daily-habit-shaped** — and that is by design:

| Phase                                       | Frequency                                                                   | Who                     |
| ------------------------------------------- | --------------------------------------------------------------------------- | ----------------------- |
| **First 1–2 weeks (activation)**            | Almost daily — onboarding, first metrics, first supplier, first evidence    | ESG lead                |
| **Collection season (weeks before filing)** | Several times a week — data entry, chasing suppliers/teammates, materiality | ESG lead + contributors |
| **Publish week**                            | Daily — final gaps, publish, PDF checks, sharing                            | Owner/Admin             |
| **Between periods**                         | Occasionally — ad-hoc buyer questionnaires, audit queries, benchmark checks | ESG lead                |
| **Next period**                             | The cycle restarts (annually, or sooner if a buyer asks)                    | Whole team              |
| **Consultants**                             | **Continuously** — many clients means someone is always near a deadline     | Advisory firm           |

**The one-line summary:** an SME touches ClearESG intensively around each reporting deadline and lightly in between; consultants live in it year-round because their client deadlines are staggered. The recurring deadline — not habit — is what brings every customer back.
