"use client";

import { useState } from "react";
import {
  Upload,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  Download,
} from "lucide-react";

type Step = "upload" | "preview" | "confirm" | "results";

interface PreviewItem {
  row: {
    supplier_name: string;
    email: string;
  };
  status: "new" | "duplicate" | "error";
  message: string;
}

interface ImportResult {
  rowIndex: number;
  supplierName: string;
  email: string;
  status: "created" | "existing" | "error" | "skipped";
  supplierId?: string;
  message?: string;
}

interface ImportSummary {
  totalRows: number;
  created: number;
  existing: number;
  errors: number;
  skipped: number;
  results: ImportResult[];
  errorDetails: string[];
}

const SAMPLE_CSV = `supplier_name,email,industry,region,annual_spend
ABC Manufacturing,contact@abc-mfg.com,Purchased goods,North America,5000000
XYZ Logistics,info@xyz-logistics.com,Transport,Europe,2500000
Global Tech Solutions,support@globaltech.com,Technology,Asia,1000000`;

export function BulkImportClient() {
  const [step, setStep] = useState<Step>("upload");
  const [csvData, setCsvData] = useState("");
  const [preview, setPreview] = useState<PreviewItem[] | null>(null);
  const [importResult, setImportResult] = useState<ImportSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sendQuestionnaires, setSendQuestionnaires] = useState(true);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      setCsvData(text);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to read file");
    }
  };

  const handlePreview = async () => {
    if (!csvData) {
      setError("Please provide CSV data");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/app/suppliers/bulk-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvData, dryRun: true }),
      });

      if (!response.ok) throw new Error("Failed to generate preview");

      const data = await response.json();
      setPreview(data.preview);
      setStep("preview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmImport = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/app/suppliers/bulk-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          csvData,
          dryRun: false,
          sendQuestionnaires,
        }),
      });

      if (!response.ok) throw new Error("Import failed");

      const data = await response.json();
      setImportResult(data.importResult);
      setStep("results");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadSample = () => {
    const blob = new Blob([SAMPLE_CSV], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "supplier-template.csv";
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Bulk Supplier Import</h1>
        <p className="text-gray-500 mt-2">Import multiple suppliers from CSV file</p>
      </div>

      {/* Progress Indicator */}
      <div className="flex items-center justify-between">
        {["upload", "preview", "confirm", "results"].map((s, idx) => (
          <div key={s} className="flex items-center flex-1">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold ${
                step === s
                  ? "bg-blue-600 text-white"
                  : ["upload", "preview", "confirm"].indexOf(s) <
                      ["upload", "preview", "confirm"].indexOf(step)
                    ? "bg-green-600 text-white"
                    : "bg-gray-300 text-gray-700"
              }`}
            >
              {["upload", "preview", "confirm"].indexOf(s) <
              ["upload", "preview", "confirm"].indexOf(step)
                ? "✓"
                : idx + 1}
            </div>
            {idx < 3 && <div className="flex-1 h-1 mx-2 bg-gray-300" />}
          </div>
        ))}
      </div>

      {/* Steps */}
      {step === "upload" && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Step 1: Upload CSV File
            </h2>

            {/* Upload Area */}
            <div
              className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50"
              onDragOver={(e) => {
                e.preventDefault();
                e.currentTarget.classList.add("border-blue-500", "bg-blue-50");
              }}
              onDragLeave={(e) => {
                e.currentTarget.classList.remove("border-blue-500", "bg-blue-50");
              }}
              onDrop={async (e) => {
                e.preventDefault();
                e.currentTarget.classList.remove("border-blue-500", "bg-blue-50");
                const file = e.dataTransfer.files[0];
                if (!file) return;
                try {
                  const text = await file.text();
                  setCsvData(text);
                  setError(null);
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Failed to read file");
                }
              }}
            >
              <Upload className="w-12 h-12 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-900 font-medium">Drag and drop your CSV file</p>
              <p className="text-gray-500 text-sm mt-1">or click to browse</p>
              <input
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileUpload}
                onClick={(e) => {
                  const input = e.target as HTMLInputElement;
                  input.value = "";
                }}
              />
            </div>

            {/* Alternative Upload */}
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Or paste CSV data:
              </label>
              <textarea
                value={csvData}
                onChange={(e) => {
                  setCsvData(e.target.value);
                  setError(null);
                }}
                placeholder="supplier_name,email,industry,annual_spend&#10;Company A,contact@a.com,Manufacturing,1000000"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                rows={6}
              />
            </div>

            {/* Sample Download */}
            <button
              onClick={handleDownloadSample}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-blue-600 hover:text-blue-700 font-medium"
            >
              <Download className="w-4 h-4" />
              Download CSV Template
            </button>

            {/* Required Columns */}
            <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm font-medium text-blue-900 mb-2">Required Columns:</p>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>
                  • <strong>supplier_name</strong> - Supplier company name
                </li>
                <li>
                  • <strong>email</strong> - Contact email address
                </li>
                <li>
                  • <strong>industry</strong> (optional) - Business category
                </li>
                <li>
                  • <strong>annual_spend</strong> (optional) - Annual spend amount
                </li>
              </ul>
            </div>

            {error && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
                {error}
              </div>
            )}

            <button
              onClick={handlePreview}
              disabled={!csvData || loading}
              className="mt-6 w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 flex items-center justify-center gap-2 font-medium"
            >
              {loading ? "Loading..." : "Continue to Preview"}
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {step === "preview" && preview && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Step 2: Review Import Preview
            </h2>

            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                <p className="text-green-600 text-sm font-medium">New Suppliers</p>
                <p className="text-3xl font-bold text-green-700 mt-1">
                  {preview.filter((p) => p.status === "new").length}
                </p>
              </div>
              <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
                <p className="text-yellow-600 text-sm font-medium">Duplicates</p>
                <p className="text-3xl font-bold text-yellow-700 mt-1">
                  {preview.filter((p) => p.status === "duplicate").length}
                </p>
              </div>
              <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                <p className="text-red-600 text-sm font-medium">Errors</p>
                <p className="text-3xl font-bold text-red-700 mt-1">
                  {preview.filter((p) => p.status === "error").length}
                </p>
              </div>
            </div>

            <div className="overflow-x-auto max-h-96 border border-gray-200 rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-gray-700">
                      Status
                    </th>
                    <th className="px-4 py-2 text-left font-medium text-gray-700">
                      Supplier Name
                    </th>
                    <th className="px-4 py-2 text-left font-medium text-gray-700">
                      Email
                    </th>
                    <th className="px-4 py-2 text-left font-medium text-gray-700">
                      Message
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {preview.map((item, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-4 py-2">
                        {item.status === "new" && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-medium">
                            <CheckCircle2 className="w-3 h-3" />
                            New
                          </span>
                        )}
                        {item.status === "duplicate" && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs font-medium">
                            Duplicate
                          </span>
                        )}
                        {item.status === "error" && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-800 rounded text-xs font-medium">
                            <AlertTriangle className="w-3 h-3" />
                            Error
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2">{item.row.supplier_name}</td>
                      <td className="px-4 py-2">{item.row.email}</td>
                      <td className="px-4 py-2 text-gray-600">{item.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-6">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sendQuestionnaires}
                  onChange={(e) => setSendQuestionnaires(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600"
                />
                <span className="text-sm text-gray-700">
                  Send questionnaires to newly created suppliers
                </span>
              </label>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setStep("upload")}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
              >
                Back
              </button>
              <button
                onClick={() => setStep("confirm")}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center justify-center gap-2"
              >
                Proceed to Import
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {step === "confirm" && preview && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Step 3: Confirm Import
            </h2>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
              <p className="text-amber-900 font-medium mb-2">Ready to import?</p>
              <p className="text-sm text-amber-800">
                This will create{" "}
                <strong>
                  {preview.filter((p) => p.status === "new").length} new suppliers
                </strong>{" "}
                and send questionnaires if enabled.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep("preview")}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
              >
                Back
              </button>
              <button
                onClick={handleConfirmImport}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 font-medium"
              >
                {loading ? "Importing..." : "Start Import"}
              </button>
            </div>
          </div>
        </div>
      )}

      {step === "results" && importResult && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Step 4: Import Complete
            </h2>

            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                <p className="text-green-600 text-sm font-medium">Created</p>
                <p className="text-3xl font-bold text-green-700 mt-1">
                  {importResult.created}
                </p>
              </div>
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <p className="text-blue-600 text-sm font-medium">Existing</p>
                <p className="text-3xl font-bold text-blue-700 mt-1">
                  {importResult.existing}
                </p>
              </div>
              <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
                <p className="text-yellow-600 text-sm font-medium">Skipped</p>
                <p className="text-3xl font-bold text-yellow-700 mt-1">
                  {importResult.skipped}
                </p>
              </div>
              <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                <p className="text-red-600 text-sm font-medium">Errors</p>
                <p className="text-3xl font-bold text-red-700 mt-1">
                  {importResult.errors}
                </p>
              </div>
            </div>

            {importResult.errorDetails.length > 0 && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-900 font-medium mb-2">Errors:</p>
                <ul className="text-sm text-red-800 space-y-1">
                  {importResult.errorDetails.map((error, idx) => (
                    <li key={idx}>• {error}</li>
                  ))}
                </ul>
              </div>
            )}

            <button
              onClick={() => {
                setStep("upload");
                setCsvData("");
                setPreview(null);
                setImportResult(null);
              }}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              Import Another Batch
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
