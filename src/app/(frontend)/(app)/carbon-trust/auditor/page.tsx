"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface CertificationItem {
  id: string;
  certificationId: string;
  organisation: string;
  status: string;
  completionPercentage: number;
  submittedAt: string;
  auditor?: { name?: string };
  itemSummary: {
    total: number;
    approved: number;
    pending: number;
    notStarted: number;
  };
}

interface DashboardData {
  certifications: CertificationItem[];
  grouped: Record<string, CertificationItem[]>;
  summary: Record<string, number>;
}

export default function AuditorDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const res = await fetch("/api/app/carbon-trust/auditor/dashboard");
        if (!res.ok) throw new Error("Failed to fetch dashboard");
        const result = await res.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, []);

  if (loading) return <div className="p-8">Loading...</div>;
  if (error) return <div className="p-8 text-red-600">Error: {error}</div>;
  if (!data) return <div className="p-8">No data</div>;

  return (
    <div className="space-y-8 p-8">
      <div>
        <h1 className="text-3xl font-bold">Auditor Dashboard</h1>
        <p className="text-gray-600">Manage Carbon Trust certifications under review</p>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-6">
        {[
          ["Total", data.summary.total, "bg-blue-100 text-blue-800"],
          ["Submitted", data.summary.submitted, "bg-yellow-100 text-yellow-800"],
          ["Reviewing", data.summary.underReview, "bg-purple-100 text-purple-800"],
          [
            "Requesting Info",
            data.summary.requestingInfo,
            "bg-orange-100 text-orange-800",
          ],
          ["Approved", data.summary.approved, "bg-green-100 text-green-800"],
          ["Certified", data.summary.certified, "bg-blue-500 text-white"],
        ].map(([label, count, colors]) => (
          <div key={label} className={`rounded-lg p-4 ${colors}`}>
            <div className="text-2xl font-bold">{count}</div>
            <div className="text-sm">{label}</div>
          </div>
        ))}
      </div>

      {/* Certifications by Status */}
      <div className="space-y-6">
        {/* Submitted */}
        {data.grouped.submitted.length > 0 && (
          <CertificationSection
            title="Submitted for Review"
            certifications={data.grouped.submitted}
            statusColor="yellow"
          />
        )}

        {/* Under Review */}
        {data.grouped.underReview.length > 0 && (
          <CertificationSection
            title="Under Review"
            certifications={data.grouped.underReview}
            statusColor="purple"
          />
        )}

        {/* Requesting Info */}
        {data.grouped.requestingInfo.length > 0 && (
          <CertificationSection
            title="Awaiting Organization Response"
            certifications={data.grouped.requestingInfo}
            statusColor="orange"
          />
        )}

        {/* Approved */}
        {data.grouped.approved.length > 0 && (
          <CertificationSection
            title="Approved (Ready to Finalize)"
            certifications={data.grouped.approved}
            statusColor="green"
          />
        )}

        {/* Rejected */}
        {data.grouped.rejected.length > 0 && (
          <CertificationSection
            title="Rejected"
            certifications={data.grouped.rejected}
            statusColor="red"
          />
        )}

        {/* Certified */}
        {data.grouped.certified.length > 0 && (
          <CertificationSection
            title="Certified"
            certifications={data.grouped.certified}
            statusColor="blue"
          />
        )}

        {data.certifications.length === 0 && (
          <div className="rounded-lg bg-gray-100 p-8 text-center text-gray-600">
            No certifications to review
          </div>
        )}
      </div>
    </div>
  );
}

function CertificationSection({
  title,
  certifications,
  statusColor,
}: {
  title: string;
  certifications: CertificationItem[];
  statusColor: string;
}) {
  const colorMap: Record<string, string> = {
    yellow: "border-yellow-300 bg-yellow-50",
    purple: "border-purple-300 bg-purple-50",
    orange: "border-orange-300 bg-orange-50",
    green: "border-green-300 bg-green-50",
    red: "border-red-300 bg-red-50",
    blue: "border-blue-300 bg-blue-50",
  };

  return (
    <div className={`rounded-lg border-2 p-6 ${colorMap[statusColor]}`}>
      <h2 className="mb-4 text-xl font-semibold">{title}</h2>
      <div className="space-y-3">
        {certifications.map((cert) => (
          <div
            key={cert.id}
            className="flex items-center justify-between rounded-lg bg-white p-4"
          >
            <div className="flex-1">
              <div className="font-semibold">
                {cert.organisation}
                <span className="ml-2 text-sm text-gray-600">
                  ({cert.certificationId})
                </span>
              </div>
              <div className="mt-1 text-sm text-gray-600">
                <div>
                  Progress: {cert.itemSummary.approved}/{cert.itemSummary.total} items
                  approved ({cert.completionPercentage}%)
                </div>
                {cert.submittedAt && (
                  <div>
                    Submitted:{" "}
                    {new Date(cert.submittedAt).toLocaleDateString("en-GB", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </div>
                )}
              </div>
              <div className="mt-2 flex gap-2">
                {cert.itemSummary.pending > 0 && (
                  <span className="inline-block rounded-full bg-orange-200 px-2 py-1 text-xs">
                    {cert.itemSummary.pending} pending
                  </span>
                )}
                {cert.itemSummary.notStarted > 0 && (
                  <span className="inline-block rounded-full bg-gray-200 px-2 py-1 text-xs">
                    {cert.itemSummary.notStarted} not started
                  </span>
                )}
              </div>
            </div>
            <div className="ml-4">
              <Link
                href={`/carbon-trust/auditor/${cert.id}`}
                className="inline-block rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
              >
                Review
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
