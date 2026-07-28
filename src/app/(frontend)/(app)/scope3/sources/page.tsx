"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface ActivityDataField {
  name: string;
  unit: string;
  description?: string;
  required: boolean;
}

interface EmissionsFactor {
  value: number;
  unit: string;
  source: string;
  year: number;
  confidence?: string;
}

interface Source {
  id: string;
  type: string;
  name: string;
  description?: string;
  emissionsFactor: EmissionsFactor;
  activityDataFields: ActivityDataField[];
  createdAt: string;
}

export default function Scope3SourcesPage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    type: "supplier",
    name: "",
    description: "",
    emissionsFactor: {
      value: 0,
      unit: "",
      source: "DEFRA",
      year: new Date().getFullYear(),
      confidence: "medium",
    },
    activityDataFields: [{ name: "quantity", unit: "tonnes", required: true }],
  });

  useEffect(() => {
    async function fetchSources() {
      try {
        const response = await fetch("/api/app/scope3/sources");
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = (await response.json()) as { sources: Source[] };
        setSources(data.sources);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load sources");
      } finally {
        setLoading(false);
      }
    }

    void fetchSources();
  }, []);

  const refreshSources = async () => {
    try {
      const response = await fetch("/api/app/scope3/sources");
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = (await response.json()) as { sources: Source[] };
      setSources(data.sources);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sources");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch("/api/app/scope3/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create source");
      }

      setShowForm(false);
      setFormData({
        type: "supplier",
        name: "",
        description: "",
        emissionsFactor: {
          value: 0,
          unit: "",
          source: "DEFRA",
          year: new Date().getFullYear(),
          confidence: "medium",
        },
        activityDataFields: [{ name: "quantity", unit: "tonnes", required: true }],
      });
      await refreshSources();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create source");
    }
  };

  const categoryLabels: Record<string, string> = {
    supplier: "Supplier",
    investment: "Investment",
    waste: "Waste",
    business_travel: "Business Travel",
    employee_commute: "Employee Commute",
  };

  if (loading) return <div className="p-8">Loading sources...</div>;

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Scope 3 Sources</h1>
          <p className="text-gray-600">Define and manage emissions sources</p>
        </div>
        <Link href="/scope3" className="text-gray-600 hover:text-gray-900">
          ← Back to Dashboard
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-4 mb-6 text-red-700">
          {error}
        </div>
      )}

      <button
        onClick={() => setShowForm(!showForm)}
        className="mb-6 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
      >
        {showForm ? "Cancel" : "Create Source"}
      </button>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-lg border border-gray-200 p-6 mb-8"
        >
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-1">Type</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full border border-gray-300 rounded px-3 py-2"
              >
                <option value="supplier">Supplier</option>
                <option value="investment">Investment</option>
                <option value="waste">Waste</option>
                <option value="business_travel">Business Travel</option>
                <option value="employee_commute">Employee Commute</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full border border-gray-300 rounded px-3 py-2"
                required
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">
              Description (Optional)
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full border border-gray-300 rounded px-3 py-2"
              rows={2}
            />
          </div>

          <div className="border-t pt-4 mb-4">
            <h3 className="font-bold mb-4">Emissions Factor</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Value (tCO2e per unit)
                </label>
                <input
                  type="number"
                  step="0.0001"
                  value={formData.emissionsFactor.value}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      emissionsFactor: {
                        ...formData.emissionsFactor,
                        value: parseFloat(e.target.value),
                      },
                    })
                  }
                  className="w-full border border-gray-300 rounded px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Unit</label>
                <input
                  type="text"
                  value={formData.emissionsFactor.unit}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      emissionsFactor: {
                        ...formData.emissionsFactor,
                        unit: e.target.value,
                      },
                    })
                  }
                  placeholder="e.g., £, kg, miles"
                  className="w-full border border-gray-300 rounded px-3 py-2"
                  required
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
          >
            Create Source
          </button>
        </form>
      )}

      <div className="grid gap-6">
        {sources.length === 0 ? (
          <p className="text-gray-600">No sources yet. Create one to get started.</p>
        ) : (
          sources.map((source) => (
            <div
              key={source.id}
              className="bg-white rounded-lg border border-gray-200 p-6"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-bold">{source.name}</h3>
                  <p className="text-sm text-gray-600">
                    {categoryLabels[source.type] || source.type}
                  </p>
                </div>
                <span className="text-sm bg-gray-100 px-3 py-1 rounded">
                  {source.emissionsFactor.value} tCO2e/{source.emissionsFactor.unit}
                </span>
              </div>

              {source.description && (
                <p className="text-sm text-gray-600 mb-4">{source.description}</p>
              )}

              <div className="bg-gray-50 rounded p-4">
                <p className="text-xs font-medium text-gray-700 mb-2">Activity Fields:</p>
                <div className="space-y-1">
                  {source.activityDataFields.map((field) => (
                    <div key={field.name} className="text-xs text-gray-600">
                      • {field.name} ({field.unit})
                      {field.required && <span className="text-red-600"> *</span>}
                    </div>
                  ))}
                </div>
              </div>

              <p className="text-xs text-gray-500 mt-4">
                Source: {source.emissionsFactor.source} · Year:{" "}
                {source.emissionsFactor.year}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
