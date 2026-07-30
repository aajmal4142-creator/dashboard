"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

interface ChecklistItem {
  id: string;
  requirementId: string;
  requirementName: string;
  description: string;
  status: string;
  severity: string;
  category: string;
  response: string;
  auditorFeedback: string;
  auditorApprovedAt: string;
}

interface Certification {
  id: string;
  certificationId: string;
  status: string;
  completionPercentage: number;
  reviewNotes?: string;
  rejectionReason?: string;
}

interface CertificationData {
  certification: Certification;
  checklistItems: ChecklistItem[];
  auditTrail: Array<{
    action: string;
    description: string;
    createdAt: string;
  }>;
  summary: {
    total: number;
    approved: number;
    pending: number;
    notStarted: number;
  };
}

export default function AuditorReviewPage() {
  const params = useParams();
  const certId = params.certId as string;
  const [data, setData] = useState<CertificationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [feedbackMap, setFeedbackMap] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`/api/app/carbon-trust/${certId}/auditor`);
        if (!res.ok) throw new Error("Failed to fetch certification");
        const result = await res.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [certId]);

  const handleAction = async (action: string, itemId?: string, feedback?: string) => {
    if (!data) return;
    setActionLoading(true);

    try {
      const res = await fetch(`/api/app/carbon-trust/${certId}/auditor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          itemId,
          feedback: feedback || feedbackMap[itemId || ""],
          reason: feedback || feedbackMap[itemId || ""],
        }),
      });

      if (!res.ok) throw new Error("Failed to perform action");

      // Refresh data
      const refreshRes = await fetch(`/api/app/carbon-trust/${certId}/auditor`);
      const refreshData = await refreshRes.json();
      setData(refreshData);
      setFeedbackMap({});
      setExpandedItem(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to perform action");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <div className="p-8">Loading...</div>;
  if (error) return <div className="p-8 text-red-600">Error: {error}</div>;
  if (!data) return <div className="p-8">Not found</div>;

  const { certification, checklistItems, summary } = data;

  return (
    <div className="space-y-8 p-8">
      <div>
        <h1 className="text-3xl font-bold">Certification Review</h1>
        <p className="text-gray-600">
          {certification.certificationId} • Status:{" "}
          <span className="font-semibold capitalize">{certification.status}</span>
        </p>
      </div>

      {/* Summary */}
      <div className="grid gap-4 md:grid-cols-4 rounded-lg bg-gray-50 p-6">
        <div>
          <div className="text-2xl font-bold">{summary.total}</div>
          <div className="text-sm text-gray-600">Total Items</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-green-600">{summary.approved}</div>
          <div className="text-sm text-gray-600">Approved</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-orange-600">{summary.pending}</div>
          <div className="text-sm text-gray-600">Pending</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-gray-600">{summary.notStarted}</div>
          <div className="text-sm text-gray-600">Not Started</div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="rounded-lg bg-white p-4">
        <div className="mb-2 flex justify-between text-sm">
          <span className="font-semibold">Overall Progress</span>
          <span>{certification.completionPercentage}%</span>
        </div>
        <div className="h-4 rounded-full bg-gray-200">
          <div
            className="h-4 rounded-full bg-green-500 transition-all"
            style={{ width: `${certification.completionPercentage}%` }}
          />
        </div>
      </div>

      {/* Certification Status Actions */}
      {certification.status === "submitted" && (
        <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
          <p className="mb-3 font-semibold">Ready to start review?</p>
          <button
            onClick={() => handleAction("start-review")}
            disabled={actionLoading}
            className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:bg-gray-400"
          >
            Start Review
          </button>
        </div>
      )}

      {certification.status === "approved" && (
        <div className="rounded-lg bg-green-50 border border-green-200 p-4">
          <p className="mb-3 font-semibold">
            All items approved. Ready to issue certificate?
          </p>
          <button
            onClick={() => handleAction("finalize")}
            disabled={actionLoading}
            className="rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700 disabled:bg-gray-400"
          >
            Issue Certificate
          </button>
        </div>
      )}

      {/* Checklist Items */}
      <div className="space-y-3">
        <h2 className="text-xl font-semibold">Checklist Items</h2>

        {/* Filter tabs */}
        <div className="flex gap-2 border-b">
          {[
            { label: "All", value: null },
            { label: "Not Started", value: "not_started" },
            { label: "Pending", value: "additional_info_requested" },
            { label: "Approved", value: "approved" },
          ].map((tab) => (
            <button
              key={tab.value}
              className="px-3 py-2 text-sm font-medium hover:bg-gray-100"
            >
              {tab.label}
            </button>
          ))}
        </div>

        {checklistItems.map((item) => (
          <div
            key={item.id}
            className={`rounded-lg border-2 p-4 ${
              item.status === "approved"
                ? "border-green-300 bg-green-50"
                : item.status === "additional_info_requested"
                  ? "border-orange-300 bg-orange-50"
                  : "border-gray-200 bg-white"
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-block rounded px-2 py-1 text-xs font-semibold ${
                      item.severity === "critical"
                        ? "bg-red-200 text-red-800"
                        : item.severity === "high"
                          ? "bg-orange-200 text-orange-800"
                          : "bg-gray-200 text-gray-800"
                    }`}
                  >
                    {item.severity.toUpperCase()}
                  </span>
                  <h3 className="font-semibold">{item.requirementName}</h3>
                  <span className="text-sm text-gray-600">({item.requirementId})</span>
                </div>
                <p className="mt-2 text-sm text-gray-700">{item.description}</p>

                {expandedItem === item.id && (
                  <div className="mt-4 space-y-4 border-t pt-4">
                    <div>
                      <p className="text-sm font-semibold">Organization Response:</p>
                      <p className="mt-1 text-sm text-gray-700">
                        {item.response || "No response provided"}
                      </p>
                    </div>

                    {item.status !== "approved" && (
                      <div>
                        <label className="block text-sm font-semibold">
                          Auditor Feedback:
                        </label>
                        <textarea
                          value={feedbackMap[item.id] || ""}
                          onChange={(e) =>
                            setFeedbackMap({ ...feedbackMap, [item.id]: e.target.value })
                          }
                          className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-sm"
                          rows={3}
                          placeholder="Enter feedback or reason..."
                        />
                      </div>
                    )}

                    {item.auditorFeedback && (
                      <div>
                        <p className="text-sm font-semibold">Previous Feedback:</p>
                        <p className="mt-1 text-sm text-gray-700">
                          {item.auditorFeedback}
                        </p>
                      </div>
                    )}

                    <div className="flex gap-2">
                      {item.status !== "approved" && (
                        <>
                          <button
                            onClick={() => handleAction("approve-item", item.id)}
                            disabled={actionLoading}
                            className="rounded-lg bg-green-600 px-3 py-1 text-sm text-white hover:bg-green-700 disabled:bg-gray-400"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleAction("reject-item", item.id)}
                            disabled={actionLoading}
                            className="rounded-lg bg-orange-600 px-3 py-1 text-sm text-white hover:bg-orange-700 disabled:bg-gray-400"
                          >
                            Request Info
                          </button>
                        </>
                      )}
                      <button
                        onClick={() =>
                          setExpandedItem(expandedItem === item.id ? null : item.id)
                        }
                        className="rounded-lg bg-gray-200 px-3 py-1 text-sm hover:bg-gray-300"
                      >
                        {expandedItem === item.id ? "Collapse" : "Expand"}
                      </button>
                    </div>
                  </div>
                )}

                {expandedItem !== item.id && (
                  <button
                    onClick={() => setExpandedItem(item.id)}
                    className="mt-2 text-sm font-medium text-blue-600 hover:underline"
                  >
                    View Details →
                  </button>
                )}
              </div>
              <div className="ml-4 text-right">
                <span
                  className={`inline-block rounded px-2 py-1 text-xs font-medium ${
                    item.status === "approved"
                      ? "bg-green-200 text-green-800"
                      : item.status === "additional_info_requested"
                        ? "bg-orange-200 text-orange-800"
                        : "bg-gray-200 text-gray-800"
                  }`}
                >
                  {item.status.replace(/_/g, " ").toUpperCase()}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Bulk Actions */}
      {summary.pending > 0 && (
        <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
          <p className="mb-3 font-semibold">Bulk Actions</p>
          <button
            onClick={() => {
              const pendingIds = checklistItems
                .filter((i) => i.status === "additional_info_requested")
                .map((i) => i.id);
              handleAction("batch-approve", undefined, JSON.stringify(pendingIds));
            }}
            disabled={actionLoading}
            className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:bg-gray-400"
          >
            Approve All Pending Items
          </button>
        </div>
      )}
    </div>
  );
}
