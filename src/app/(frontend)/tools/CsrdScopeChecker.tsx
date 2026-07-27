"use client";

import { useState } from "react";
import Link from "next/link";

type Result = { inScope: boolean; detail: string };

export function CsrdScopeChecker() {
  const [employees, setEmployees] = useState(250);
  const [turnoverM, setTurnoverM] = useState(50);
  const [eu, setEu] = useState(true);
  const [result, setResult] = useState<Result | null>(null);

  function run() {
    // Simplified educational heuristic — not legal advice.
    const large = employees >= 250 || turnoverM >= 50;
    if (!eu) {
      setResult({
        inScope: false,
        detail:
          "Not an EU undertaking under this checker. You may still receive CSRD-shaped buyer or bank questionnaires — treat those as operational deadlines.",
      });
      return;
    }
    if (large) {
      setResult({
        inScope: true,
        detail:
          "Likely in a CSRD wave for large undertakings (heuristic: ≥250 employees or ≥€50m turnover). Confirm against current thresholds and your FY end. Assurance and ESRS Set 1 still apply.",
      });
      return;
    }
    setResult({
      inScope: false,
      detail:
        "Below the large-undertaking heuristic. Listed SMEs and later waves may still apply — check listing status. Value-chain requests can arrive regardless.",
    });
  }

  return (
    <div className="space-y-4 border border-rule p-4">
      <label className="block text-sm text-ink-muted">
        Employees
        <input
          type="number"
          className="mt-1 w-full border border-rule bg-surface-1 px-3 py-2 font-data text-ink"
          value={employees}
          onChange={(e) => setEmployees(Number(e.target.value))}
        />
      </label>
      <label className="block text-sm text-ink-muted">
        Turnover (€m)
        <input
          type="number"
          className="mt-1 w-full border border-rule bg-surface-1 px-3 py-2 font-data text-ink"
          value={turnoverM}
          onChange={(e) => setTurnoverM(Number(e.target.value))}
        />
      </label>
      <label className="flex items-center gap-2 text-sm text-ink-muted">
        <input type="checkbox" checked={eu} onChange={(e) => setEu(e.target.checked)} />
        EU undertaking
      </label>
      <button
        type="button"
        onClick={run}
        className="border border-rule bg-surface-1 px-3 py-2 text-sm text-ink hover:border-rule-strong"
      >
        Check scope
      </button>
      {result ? (
        <div className="border border-rule bg-surface-1 p-3 text-sm">
          <p className={`font-data ${result.inScope ? "text-amber" : "text-ink"}`}>
            {result.inScope ? "Likely in scope" : "Not directly in scope (heuristic)"}
          </p>
          <p className="mt-2 text-ink-muted">{result.detail}</p>
          <p className="mt-4 text-ink-muted">
            Save this and track it over time →{" "}
            <Link href="/sign-up" className="text-ink underline">
              Start free
            </Link>
          </p>
        </div>
      ) : null}
    </div>
  );
}
