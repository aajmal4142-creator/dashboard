"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { PageFrame } from "@/components/shell/PageFrame";
import { AlertCircle, Download, Upload } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { HistoricalDataRow } from "@/lib/data/historicalBackfill";

interface BackfillState {
  currentStep: 1 | 2 | 3 | 4;
  file: File | null;
  rows: HistoricalDataRow[];
  periodId: string;
  dryRun: boolean;
  loading: boolean;
  result: {
    imported: number;
    errors: Array<{ row: number; field: string; message: string }>;
    yearRange?: { min: number; max: number };
    summary?: { byYear: Record<number, number>; byMetric: Record<string, number> };
  } | null;
  periods: Array<{ id: string; year: number; status: string }>;
  metrics: Array<{ key: string; label: string }>;
}

const STEPS = [
  { step: 1, title: "Upload File", description: "Select CSV with historical data" },
  { step: 2, title: "Select Period", description: "Choose target period for import" },
  { step: 3, title: "Review", description: "Preview and validate data" },
  { step: 4, title: "Complete", description: "Import confirmation" },
];

const CSV_TEMPLATE = `year,metricKey,value,quality,supplier,notes
2020,electricity_kwh,50000,estimated,,Initial historical data
2021,electricity_kwh,52000,measured,,Updated measurement
2022,natural_gas_m3,1200,estimated,,Estimated consumption
2023,waste_kg,5000,measured,,Waste tracking`;

export default function DataBackfillPage() {
  const [state, setState] = useState<BackfillState>({
    currentStep: 1,
    file: null,
    rows: [],
    periodId: "",
    dryRun: true,
    loading: false,
    result: null,
    periods: [],
    metrics: [],
  });

  useEffect(() => {
    let cancelled = false;

    async function fetchBackfillInfo() {
      try {
        const res = await fetch("/api/app/data/backfill");
        const data = (await res.json()) as {
          periods: BackfillState["periods"];
          metrics: BackfillState["metrics"];
        };
        if (cancelled) return;
        setState((prev) => ({
          ...prev,
          periods: data.periods,
          metrics: data.metrics,
        }));
      } catch (error) {
        console.error("Failed to fetch backfill info:", error);
      }
    }

    void fetchBackfillInfo();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setState((prev) => ({ ...prev, file }));

    // Parse CSV
    const text = await file.text();
    const lines = text.split("\n").filter((l) => l.trim());

    const rows: HistoricalDataRow[] = lines.slice(1).map((line) => {
      const values = line.split(",");
      return {
        year: parseInt(values[0]!),
        metricKey: values[1]!.trim(),
        value: parseFloat(values[2]!),
        quality: values[3]?.trim(),
        supplier: values[4]?.trim(),
        notes: values[5]?.trim(),
      };
    });

    setState((prev) => ({
      ...prev,
      rows: rows.filter((r) => r.year && r.metricKey && r.value !== undefined),
      currentStep: 2,
    }));
  };

  const handlePeriodSelect = () => {
    if (!state.periodId) {
      alert("Please select a period");
      return;
    }
    setState((prev) => ({ ...prev, currentStep: 3 }));
  };

  const handleReview = async () => {
    setState((prev) => ({ ...prev, loading: true }));

    try {
      const res = await fetch("/api/app/data/backfill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: state.rows,
          periodId: state.periodId,
          dryRun: true,
        }),
      });

      const result = await res.json();
      setState((prev) => ({
        ...prev,
        result,
        currentStep: 4,
        loading: false,
      }));
    } catch {
      alert("Failed to validate data");
      setState((prev) => ({ ...prev, loading: false }));
    }
  };

  const handleImport = async () => {
    setState((prev) => ({ ...prev, loading: true }));

    try {
      const res = await fetch("/api/app/data/backfill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: state.rows,
          periodId: state.periodId,
          dryRun: false,
        }),
      });

      const result = await res.json();
      setState((prev) => ({
        ...prev,
        result,
        loading: false,
      }));
    } catch {
      alert("Failed to import data");
      setState((prev) => ({ ...prev, loading: false }));
    }
  };

  const downloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "historical-backfill-template.csv";
    a.click();
  };

  const renderStep = () => {
    switch (state.currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="bg-white rounded-lg border border-gray-200 p-8">
              <h2 className="text-2xl font-bold mb-4">Upload CSV File</h2>

              <div className="mb-6">
                <button
                  onClick={downloadTemplate}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded text-sm font-medium"
                >
                  <Download className="w-4 h-4" />
                  Download Template
                </button>
              </div>

              <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="csv-input"
                />
                <label htmlFor="csv-input" className="cursor-pointer block">
                  <Upload className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-lg font-medium mb-1">Click to upload CSV</p>
                  <p className="text-sm text-gray-600">or drag and drop</p>
                </label>
              </div>

              {state.file && (
                <p className="mt-4 text-green-600 font-medium">
                  ✓ Selected: {state.file.name} ({state.rows.length} rows)
                </p>
              )}
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-900">
                <strong>CSV Format:</strong> year, metricKey, value, quality, supplier,
                notes
              </p>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="bg-white rounded-lg border border-gray-200 p-8">
            <h2 className="text-2xl font-bold mb-4">Select Target Period</h2>

            {state.periods.length === 0 ? (
              <p className="text-red-600">No periods available. Create one first.</p>
            ) : (
              <div className="space-y-3 mb-6">
                {state.periods.map((period) => (
                  <label
                    key={period.id}
                    className="flex items-center p-4 border rounded hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="radio"
                      name="period"
                      value={period.id}
                      checked={state.periodId === period.id}
                      onChange={(e) =>
                        setState((prev) => ({ ...prev, periodId: e.target.value }))
                      }
                      className="mr-4"
                    />
                    <div>
                      <p className="font-medium">Year {period.year}</p>
                      <p className="text-sm text-gray-600">Status: {period.status}</p>
                    </div>
                  </label>
                ))}
              </div>
            )}

            <button
              onClick={handlePeriodSelect}
              disabled={!state.periodId}
              className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              Next: Review Data
            </button>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div className="bg-white rounded-lg border border-gray-200 p-8">
              <h2 className="text-2xl font-bold mb-4">Review & Validate</h2>

              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-blue-50 p-4 rounded">
                  <p className="text-sm text-gray-600">Records to Import</p>
                  <p className="text-2xl font-bold text-blue-600">{state.rows.length}</p>
                </div>
                <div className="bg-green-50 p-4 rounded">
                  <p className="text-sm text-gray-600">Year Range</p>
                  <p className="text-lg font-bold text-green-600">
                    {Math.min(...state.rows.map((r) => r.year))}-
                    {Math.max(...state.rows.map((r) => r.year))}
                  </p>
                </div>
                <div className="bg-purple-50 p-4 rounded">
                  <p className="text-sm text-gray-600">Unique Metrics</p>
                  <p className="text-lg font-bold text-purple-600">
                    {new Set(state.rows.map((r) => r.metricKey)).size}
                  </p>
                </div>
              </div>

              <div className="mb-6 max-h-48 overflow-y-auto border rounded">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100 sticky top-0">
                    <tr>
                      <th className="px-4 py-2 text-left">Year</th>
                      <th className="px-4 py-2 text-left">Metric</th>
                      <th className="px-4 py-2 text-right">Value</th>
                      <th className="px-4 py-2 text-left">Quality</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.rows.slice(0, 10).map((row, i) => (
                      <tr key={i} className="border-t">
                        <td className="px-4 py-2">{row.year}</td>
                        <td className="px-4 py-2 text-xs">{row.metricKey}</td>
                        <td className="px-4 py-2 text-right font-mono">
                          {row.value.toLocaleString()}
                        </td>
                        <td className="px-4 py-2 text-xs text-gray-600">
                          {row.quality || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {state.rows.length > 10 && (
                  <p className="text-center py-2 text-sm text-gray-600">
                    ... and {state.rows.length - 10} more
                  </p>
                )}
              </div>

              <label className="flex items-center mb-6">
                <input
                  type="checkbox"
                  checked={state.dryRun}
                  onChange={(e) =>
                    setState((prev) => ({ ...prev, dryRun: e.target.checked }))
                  }
                  className="mr-2"
                />
                <span className="text-sm">Dry run (preview without saving)</span>
              </label>

              <button
                onClick={handleReview}
                disabled={state.loading}
                className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {state.loading ? "Validating..." : "Validate & Review"}
              </button>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="bg-white rounded-lg border border-gray-200 p-8">
            <h2 className="text-2xl font-bold mb-4">Import Result</h2>

            {state.result && (
              <>
                {state.result.errors.length === 0 ? (
                  <Alert className="mb-6 border-green-200 bg-green-50">
                    <AlertCircle className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-800">
                      ✓ Validation passed! {state.result.imported} records ready to
                      import.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Alert className="mb-6 border-red-200 bg-red-50">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    <AlertDescription className="text-red-800">
                      ⚠ {state.result.errors.length} validation errors found
                    </AlertDescription>
                  </Alert>
                )}

                {state.result.yearRange && (
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div>
                      <p className="text-sm text-gray-600">Year Range</p>
                      <p className="text-lg font-bold">
                        {state.result.yearRange.min}-{state.result.yearRange.max}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Records Imported</p>
                      <p className="text-lg font-bold text-blue-600">
                        {state.result.imported}
                      </p>
                    </div>
                  </div>
                )}

                {state.result.errors.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded p-4 mb-6">
                    <p className="font-medium text-red-900 mb-2">Errors:</p>
                    <ul className="text-xs text-red-700 space-y-1">
                      {state.result.errors.slice(0, 5).map((err, i) => (
                        <li key={i}>
                          Row {err.row}: {err.field} - {err.message}
                        </li>
                      ))}
                      {state.result.errors.length > 5 && (
                        <li>... and {state.result.errors.length - 5} more</li>
                      )}
                    </ul>
                  </div>
                )}

                {state.dryRun && state.result.errors.length === 0 && (
                  <button
                    onClick={handleImport}
                    disabled={state.loading}
                    className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                  >
                    {state.loading ? "Importing..." : "Confirm & Import"}
                  </button>
                )}
              </>
            )}

            <Link
              href="/data"
              className="mt-4 inline-block text-gray-600 hover:text-gray-900 underline"
            >
              ← Back to Data
            </Link>
          </div>
        );
    }
  };

  return (
    <PageFrame eyebrow="Data Import" title="Historical Data Backfill">
      <div className="max-w-4xl">
        <Alert className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Import historical data from prior years (2020-2025) with full validation and
            anomaly detection.
          </AlertDescription>
        </Alert>

        {/* Progress Steps */}
        <div className="flex justify-between items-center mb-8">
          {STEPS.map((s) => (
            <div key={s.step} className="flex-1">
              <div className="flex items-center">
                <div
                  className={`flex items-center justify-center w-8 h-8 rounded-full font-bold ${
                    state.currentStep >= s.step
                      ? "bg-blue-600 text-white"
                      : "bg-gray-200 text-gray-600"
                  }`}
                >
                  {s.step}
                </div>
                {s.step < STEPS.length && (
                  <div
                    className={`flex-1 h-1 mx-2 ${
                      state.currentStep > s.step ? "bg-blue-600" : "bg-gray-200"
                    }`}
                  />
                )}
              </div>
              <p className="text-xs font-medium mt-2">{s.title}</p>
              <p className="text-xs text-gray-600">{s.description}</p>
            </div>
          ))}
        </div>

        {/* Step Content */}
        {renderStep()}
      </div>
    </PageFrame>
  );
}
