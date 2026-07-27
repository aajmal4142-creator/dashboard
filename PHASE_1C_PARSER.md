# Phase 1c — Framework mapping extraction

> **Do not start this phase until the real source files are in `/docs`.**
> This phase parses documents. It does not generate them. If a file is missing, stop and say so —
> do not proceed with what you remember about ESRS or BRSR. Your training data on these standards is
> stale (Simplified ESRS post-dates it) and a wrong mapping ships a filing error to a regulator.

## Required files

| File                                   | Source                                             | Status |
| -------------------------------------- | -------------------------------------------------- | ------ |
| `/docs/EFRAG-IG3-datapoints.xlsx`      | efrag.org → ESRS implementation guidance documents | [ ]    |
| `/docs/EFRAG-IG3-explanatory-note.pdf` | same page — documents the column semantics         | [ ]    |
| `/docs/EFRAG-IG3-addendum-2024-12.pdf` | same page — corrections to the workbook            | [ ]    |
| `/docs/SEBI-BRSR-format.pdf`           | sebi.gov.in — 2024/25 industry standards circular  | [ ]    |
| `/docs/EFRAG-VSME.pdf`                 | efrag.org — voluntary SME standard                 | [ ]    |

Check each exists before writing any code. Report which are missing and stop if any are.

---

## Step 1 — Inspect before parsing

Do not assume the column layout. Read the Explanatory Note first — it defines what each column in the
workbook means. Then:

```bash
pnpm add -D xlsx
```

Write `scripts/inspect-esrs.ts`:

- List every sheet name in the workbook
- For each sheet, print the header row and the first 3 data rows
- Print row counts per sheet

Run it. **Show me the output and wait.** I will confirm which sheet and which columns to use before you
write the parser. IG 3 has multiple worksheets and the one you want may not be the first.

---

## Step 2 — Parse ESRS

Write `scripts/parse-esrs.ts`. Rules, in order of importance:

1. **Extract only. Never infer.** If a cell is empty, emit `null`. Do not fill gaps from knowledge,
   pattern, or adjacent rows.
2. **Preserve the source verbatim.** Every output row carries the raw cell text alongside any normalised
   value, plus its sheet name and 1-indexed row number so any row can be traced back.
3. **Fail loudly.** If a row lacks a DP identifier, skip it and log it. At the end print: rows read, rows
   emitted, rows skipped with reasons grouped by reason.
4. **No transformation of meaning.** Trim whitespace, that's it. Do not retitle, summarise, or "clean up"
   a disclosure requirement.

Target shape — adjust field names to whatever the Explanatory Note actually calls them:

```ts
interface EsrsDatapoint {
  dpId: string; // the unique identifier column
  standard: string; // ESRS 2, E1, S1, G1...
  disclosureRequirement: string;
  paragraph: string | null;
  name: string; // verbatim
  dataType: string | null;
  conditionalOrAlternative: string | null;
  phaseIn: string | null;
  voluntary: boolean | null;
  sourceSheet: string;
  sourceRow: number;
  rawCells: Record<string, string | null>; // full unmodified row
}
```

Emit `data/esrs-set1-datapoints.json`. Apply the Addendum corrections as a **separate pass** with its own
log — never silently fold them into the base parse. Print a summary of what the addendum changed.

Then the same for BRSR (`scripts/parse-brsr.ts` → `data/brsr-indicators.json`) and VSME. BRSR is a PDF, so
extraction is messier — extract tables, keep the principle number, indicator number, essential/leadership
flag, and verbatim text. **If a table extracts badly, report it rather than patching it by hand.**

---

## Step 3 — Propose mappings (this is where you must not overstep)

Write `scripts/propose-mappings.ts`. It reads `metric-definitions.seed.ts` (18 metrics, each with a
`calcRole`) and the parsed datapoint JSON, and produces **a review file for a human — not a seed.**

For each of the 18 metrics, output every candidate datapoint that could plausibly correspond, with:

```ts
interface MappingCandidate {
  metricKey: string; // e.g. 'electricity_kwh'
  framework: "CSRD_SET1" | "BRSR" | "VSME";
  dpId: string;
  dpNameVerbatim: string; // quoted exactly from source
  sourceSheet: string;
  sourceRow: number;
  matchBasis: string; // WHY you think this is a candidate, in one sentence
  confidence: "strong" | "possible" | "weak";
  approved: null; // <- a human sets this. Never you.
}
```

Emit `data/mapping-review.json` and a human-readable `data/mapping-review.md` grouped by metric, with the
verbatim source text visible for each candidate so I can check it without opening the workbook.

**Hard rules:**

- `approved` is always `null` on output. You never set it.
- If a metric has no plausible candidate, emit an empty array for it and say so. **A gap is a correct
  answer.** Do not stretch to find a match — `electricity_renewable_pct` may not map cleanly to anything,
  and that is useful information.
- Never invent a `dpId`. Every one must exist in the parsed JSON. Add an assertion that verifies this and
  throws if violated.
- Do not rank on semantic similarity alone. `matchBasis` must cite something concrete — the unit matches,
  the disclosure requirement names the same quantity, etc.

---

## Step 4 — Seed only what's approved

Write `scripts/seed-mappings.ts`. It reads `data/mapping-review.json` and writes to
`MetricDefinition.frameworkMappings` **only rows where `approved === true`.**

- `approved === null` → skip, count it, report it
- `approved === false` → skip
- Every seeded mapping carries `sourceDoc`, `sourceSheet`, `sourceRow`, and `extractedAt` so any mapping in
  production traces to a cell in a real document
- Each mapping carries `validFrom` / `validUntil` — ESRS Set 1 remains live for Wave 1 until the Simplified
  ESRS delegated act takes effect. Set `validUntil: null` and note it needs revisiting once that date is known.

The script must be idempotent and must refuse to run if `mapping-review.json` has zero approved rows.

---

## What "done" looks like

- [ ] Every source file present and inspected before parsing
- [ ] Parse logs show rows read / emitted / skipped with reasons
- [ ] Every emitted row traceable to sheet + row number
- [ ] `mapping-review.md` readable without opening the workbook
- [ ] Zero mappings seeded without `approved === true`
- [ ] Assertion in place that every `dpId` exists in the parsed source
- [ ] Metrics with no mapping are explicitly listed as unmapped

---

## The line

You are extracting legal disclosure requirements. Every mapping you propose is a claim that a regulator
requires a specific number, and it will end up in a PDF a company files.

**Extraction is your job. Interpretation is mine.**

If a source document is ambiguous, say it's ambiguous. If a table extracts badly, say it extracted badly.
If you cannot find a mapping, say there isn't one. Every one of those is a better outcome than a confident
guess, because a gap is visible and a wrong mapping is not.
