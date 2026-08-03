import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getCurrentContext } from "@/lib/auth";

interface ComplianceScore {
  score: number;
  status: string;
  metricsProvided: number;
  metricsRequired: number;
}

interface FrameworkData {
  csrd?: ComplianceScore;
  brsr?: ComplianceScore;
  gri?: ComplianceScore;
  sasb?: ComplianceScore;
}

function getStatusColor(status: string) {
  switch (status) {
    case "compliant":
      return "text-green-600 bg-green-50";
    case "partial":
      return "text-yellow-600 bg-yellow-50";
    default:
      return "text-red-600 bg-red-50";
  }
}

function getScoreColor(score: number) {
  if (score >= 80) return "text-green-600";
  if (score >= 60) return "text-yellow-600";
  return "text-red-600";
}

function ComplianceCard({
  framework,
  data,
}: {
  framework: string;
  data?: ComplianceScore;
}) {
  return (
    <Card className={`border-l-4 ${getStatusColor(data?.status || "non-compliant")}`}>
      <CardHeader>
        <CardTitle className="text-lg">{framework.toUpperCase()}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {data ? (
          <>
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-gray-600">Compliance Score</span>
              <span className={`text-3xl font-bold ${getScoreColor(data.score)}`}>
                {data.score}%
              </span>
            </div>
            <div className="text-xs text-gray-500">
              {data.metricsProvided} of {data.metricsRequired} metrics
            </div>
            <div className="pt-2">
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full ${getScoreColor(data.score)}`}
                  style={{ width: `${data.score}%` }}
                />
              </div>
            </div>
            <p className="text-sm font-medium capitalize">{data.status}</p>
          </>
        ) : (
          <p className="text-sm text-gray-500">No data yet</p>
        )}
      </CardContent>
    </Card>
  );
}

export default async function FrameworksDashboard() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) redirect("/onboarding");

  const frameworks: FrameworkData = {};
  const overallCompliance = 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">ESG Frameworks</h1>
        <p className="text-gray-600 mt-1">
          Map emissions to CSRD, BRSR, GRI, and SASB frameworks
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Overall Compliance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-baseline justify-between">
            <span className="text-gray-600">Average across all frameworks</span>
            <span className={`text-4xl font-bold ${getScoreColor(overallCompliance)}`}>
              {overallCompliance}%
            </span>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="csrd" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="csrd">CSRD</TabsTrigger>
          <TabsTrigger value="brsr">BRSR</TabsTrigger>
          <TabsTrigger value="gri">GRI</TabsTrigger>
          <TabsTrigger value="sasb">SASB</TabsTrigger>
        </TabsList>

        <TabsContent value="csrd" className="space-y-4">
          <ComplianceCard framework="CSRD" data={frameworks.csrd} />
          <Card>
            <CardHeader>
              <CardTitle className="text-base">About CSRD</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-gray-600">
              Corporate Sustainability Reporting Directive requires EU companies to report
              Scope 1, 2, 3 emissions with GHG intensity metrics.
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="brsr" className="space-y-4">
          <ComplianceCard framework="BRSR" data={frameworks.brsr} />
          <Card>
            <CardHeader>
              <CardTitle className="text-base">About BRSR</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-gray-600">
              Business Responsibility and Sustainability Reporting is India&apos;s
              mandatory disclosure framework for large companies covering emissions,
              energy, and renewables.
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="gri" className="space-y-4">
          <ComplianceCard framework="GRI" data={frameworks.gri} />
          <Card>
            <CardHeader>
              <CardTitle className="text-base">About GRI</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-gray-600">
              Global Reporting Initiative is the most widely adopted sustainability
              reporting standard, covering Scope 1, 2, 3 emissions with year-over-year
              tracking.
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sasb" className="space-y-4">
          <ComplianceCard framework="SASB" data={frameworks.sasb} />
          <Card>
            <CardHeader>
              <CardTitle className="text-base">About SASB</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-gray-600">
              Sustainability Accounting Standards Board provides industry-specific
              sustainability metrics aligned with financial materiality and investor
              needs.
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <a
            href="/frameworks/brsr"
            className="block p-3 rounded border hover:bg-gray-50 text-sm font-medium"
          >
            → BRSR Core / Comprehensive coverage
          </a>
          <a
            href="/frameworks/targets"
            className="block p-3 rounded border hover:bg-gray-50 text-sm font-medium"
          >
            → Set Compliance Targets
          </a>
          <a
            href="/frameworks/reports"
            className="block p-3 rounded border hover:bg-gray-50 text-sm font-medium"
          >
            → Generate Reports
          </a>
        </CardContent>
      </Card>
    </div>
  );
}
