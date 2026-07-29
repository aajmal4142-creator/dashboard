"use client";

import { RiskScoreBreakdown } from "@/lib/suppliers/riskScoringEngine";
import { AlertCircle } from "lucide-react";

interface SupplierInfo {
  id: string;
  name: string;
  category: string;
  annualSpend: number | null;
  contactEmail: string;
}

function getRiskColor(tier: string): string {
  switch (tier) {
    case "low":
      return "text-green-600";
    case "medium":
      return "text-yellow-600";
    case "high":
      return "text-orange-600";
    case "critical":
      return "text-red-600";
    default:
      return "text-gray-600";
  }
}

function getRiskBgColor(tier: string): string {
  switch (tier) {
    case "low":
      return "bg-green-50 border-green-200";
    case "medium":
      return "bg-yellow-50 border-yellow-200";
    case "high":
      return "bg-orange-50 border-orange-200";
    case "critical":
      return "bg-red-50 border-red-200";
    default:
      return "bg-gray-50 border-gray-200";
  }
}

function getTierDescription(tier: string): string {
  switch (tier) {
    case "low":
      return "Supplier has strong ESG data and credentials. Low risk.";
    case "medium":
      return "Supplier has partial ESG data. Some engagement needed.";
    case "high":
      return "Supplier ESG data incomplete or concerning signals. Engagement recommended.";
    case "critical":
      return "Supplier has very limited ESG data or significant red flags. Escalation needed.";
    default:
      return "";
  }
}

export function RiskBreakdownClient({
  supplier,
  breakdown,
}: {
  supplier: SupplierInfo;
  breakdown: RiskScoreBreakdown | null;
}) {
  if (!breakdown) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-yellow-800">
          Risk score could not be calculated. Please ensure the supplier has submitted
          questionnaire data.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overall Risk Score */}
      <div className={`rounded-lg border-2 p-6 ${getRiskBgColor(breakdown.tier)}`}>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600 mb-2">Overall Risk Score</p>
            <div className="flex items-baseline gap-4">
              <p className={`text-5xl font-bold ${getRiskColor(breakdown.tier)}`}>
                {breakdown.totalScore}
              </p>
              <span
                className={`px-3 py-1 rounded-full font-semibold text-sm uppercase tracking-wider ${getRiskColor(breakdown.tier)}`}
              >
                {breakdown.tier}
              </span>
            </div>
            <p className="text-sm text-gray-600 mt-3">
              {getTierDescription(breakdown.tier)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-600 mb-2">Data Quality</p>
            <p
              className={`text-lg font-semibold ${
                breakdown.dataQuality === "high"
                  ? "text-green-600"
                  : breakdown.dataQuality === "medium"
                    ? "text-yellow-600"
                    : "text-red-600"
              }`}
            >
              {breakdown.dataQuality === "high"
                ? "High"
                : breakdown.dataQuality === "medium"
                  ? "Medium"
                  : "Low"}
            </p>
          </div>
        </div>
      </div>

      {/* Risk Factor Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Questionnaire Completeness */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-sm font-medium text-gray-700">
                Questionnaire Completeness
              </p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {breakdown.factors.questionnnaireCompleteness.score}
              </p>
            </div>
            <span className="text-xs font-semibold text-gray-600 bg-gray-100 px-2 py-1 rounded">
              40% weight
            </span>
          </div>
          <div className="space-y-2 text-xs text-gray-600">
            <p>• 80-100% answered: 0-20 risk (low)</p>
            <p>• 50-80%: 20-40 risk (medium)</p>
            <p>• &lt;50%: 40-100 risk (high)</p>
          </div>
        </div>

        {/* UN Global Compact */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-sm font-medium text-gray-700">UN Global Compact</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {breakdown.factors.unGcSignatory.score}
              </p>
            </div>
            <span className="text-xs font-semibold text-gray-600 bg-gray-100 px-2 py-1 rounded">
              20% weight
            </span>
          </div>
          <div className="space-y-2 text-xs text-gray-600">
            <p>• Signatory: -10 risk (good)</p>
            <p>• Not signatory: 0 risk (neutral)</p>
          </div>
        </div>

        {/* Certifications */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-sm font-medium text-gray-700">Certifications</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {breakdown.factors.certifications.score}
              </p>
            </div>
            <span className="text-xs font-semibold text-gray-600 bg-gray-100 px-2 py-1 rounded">
              20% weight
            </span>
          </div>
          <div className="space-y-2 text-xs text-gray-600">
            <p>• Has ESG certs: -10 (good)</p>
            <p>• No certs: +10 (concerning)</p>
            <p>Recognized: ISO 14001, B Corp, Fair Trade, etc.</p>
          </div>
        </div>

        {/* Government Data */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-sm font-medium text-gray-700">Government Data</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {breakdown.factors.governmentData.score}
              </p>
            </div>
            <span className="text-xs font-semibold text-gray-600 bg-gray-100 px-2 py-1 rounded">
              20% weight
            </span>
          </div>
          <div className="space-y-2 text-xs text-gray-600">
            <p>• Found in EU ETS with declining emissions: -10 (good)</p>
            <p>• Found with stable/increasing emissions: +10 (concerning)</p>
            <p>• Not found: 0 (neutral)</p>
          </div>
        </div>
      </div>

      {/* Supplier Info */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Supplier Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <p className="text-sm text-gray-600">Name</p>
            <p className="text-lg font-medium text-gray-900">{supplier.name}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Category</p>
            <p className="text-lg font-medium text-gray-900">{supplier.category}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Email</p>
            <p className="text-lg font-medium text-gray-900">{supplier.contactEmail}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Annual Spend</p>
            <p className="text-lg font-medium text-gray-900">
              {supplier.annualSpend
                ? `$${(supplier.annualSpend / 1000000).toFixed(2)}M`
                : "Not specified"}
            </p>
          </div>
        </div>
      </div>

      {/* Recommendations */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-4 flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          Recommendations
        </h3>
        <ul className="space-y-3 text-sm text-blue-800">
          {breakdown.tier === "critical" && (
            <>
              <li>
                • <strong>Escalation Needed:</strong> This supplier has very limited ESG
                data or significant red flags. Immediate engagement is recommended.
              </li>
              <li>
                • Request complete questionnaire response with detailed emissions data.
              </li>
              <li>
                • Consider third-party assessment or on-site audit for critical suppliers.
              </li>
            </>
          )}
          {breakdown.tier === "high" && (
            <>
              <li>
                • <strong>Engagement Required:</strong> ESG data is incomplete. Send
                follow-up questionnaire.
              </li>
              <li>
                • Look for government data sources (EU ETS, SEC filings) to supplement.
              </li>
              <li>• Request specific certifications (ISO 14001, etc.) if applicable.</li>
            </>
          )}
          {breakdown.tier === "medium" && (
            <>
              <li>
                • <strong>Partial Engagement:</strong> Supplier has provided some ESG
                data.
              </li>
              <li>
                • Continue engagement to improve data completeness and certification
                status.
              </li>
              <li>
                • Monitor for UN Global Compact adoption or third-party certifications.
              </li>
            </>
          )}
          {breakdown.tier === "low" && (
            <>
              <li>
                • <strong>Low Risk:</strong> Supplier has strong ESG data and credentials.
              </li>
              <li>• Continue periodic monitoring to maintain strong risk profile.</li>
              <li>• Potential partner for sustainability initiatives.</li>
            </>
          )}
        </ul>
      </div>
    </div>
  );
}
