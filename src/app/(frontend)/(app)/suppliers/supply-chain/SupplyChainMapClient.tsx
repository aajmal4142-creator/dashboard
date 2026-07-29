"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Download } from "lucide-react";

interface GraphNode {
  id: string;
  label: string;
  tier: number;
  spend: number;
  emissions: number;
  value: number;
  color: string;
}

interface GraphLink {
  source: string;
  target: string;
  weight: number;
  type: "spend" | "emissions";
}

interface Bottleneck {
  type: "spend" | "emissions" | "geographic" | "category";
  severity: "low" | "medium" | "high" | "critical";
  message: string;
  affectedSuppliers: string[];
  recommendations: string[];
  metric: number;
}

interface SupplyChainData {
  graph: {
    nodes: GraphNode[];
    links: GraphLink[];
    stats: {
      totalSuppliers: number;
      totalSpend: number;
      totalEmissions: number;
    };
  };
  bottlenecks: {
    herfindahlSpend: number;
    herfindahlEmissions: number;
    concentrationLevel: "low" | "medium" | "high" | "critical";
    topThreeSpendPct: number;
    topThreeEmissionsPct: number;
    bottlenecks: Bottleneck[];
  };
}

function getSeverityColor(severity: string): string {
  switch (severity) {
    case "critical":
      return "bg-red-50 border-red-200";
    case "high":
      return "bg-orange-50 border-orange-200";
    case "medium":
      return "bg-yellow-50 border-yellow-200";
    default:
      return "bg-blue-50 border-blue-200";
  }
}

function getSeverityIcon(severity: string) {
  switch (severity) {
    case "critical":
    case "high":
      return <AlertTriangle className="w-5 h-5 text-red-600" />;
    default:
      return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
  }
}

export function SupplyChainMapClient() {
  const [data, setData] = useState<SupplyChainData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const response = await fetch("/api/app/suppliers/supply-chain-map");
        if (!response.ok) throw new Error("Failed to load supply chain map");
        const json = await response.json();
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-gray-500">Loading supply chain map...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
        {error || "Failed to load supply chain map"}
      </div>
    );
  }

  const { graph, bottlenecks } = data;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Supply Chain Map</h1>
        <p className="text-gray-500 mt-2">
          Visualize supplier relationships, dependencies, and concentration risks
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-blue-500">
          <p className="text-gray-500 text-sm">Total Suppliers</p>
          <p className="text-2xl font-bold text-gray-900">{graph.stats.totalSuppliers}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-purple-500">
          <p className="text-gray-500 text-sm">Total Annual Spend</p>
          <p className="text-2xl font-bold text-gray-900">
            ${(graph.stats.totalSpend / 1000000).toFixed(1)}M
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-green-500">
          <p className="text-gray-500 text-sm">Concentration Level</p>
          <p
            className={`text-2xl font-bold ${
              bottlenecks.concentrationLevel === "critical"
                ? "text-red-600"
                : bottlenecks.concentrationLevel === "high"
                  ? "text-orange-600"
                  : bottlenecks.concentrationLevel === "medium"
                    ? "text-yellow-600"
                    : "text-green-600"
            }`}
          >
            {bottlenecks.concentrationLevel.charAt(0).toUpperCase() +
              bottlenecks.concentrationLevel.slice(1)}
          </p>
        </div>
      </div>

      {/* Graph Visualization */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Network Visualization</h2>
          <button className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <Download className="w-4 h-4" />
            Export SVG
          </button>
        </div>

        <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 text-center text-gray-600">
          <p>Interactive network graph visualization</p>
          <p className="text-sm mt-2">
            {graph.nodes.length} nodes • {graph.links.length} connections
          </p>
          <p className="text-xs text-gray-500 mt-2">
            (SVG/PNG visualization would render here with React Force Graph)
          </p>
        </div>
      </div>

      {/* Concentration Analysis */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Spend Concentration
          </h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-2">
                <p className="text-sm text-gray-600">Herfindahl Index</p>
                <p className="text-lg font-bold text-gray-900">
                  {(bottlenecks.herfindahlSpend * 100).toFixed(1)}%
                </p>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full"
                  style={{ width: `${bottlenecks.herfindahlSpend * 100}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">0% = diverse, 100% = monopoly</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-2">Top 3 Suppliers</p>
              <p className="text-2xl font-bold text-gray-900">
                {bottlenecks.topThreeSpendPct.toFixed(1)}%
              </p>
              <p className="text-xs text-gray-500">of total spend</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Emissions Concentration
          </h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-2">
                <p className="text-sm text-gray-600">Herfindahl Index</p>
                <p className="text-lg font-bold text-gray-900">
                  {(bottlenecks.herfindahlEmissions * 100).toFixed(1)}%
                </p>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-green-600 h-2 rounded-full"
                  style={{ width: `${bottlenecks.herfindahlEmissions * 100}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">0% = diverse, 100% = monopoly</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-2">Top 3 Emitters</p>
              <p className="text-2xl font-bold text-gray-900">
                {bottlenecks.topThreeEmissionsPct.toFixed(1)}%
              </p>
              <p className="text-xs text-gray-500">of total Scope 3</p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottleneck Detection */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-900">Identified Bottlenecks</h2>

        {bottlenecks.bottlenecks.length === 0 ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-green-800">
              ✓ No significant bottlenecks detected. Supply chain is well-diversified.
            </p>
          </div>
        ) : (
          bottlenecks.bottlenecks.map((bottleneck, idx) => (
            <div
              key={idx}
              className={`rounded-lg border-2 p-6 ${getSeverityColor(bottleneck.severity)}`}
            >
              <div className="flex items-start gap-4">
                <div>{getSeverityIcon(bottleneck.severity)}</div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-2">
                    {bottleneck.message}
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-2">
                        Affected Suppliers:
                      </p>
                      <ul className="text-sm text-gray-700 space-y-1">
                        {bottleneck.affectedSuppliers.map((supplier) => (
                          <li key={supplier}>• {supplier}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-2">
                        Recommendations:
                      </p>
                      <ul className="text-sm text-gray-700 space-y-1">
                        {bottleneck.recommendations.map((rec, ridx) => (
                          <li key={ridx}>• {rec}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Legend */}
      <div className="bg-gray-50 rounded-lg border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Legend</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-green-500" />
            <span>Low Risk</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-yellow-500" />
            <span>Medium Risk</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-orange-500" />
            <span>High Risk</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-red-500" />
            <span>Critical Risk</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-blue-500" />
            <span>Your Organization</span>
          </div>
        </div>
      </div>
    </div>
  );
}
