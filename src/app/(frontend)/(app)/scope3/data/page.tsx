"use client";

import Link from "next/link";

export default function Scope3DataPage() {
  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Activity Data</h1>
          <p className="text-gray-600">View and manage Scope 3 activity records</p>
        </div>
        <Link href="/scope3" className="text-gray-600 hover:text-gray-900">
          ← Back to Dashboard
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-xl font-bold mb-4">Import Activity Data</h2>
          <p className="text-gray-600 mb-4">Upload activity records from CSV</p>
          <Link
            href="/scope3/import"
            className="inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            CSV Import
          </Link>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-xl font-bold mb-4">Activity Records</h2>
          <p className="text-gray-600 mb-4">View all activity records for this period</p>
          <p className="text-sm text-gray-500">Activity list feature coming soon</p>
        </div>
      </div>

      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="font-bold mb-2">Quick Stats</h3>
        <p className="text-sm text-gray-600">
          Activity data records are automatically validated and calculations are run upon
          import. View the dashboard to see total emissions by category.
        </p>
      </div>
    </div>
  );
}
