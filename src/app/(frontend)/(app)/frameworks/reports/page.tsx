import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ReportGeneration() {
  const report = null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Framework Reports</h1>
        <p className="text-gray-600 mt-1">Generate and export compliance reports</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Generate Report</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-sm text-blue-900">
              Select a framework and reporting period, then generate the compliance report
              using the API endpoint:
              <code className="block mt-2 text-xs bg-white p-2 rounded">
                GET /api/app/frameworks/[framework]/report?periodId=[periodId]
              </code>
            </p>
          </div>
        </CardContent>
      </Card>

      {report === null && (
        <Card>
          <CardHeader>
            <CardTitle>Example Report Output</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600">
              Reports are generated dynamically via the API. Here is the structure:
            </p>
            <div className="bg-gray-50 p-4 rounded border text-xs overflow-x-auto">
              <pre>{`{
  success: true,
  framework: "csrd",
  periodId: "period-123",
  report: {
    generatedAt: "2026-07-28T...",
    metrics: [...],
    complianceScore: {
      score: 75,
      status: "partial",
      metricsProvided: 4,
      metricsRequired: 6
    },
    targets: [...],
    trajectory: {...},
    dataGaps: [...],
    checklist: [...]
  },
  statement: {
    statement: "...",
    score: 75,
    status: "partial",
    nextSteps: [...]
  }
}`}</pre>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Report display would appear here when API is called */}
      <Card>
        <CardHeader>
          <CardTitle>Export Report</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-gray-600">
            Export functionality would be implemented via:
          </p>
          <div className="space-y-1 text-xs">
            <p className="font-medium">PDF Export:</p>
            <code className="block bg-gray-50 p-2 rounded">
              POST /api/app/frameworks/export?format=pdf
            </code>
            <p className="font-medium mt-2">Excel Export:</p>
            <code className="block bg-gray-50 p-2 rounded">
              POST /api/app/frameworks/export?format=xlsx
            </code>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
