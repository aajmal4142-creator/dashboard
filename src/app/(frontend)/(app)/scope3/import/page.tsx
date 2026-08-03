"use client";

import { useState } from "react";
import Link from "next/link";

interface ImportStep {
  step: number;
  title: string;
  description: string;
}

interface Scope3SourceSummary {
  id: string;
  name: string;
  type: string;
}

interface ValidationPreview {
  valid: boolean;
  errors: Array<{ field: string; message: string }>;
  normalizedData?: Record<string, number>;
}

interface ImportResult {
  imported: number;
  errors: Array<{ row: number; error: string }>;
}

const IMPORT_STEPS: ImportStep[] = [
  { step: 1, title: "Upload File", description: "Select CSV file to import" },
  {
    step: 2,
    title: "Select Source",
    description: "Choose which Scope 3 source this data belongs to",
  },
  {
    step: 3,
    title: "Validate",
    description: "Preview validation results before importing",
  },
  { step: 4, title: "Confirm", description: "Review and confirm the import" },
];

export default function Scope3ImportPage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [sources, setSources] = useState<Scope3SourceSummary[]>([]);
  const [selectedSourceId, setSelectedSourceId] = useState<string>("");
  const [csvData, setCsvData] = useState<Record<string, string>[]>([]);
  const [validationResults, setValidationResults] = useState<ValidationPreview | null>(
    null,
  );
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [dryRun, setDryRun] = useState(true);

  // Step 1: Handle file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);

    // Parse CSV
    const text = await selectedFile.text();
    const lines = text.split("\n").filter((line) => line.trim());
    const headers = lines[0].split(",").map((h) => h.trim());
    const data = lines.slice(1).map((line) => {
      const values = line.split(",");
      const row: Record<string, string> = {};
      headers.forEach((header, index) => {
        row[header] = values[index]?.trim() || "";
      });
      return row;
    });

    setCsvData(data);

    // Fetch sources
    const sourcesResponse = await fetch("/api/app/scope3/sources");
    const sourcesData = (await sourcesResponse.json()) as {
      sources: Scope3SourceSummary[];
    };
    setSources(sourcesData.sources);

    setCurrentStep(2);
  };

  // Step 2: Select source and proceed to validation
  const handleSourceSelect = async () => {
    if (!selectedSourceId) {
      alert("Please select a source");
      return;
    }

    const source = sources.find((s) => s.id === selectedSourceId);
    if (!source) return;

    // Validate first row to check format
    const firstRow = csvData[0];
    if (!firstRow) return;

    try {
      const response = await fetch("/api/app/scope3/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceId: selectedSourceId,
          activityData: firstRow,
        }),
      });

      const result = (await response.json()) as ValidationPreview;
      setValidationResults(result);
      setCurrentStep(3);
    } catch {
      alert("Failed to validate data");
    }
  };

  // Step 3: Import data
  const handleImport = async () => {
    if (!selectedSourceId) return;

    setImporting(true);
    try {
      const response = await fetch("/api/app/scope3/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceId: selectedSourceId,
          periodId: new URLSearchParams(window.location.search).get("periodId") || "",
          activities: csvData.map((row) => ({
            activityData: row,
          })),
          dryRun,
        }),
      });

      const result = (await response.json()) as ImportResult;
      setImportResult(result);
      setCurrentStep(4);
    } catch {
      alert("Failed to import data");
    } finally {
      setImporting(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="bg-white rounded-lg border border-gray-200 p-8">
            <h2 className="text-2xl font-bold mb-4">Upload CSV File</h2>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
              <input
                type="file"
                accept=".csv,.xlsx"
                onChange={handleFileUpload}
                className="hidden"
                id="file-input"
              />
              <label htmlFor="file-input" className="cursor-pointer block">
                <p className="text-lg font-medium mb-2">Click to select CSV file</p>
                <p className="text-sm text-gray-600">or drag and drop</p>
              </label>
              {file && <p className="mt-4 text-green-600">Selected: {file.name}</p>}
            </div>
          </div>
        );

      case 2:
        return (
          <div className="bg-white rounded-lg border border-gray-200 p-8">
            <h2 className="text-2xl font-bold mb-4">Select Source</h2>
            <p className="text-gray-600 mb-6">
              Choose which Scope 3 source this data belongs to
            </p>

            {sources.length === 0 ? (
              <p className="text-red-600 mb-4">No sources available. Create one first.</p>
            ) : (
              <div className="space-y-4 mb-6">
                {sources.map((source) => (
                  <label
                    key={source.id}
                    className="flex items-center p-4 border border-gray-200 rounded hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="radio"
                      value={source.id}
                      checked={selectedSourceId === source.id}
                      onChange={(e) => setSelectedSourceId(e.target.value)}
                      className="mr-4"
                    />
                    <div>
                      <p className="font-medium">{source.name}</p>
                      <p className="text-sm text-gray-600">{source.type}</p>
                    </div>
                  </label>
                ))}
              </div>
            )}

            <button
              onClick={handleSourceSelect}
              disabled={!selectedSourceId}
              className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              Next: Validate Data
            </button>
          </div>
        );

      case 3:
        return (
          <div className="bg-white rounded-lg border border-gray-200 p-8">
            <h2 className="text-2xl font-bold mb-4">Validation Preview</h2>

            {validationResults && (
              <>
                {validationResults.valid ? (
                  <div className="bg-green-50 border border-green-200 rounded p-4 mb-6">
                    <p className="text-green-700 font-medium">
                      First row validated successfully
                    </p>
                    {validationResults.normalizedData && (
                      <pre className="text-xs bg-green-100 p-2 rounded mt-2 overflow-auto">
                        {JSON.stringify(validationResults.normalizedData, null, 2)}
                      </pre>
                    )}
                  </div>
                ) : (
                  <div className="bg-red-50 border border-red-200 rounded p-4 mb-6">
                    <p className="text-red-700 font-medium mb-2">Validation errors:</p>
                    <ul className="text-sm text-red-600">
                      {validationResults.errors.map((error, i) => (
                        <li key={i}>• {error.message}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}

            <div className="mb-6">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={dryRun}
                  onChange={(e) => setDryRun(e.target.checked)}
                  className="mr-2"
                />
                <span className="text-sm">Dry run (preview without saving)</span>
              </label>
            </div>

            <button
              onClick={handleImport}
              disabled={
                importing || (validationResults !== null && !validationResults.valid)
              }
              className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {importing ? "Importing..." : "Import Activities"}
            </button>
          </div>
        );

      case 4:
        return (
          <div className="bg-white rounded-lg border border-gray-200 p-8">
            <h2 className="text-2xl font-bold mb-4">Import Complete</h2>

            {importResult && (
              <>
                <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded">
                  <p className="font-medium text-blue-900">
                    {importResult.imported} activities {dryRun ? "would be" : ""} imported
                  </p>
                  {importResult.errors.length > 0 && (
                    <p className="text-sm text-red-600 mt-2">
                      {importResult.errors.length} errors encountered
                    </p>
                  )}
                </div>

                {importResult.errors.length > 0 && (
                  <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded">
                    <p className="font-medium text-red-900 mb-2">Errors:</p>
                    <ul className="text-xs text-red-700 space-y-1">
                      {importResult.errors.slice(0, 5).map((error, i) => (
                        <li key={i}>
                          Row {error.row + 1}: {error.error}
                        </li>
                      ))}
                      {importResult.errors.length > 5 && (
                        <li>... and {importResult.errors.length - 5} more</li>
                      )}
                    </ul>
                  </div>
                )}
              </>
            )}

            <div className="flex flex-wrap gap-3">
              <Link
                href="/scope3/data"
                className="inline-block bg-gray-600 text-white px-6 py-2 rounded hover:bg-gray-700"
              >
                View activity records
              </Link>
              <Link
                href="/scope3"
                className="inline-block border border-gray-300 text-gray-700 px-6 py-2 rounded hover:bg-gray-50"
              >
                Back to dashboard
              </Link>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Scope 3 CSV Import</h1>
          <p className="text-gray-600">Import activity data from CSV files</p>
        </div>
        <Link href="/scope3" className="text-gray-600 hover:text-gray-900">
          ← Back to Dashboard
        </Link>
      </div>

      {/* Progress Steps */}
      <div className="flex justify-between items-center mb-8">
        {IMPORT_STEPS.map((s) => (
          <div key={s.step} className="flex-1">
            <div className="flex items-center">
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full font-bold ${
                  currentStep >= s.step
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200 text-gray-600"
                }`}
              >
                {s.step}
              </div>
              {s.step < IMPORT_STEPS.length && (
                <div
                  className={`flex-1 h-1 mx-2 ${
                    currentStep > s.step ? "bg-blue-600" : "bg-gray-200"
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
  );
}
