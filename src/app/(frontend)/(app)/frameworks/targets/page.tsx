import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function TargetManagement() {
  const targets: Array<{
    id: string;
    framework: string;
    metricKey: string;
    targetValue: number;
    targetYear: number;
    status: string;
  }> = [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Compliance Targets</h1>
        <p className="text-gray-600 mt-1">
          Set and track framework-specific emission targets
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Target Creation Form */}
        <Card>
          <CardHeader>
            <CardTitle>Create New Target</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Framework</label>
                <select
                  name="framework"
                  className="w-full px-3 py-2 border rounded-md text-sm"
                  required
                >
                  <option value="csrd">CSRD</option>
                  <option value="brsr">BRSR</option>
                  <option value="gri">GRI</option>
                  <option value="sasb">SASB</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Metric Key</label>
                <input
                  type="text"
                  name="metricKey"
                  placeholder="e.g., csrd_scope1_intensity"
                  className="w-full px-3 py-2 border rounded-md text-sm"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Baseline Year</label>
                  <input
                    type="number"
                    name="baselineYear"
                    defaultValue={new Date().getFullYear()}
                    className="w-full px-3 py-2 border rounded-md text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Target Year</label>
                  <input
                    type="number"
                    name="targetYear"
                    defaultValue={new Date().getFullYear() + 5}
                    className="w-full px-3 py-2 border rounded-md text-sm"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Target Value</label>
                <input
                  type="number"
                  name="targetValue"
                  placeholder="e.g., 50 (for 50% reduction)"
                  step="0.01"
                  className="w-full px-3 py-2 border rounded-md text-sm"
                  required
                />
              </div>

              <button
                type="button"
                className="w-full bg-blue-600 text-white py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                disabled
              >
                Create Target (API endpoint)
              </button>
            </form>
          </CardContent>
        </Card>

        {/* Target Information */}
        <Card>
          <CardHeader>
            <CardTitle>About Targets</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-gray-600">
            <div>
              <h3 className="font-medium text-gray-900 mb-1">Science-Based Targets</h3>
              <p>Align your targets with 1.5°C climate scenario recommendations.</p>
            </div>
            <div>
              <h3 className="font-medium text-gray-900 mb-1">Baseline Selection</h3>
              <p>Choose the year from which emissions reduction is measured.</p>
            </div>
            <div>
              <h3 className="font-medium text-gray-900 mb-1">Target Year</h3>
              <p>Typical targets: 2030, 2035, 2050 aligned with climate commitments.</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Existing Targets Table */}
      {targets.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Targets Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b">
                  <tr>
                    <th className="text-left py-2">Framework</th>
                    <th className="text-left py-2">Metric</th>
                    <th className="text-left py-2">Target</th>
                    <th className="text-left py-2">Year</th>
                    <th className="text-left py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {targets.map((target) => (
                    <tr key={target.id} className="border-b hover:bg-gray-50">
                      <td className="py-2 font-medium">{target.framework}</td>
                      <td className="py-2">{target.metricKey}</td>
                      <td className="py-2">{target.targetValue}</td>
                      <td className="py-2">{target.targetYear}</td>
                      <td className="py-2">
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            target.status === "approved"
                              ? "bg-green-100 text-green-800"
                              : "bg-yellow-100 text-yellow-800"
                          }`}
                        >
                          {target.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
