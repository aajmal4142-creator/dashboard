"use client";

import { PageFrame } from "@/components/shell/PageFrame";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, BarChart3, CheckCircle, FileText } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

interface TaxonomyAlignment {
  totalActivities: number;
  alignedActivities: number;
  alignmentPercentage: number;
  financialAlignment: {
    totalValue: number;
    alignedValue: number;
    percentage: number;
  };
  byEconomicActivity: Record<string, { count: number; aligned: number }>;
  sfdrDisclosure: {
    article10: boolean;
    alignedPercentage: number;
    alignedActivitiesList: string[];
  };
}

interface SFDRDisclosure {
  article10Text: string;
  disclosureDate: string;
  regulatoryFramework: string;
  sfdrRegulation: string;
}

function TaxonomyContent() {
  const searchParams = useSearchParams();
  const periodId = searchParams.get("periodId") || "";

  const [loading, setLoading] = useState(true);
  const [alignment, setAlignment] = useState<TaxonomyAlignment | null>(null);
  const [sfdrDisclosure, setSFDRDisclosure] = useState<SFDRDisclosure | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchTaxonomyAlignment() {
      try {
        setLoading(true);
        const url = new URL("/api/app/frameworks/taxonomy", window.location.origin);
        if (periodId) {
          url.searchParams.append("periodId", periodId);
          url.searchParams.append("includeFinancial", "true");
        }

        const res = await fetch(url.toString());
        const data = (await res.json()) as {
          alignment: TaxonomyAlignment;
          sfdrDisclosure: SFDRDisclosure;
        };
        if (cancelled) return;

        setAlignment(data.alignment);
        setSFDRDisclosure(data.sfdrDisclosure);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load alignment");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void fetchTaxonomyAlignment();
    return () => {
      cancelled = true;
    };
  }, [periodId]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-48 bg-gray-200 animate-pulse rounded-lg" />
        <div className="h-64 bg-gray-200 animate-pulse rounded-lg" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert className="border-red-200 bg-red-50">
        <AlertCircle className="h-4 w-4 text-red-600" />
        <AlertDescription className="text-red-800">{error}</AlertDescription>
      </Alert>
    );
  }

  if (!alignment) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Select a reporting period to view EU Green Taxonomy alignment.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="from-blue-50 to-blue-100 rounded-lg p-6 border border-blue-200">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-blue-600 font-medium">Activity Alignment</p>
              <p className="text-3xl font-bold text-blue-900 mt-2">
                {alignment.alignmentPercentage}%
              </p>
              <p className="text-xs text-blue-700 mt-1">
                {alignment.alignedActivities} of {alignment.totalActivities} aligned
              </p>
            </div>
            <CheckCircle className="w-10 h-10 text-blue-600" />
          </div>
        </div>

        <div className="from-green-50 to-green-100 rounded-lg p-6 border border-green-200">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-green-600 font-medium">Financial Alignment</p>
              <p className="text-3xl font-bold text-green-900 mt-2">
                {alignment.financialAlignment.percentage}%
              </p>
              <p className="text-xs text-green-700 mt-1">
                €{(alignment.financialAlignment.alignedValue / 1000).toFixed(1)}k of€
                {(alignment.financialAlignment.totalValue / 1000).toFixed(1)}k
              </p>
            </div>
            <BarChart3 className="w-10 h-10 text-green-600" />
          </div>
        </div>

        <div className="from-purple-50 to-purple-100 rounded-lg p-6 border border-purple-200">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-purple-600 font-medium">Economic Sectors</p>
              <p className="text-3xl font-bold text-purple-900 mt-2">
                {Object.keys(alignment.byEconomicActivity).length}
              </p>
              <p className="text-xs text-purple-700 mt-1">Sectors represented</p>
            </div>
            <FileText className="w-10 h-10 text-purple-600" />
          </div>
        </div>
      </div>

      {/* SFDR Article 10 Disclosure */}
      {sfdrDisclosure && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 mt-1" />
            <div className="flex-1">
              <h3 className="font-bold text-amber-900 mb-2">
                SFDR Article 10 Disclosure
              </h3>
              <p className="text-sm text-amber-800 mb-4">
                {sfdrDisclosure.article10Text}
              </p>
              <div className="flex gap-4 text-xs text-amber-700">
                <div>
                  <p className="font-medium">Regulatory Framework</p>
                  <p>{sfdrDisclosure.regulatoryFramework}</p>
                </div>
                <div>
                  <p className="font-medium">SFDR</p>
                  <p>{sfdrDisclosure.sfdrRegulation}</p>
                </div>
                <div>
                  <p className="font-medium">Disclosure Date</p>
                  <p>{new Date(sfdrDisclosure.disclosureDate).toLocaleDateString()}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Breakdown by Economic Activity */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-bold mb-4">Alignment by Economic Activity</h3>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Sector</th>
                <th className="px-4 py-3 text-center font-medium">Activities</th>
                <th className="px-4 py-3 text-center font-medium">Aligned</th>
                <th className="px-4 py-3 text-right font-medium">Alignment %</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(alignment.byEconomicActivity)
                .sort((a, b) => b[1].aligned - a[1].aligned)
                .map(([sector, data]) => (
                  <tr key={sector} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3">{sector}</td>
                    <td className="px-4 py-3 text-center">{data.count}</td>
                    <td className="px-4 py-3 text-center font-medium text-green-600">
                      {data.aligned}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {data.count > 0
                        ? ((data.aligned / data.count) * 100).toFixed(0)
                        : 0}
                      %
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Aligned Activities List */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-bold mb-4">Aligned Economic Activities</h3>

        <div className="bg-blue-50 rounded p-4 border border-blue-200">
          <p className="text-sm text-blue-900 font-mono">
            {alignment.sfdrDisclosure.alignedActivitiesList.length > 0
              ? alignment.sfdrDisclosure.alignedActivitiesList.join(", ")
              : "No aligned activities"}
          </p>
        </div>

        <p className="text-xs text-gray-600 mt-3">
          These taxonomy codes represent economic activities that contribute to climate
          change mitigation objectives in accordance with EU Taxonomy Regulation (EU)
          2020/852.
        </p>
      </div>

      {/* About EU Taxonomy */}
      <div className="bg-gray-50 rounded-lg border border-gray-200 p-6">
        <h3 className="font-bold mb-2">About EU Green Taxonomy</h3>
        <p className="text-sm text-gray-700 mb-3">
          The EU Taxonomy is a classification system for sustainable economic activities.
          It helps investors and companies identify which activities can be considered
          environmentally sustainable. This dashboard measures the alignment of your
          organisation activities with the taxonomy criteria for climate change
          mitigation.
        </p>
        <div className="grid grid-cols-2 gap-4 text-xs text-gray-600">
          <div>
            <p className="font-medium text-gray-900">Regulation</p>
            <p>EU Taxonomy Regulation (EU) 2020/852</p>
          </div>
          <div>
            <p className="font-medium text-gray-900">SFDR Framework</p>
            <p>Regulation (EU) 2019/2088 (SFDR)</p>
          </div>
        </div>
      </div>

      <Link
        href="/frameworks"
        className="text-gray-600 hover:text-gray-900 underline text-sm"
      >
        ← Back to Frameworks
      </Link>
    </div>
  );
}

export default function TaxonomyPage() {
  return (
    <PageFrame eyebrow="Compliance" title="EU Green Taxonomy Alignment">
      <Suspense
        fallback={
          <div className="space-y-4">
            <div className="h-48 bg-gray-200 animate-pulse rounded-lg" />
          </div>
        }
      >
        <TaxonomyContent />
      </Suspense>
    </PageFrame>
  );
}
