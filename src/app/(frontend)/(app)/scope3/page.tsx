"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

interface CategoryEmissions {
  category: string;
  emissions: number;
  sourceCount: number;
}

interface CalculationResult {
  total: number;
  byCategory: CategoryEmissions[];
  periodId: string;
  activityCount: number;
}

export default function Scope3Dashboard() {
  const searchParams = useSearchParams();
  const periodId = searchParams.get("periodId");
  const [data, setData] = useState<CalculationResult | null>(null);
  const [loading, setLoading] = useState(() => Boolean(periodId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!periodId) return;

    const fetchCalculations = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/app/scope3/calculations/${periodId}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const result = (await response.json()) as CalculationResult;
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load calculations");
      } finally {
        setLoading(false);
      }
    };

    void fetchCalculations();
  }, [periodId]);

  if (!periodId) {
    return (
      <div className="p-8">
        <p className="text-red-600">No reporting period selected</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-8">
        <p>Loading Scope3 emissions data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <p className="text-red-600">Error: {error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8">
        <p>No data available</p>
      </div>
    );
  }

  const categoryLabels: Record<string, string> = {
    supplier: "Supplier Emissions",
    investment: "Investment Emissions",
    waste: "Waste Management",
    business_travel: "Business Travel",
    employee_commute: "Employee Commute",
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Scope 3 Emissions</h1>
        <p className="text-gray-600">Multi-source emissions tracking and analysis</p>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <p className="text-sm text-gray-600 mb-2">Total Scope 3 Emissions</p>
          <p className="text-3xl font-bold">{data.total.toFixed(2)}</p>
          <p className="text-xs text-gray-500 mt-2">tonnes CO2e</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <p className="text-sm text-gray-600 mb-2">Activities Recorded</p>
          <p className="text-3xl font-bold">{data.activityCount}</p>
          <p className="text-xs text-gray-500 mt-2">for this period</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <p className="text-sm text-gray-600 mb-2">Categories</p>
          <p className="text-3xl font-bold">{data.byCategory.length}</p>
          <p className="text-xs text-gray-500 mt-2">active sources</p>
        </div>
      </div>

      {/* Category Breakdown */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
        <h2 className="text-xl font-bold mb-4">Emissions by Category</h2>
        {data.byCategory.length === 0 ? (
          <p className="text-gray-600">No emissions data available</p>
        ) : (
          <div className="space-y-4">
            {data.byCategory.map((category) => (
              <div
                key={category.category}
                className="border-b border-gray-100 pb-4 last:border-b-0"
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-medium">
                      {categoryLabels[category.category] || category.category}
                    </p>
                    <p className="text-xs text-gray-500">
                      {category.sourceCount} source{category.sourceCount !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <p className="text-lg font-bold">
                    {category.emissions.toFixed(2)} tCO2e
                  </p>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-green-600 h-2 rounded-full"
                    style={{
                      width: `${(category.emissions / data.total) * 100}%`,
                    }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Link
          href="/scope3/boundary"
          className="bg-blue-50 border border-blue-200 rounded-lg p-6 hover:bg-blue-100 transition"
        >
          <h3 className="font-bold mb-2">Boundary — Cat 1–15</h3>
          <p className="text-sm text-gray-600">
            All 15 GHG Protocol categories: inclusion/exclusion and rationale
          </p>
        </Link>
        <Link
          href="/scope3/sources"
          className="bg-blue-50 border border-blue-200 rounded-lg p-6 hover:bg-blue-100 transition"
        >
          <h3 className="font-bold mb-2">Manage Sources</h3>
          <p className="text-sm text-gray-600">Create and configure Scope 3 sources</p>
        </Link>
        <Link
          href="/scope3/travel"
          className="bg-blue-50 border border-blue-200 rounded-lg p-6 hover:bg-blue-100 transition"
        >
          <h3 className="font-bold mb-2">Travel & commuting</h3>
          <p className="text-sm text-gray-600">
            Cat 6 mode-split travel and Cat 7 commute datapoints
          </p>
        </Link>
        <Link
          href="/scope3/freight"
          className="bg-blue-50 border border-blue-200 rounded-lg p-6 hover:bg-blue-100 transition"
        >
          <h3 className="font-bold mb-2">Freight & logistics</h3>
          <p className="text-sm text-gray-600">
            Cat 4 upstream and Cat 9 downstream tonne-km by mode
          </p>
        </Link>
        <Link
          href="/scope3/data"
          className="bg-blue-50 border border-blue-200 rounded-lg p-6 hover:bg-blue-100 transition"
        >
          <h3 className="font-bold mb-2">Activity records</h3>
          <p className="text-sm text-gray-600">
            List, filter, edit, and delete CSV-imported Scope 3 activities
          </p>
        </Link>
        <Link
          href="/scope3/gst-hsn"
          className="bg-blue-50 border border-blue-200 rounded-lg p-6 hover:bg-blue-100 transition"
        >
          <h3 className="font-bold mb-2">GST / HSN → Scope 3 (India)</h3>
          <p className="text-sm text-gray-600">
            Paste GST invoice lines to preview a Scope 3 category + spend mapping
          </p>
        </Link>
      </div>
    </div>
  );
}
