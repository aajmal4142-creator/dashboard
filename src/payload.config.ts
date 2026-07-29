import { mongooseAdapter } from "@payloadcms/db-mongodb";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import path from "path";
import { buildConfig, type PayloadEmailAdapter, type SharpDependency } from "payload";
import { fileURLToPath } from "url";
import sharp from "sharp";

import { AssuranceEngagements } from "./collections/AssuranceEngagements";
import { AssuranceReports } from "./collections/AssuranceReports";
import { AuditLogs } from "./collections/AuditLogs";
import { BenchmarkStats } from "./collections/BenchmarkStats";
import { ComplianceObligations } from "./collections/ComplianceObligations";
import { ComplianceTargets } from "./collections/ComplianceTargets";
import { Datapoints } from "./collections/Datapoints";
import { DerivedMetricDefinitions } from "./collections/DerivedMetricDefinitions";
import { EmissionFactors } from "./collections/EmissionFactors";
import { Evidence } from "./collections/Evidence";
import { FrameworkMappings } from "./collections/FrameworkMappings";
import { FrameworkMetrics } from "./collections/FrameworkMetrics";
import { InternalDataRequests } from "./collections/InternalDataRequests";
import { Invoices } from "./collections/Invoices";
import { MaterialityAssessments } from "./collections/MaterialityAssessments";
import { Media } from "./collections/Media";
import { Memberships } from "./collections/Memberships";
import { MetricDefinitions } from "./collections/MetricDefinitions";
import { Organisations } from "./collections/Organisations";
import { PaymentHistory } from "./collections/PaymentHistory";
import { Plans } from "./collections/Plans";
import { PolicyEvaluations } from "./collections/PolicyEvaluations";
import { PolicyRoles } from "./collections/PolicyRoles";
import { ReportingPeriods } from "./collections/ReportingPeriods";
import { Reports } from "./collections/Reports";
import { Scope3Sources } from "./collections/Scope3Sources";
import { Scope3Activities } from "./collections/Scope3Activities";
import { Subscriptions } from "./collections/Subscriptions";
import { Suppliers } from "./collections/Suppliers";
import { UsageMetrics } from "./collections/UsageMetrics";
import { UserPolicies } from "./collections/UserPolicies";
import { Users } from "./collections/Users";
import { VerificationFindings } from "./collections/VerificationFindings";

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

/** Explicit console sink until Resend is wired. Silences the unconfigured-adapter WARN. */
const consoleEmail: PayloadEmailAdapter = () => ({
  name: "console",
  defaultFromAddress: "noreply@clearesg.local",
  defaultFromName: "ClearESG",
  sendEmail: async (message) => {
    console.info(
      `[email] to=${String(message.to)} subject=${String(message.subject ?? "")}`,
    );
  },
});

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections: [
    Users,
    Media,
    Organisations,
    Memberships,
    PolicyRoles,
    UserPolicies,
    ReportingPeriods,
    MetricDefinitions,
    DerivedMetricDefinitions,
    EmissionFactors,
    Datapoints,
    Evidence,
    Suppliers,
    Scope3Sources,
    Scope3Activities,
    InternalDataRequests,
    MaterialityAssessments,
    Reports,
    AuditLogs,
    BenchmarkStats,
    ComplianceObligations,
    PolicyEvaluations,
    FrameworkMetrics,
    ComplianceTargets,
    FrameworkMappings,
    AssuranceEngagements,
    VerificationFindings,
    AssuranceReports,
    Plans,
    Subscriptions,
    UsageMetrics,
    Invoices,
    PaymentHistory,
  ],
  editor: lexicalEditor(),
  email: consoleEmail,
  secret: process.env.PAYLOAD_SECRET || "",
  typescript: {
    outputFile: path.resolve(dirname, "payload-types.ts"),
  },
  db: mongooseAdapter({
    url: process.env.DATABASE_URL || "",
  }),
  sharp: sharp as unknown as SharpDependency,
});
