import { mongooseAdapter } from "@payloadcms/db-mongodb";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import path from "path";
import { buildConfig, type PayloadEmailAdapter, type SharpDependency } from "payload";
import { fileURLToPath } from "url";
import sharp from "sharp";

import { AssuranceEngagements } from "./collections/AssuranceEngagements";
import { AssuranceReports } from "./collections/AssuranceReports";
import { AuditLogs } from "./collections/AuditLogs";
import { CarbonTrustCertifications } from "./collections/CarbonTrustCertifications";
import { CarbonTrustChecklistItems } from "./collections/CarbonTrustChecklistItems";
import { CarbonTrustDocuments } from "./collections/CarbonTrustDocuments";
import { CarbonTrustCertificates } from "./collections/CarbonTrustCertificates";
import { CarbonTrustAuditTrail } from "./collections/CarbonTrustAuditTrail";
import { BenchmarkStats } from "./collections/BenchmarkStats";
import { Scenarios } from "./collections/Scenarios";
import { DecarbonizationPathways } from "./collections/DecarbonizationPathways";
import { TrendForecasts } from "./collections/TrendForecasts";
import { ComplianceObligations } from "./collections/ComplianceObligations";
import { ComplianceTargets } from "./collections/ComplianceTargets";
import { GhgProtocolCompliance } from "./collections/GhgProtocolCompliance";
import { ComplianceCheckpoints } from "./collections/ComplianceCheckpoints";
import { ComplianceHistory } from "./collections/ComplianceHistory";
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
import { SubscriptionHistory } from "./collections/SubscriptionHistory";
import { Suppliers } from "./collections/Suppliers";
import { SupplierQuestionnaire } from "./collections/SupplierQuestionnaire";
import { SupplierDataSource } from "./collections/SupplierDataSource";
import { SupplierDocuments } from "./collections/SupplierDocuments";
import { SupplyChainNetworks } from "./collections/SupplyChainNetworks";
import { UsageMetrics } from "./collections/UsageMetrics";
import { UserPolicies } from "./collections/UserPolicies";
import { Users } from "./collections/Users";
import { VerificationFindings } from "./collections/VerificationFindings";
import { WebhookRegistrations } from "./collections/WebhookRegistrations";
import { WebhookLogs } from "./collections/WebhookLogs";
import { AccountingConnections } from "./collections/AccountingConnections";
import { IntegrationSyncLogs } from "./collections/IntegrationSyncLogs";
import { CustomRoles } from "./collections/CustomRoles";
import { SavedFilters } from "./collections/SavedFilters";
import { BulkOperations } from "./collections/BulkOperations";
import { FreeTierAccounts } from "./collections/FreeTierAccounts";
import { IoTDevices } from "./collections/IoTDevices";
import { IoTDataStreams } from "./collections/IoTDataStreams";
import { IoTGateways } from "./collections/IoTGateways";
import { DataQualityRules } from "./collections/DataQualityRules";
import { ISO14064Compliance } from "./collections/ISO14064Compliance";
import { AssurancePartners } from "./collections/AssurancePartners";
import { ReportTemplates } from "./collections/ReportTemplates";
import { CustomEmissionFactors } from "./collections/CustomEmissionFactors";
import { DunningManagement } from "./collections/DunningManagement";
import { EmailDataCollectionForms } from "./collections/EmailDataCollectionForms";
import { EmailImportLogs } from "./collections/EmailImportLogs";
import { ProductLevelFootprinting } from "./collections/ProductLevelFootprinting";
import { SpendBasedEmissions } from "./collections/SpendBasedEmissions";
import { RegulatoryDeadlines } from "./collections/RegulatoryDeadlines";
import { TcfdDisclosures } from "./collections/TcfdDisclosures";
import { IssbDisclosures } from "./collections/IssbDisclosures";
import { DatabaseConnections } from "./collections/DatabaseConnections";
import { DatabaseSyncLogs } from "./collections/DatabaseSyncLogs";
import { BiApiKeys } from "./collections/BiApiKeys";
import { SupplierPortalConfig } from "./collections/SupplierPortalConfig";
import { ComplianceAssessments } from "./collections/ComplianceAssessments";
import { DatapointVersions } from "./collections/DatapointVersions";
import { ScheduledReports } from "./collections/ScheduledReports";
import { SbtiTargets } from "./collections/SbtiTargets";
import { GreenTaxonomyAssessments } from "./collections/GreenTaxonomyAssessments";
import { ReportEmbedTokens } from "./collections/ReportEmbedTokens";
import { Notifications } from "./collections/Notifications";
import { DashboardLayouts } from "./collections/DashboardLayouts";
import { AlertRules } from "./collections/AlertRules";
import { SlackIntegrations } from "./collections/SlackIntegrations";
import { Automations } from "./collections/Automations";
import { AutomationRuns } from "./collections/AutomationRuns";

/**
 * Collection registration — APPEND-ONLY for feature chats.
 * See docs/PAYLOAD_COLLECTIONS.md. Do not reorder unrelated entries.
 */

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
    SupplierQuestionnaire,
    SupplierDataSource,
    SupplierDocuments,
    SupplyChainNetworks,
    Scope3Sources,
    Scope3Activities,
    InternalDataRequests,
    MaterialityAssessments,
    Reports,
    AuditLogs,
    BenchmarkStats,
    ComplianceObligations,
    ComplianceTargets,
    GhgProtocolCompliance,
    ComplianceCheckpoints,
    ComplianceHistory,
    PolicyEvaluations,
    FrameworkMetrics,
    FrameworkMappings,
    AssuranceEngagements,
    VerificationFindings,
    AssuranceReports,
    Plans,
    Subscriptions,
    SubscriptionHistory,
    UsageMetrics,
    Invoices,
    PaymentHistory,
    WebhookRegistrations,
    WebhookLogs,
    CarbonTrustCertifications,
    CarbonTrustChecklistItems,
    CarbonTrustDocuments,
    CarbonTrustCertificates,
    CarbonTrustAuditTrail,
    Scenarios,
    DecarbonizationPathways,
    TrendForecasts,
    AccountingConnections,
    IntegrationSyncLogs,
    CustomRoles,
    SavedFilters,
    BulkOperations,
    FreeTierAccounts,
    IoTDevices,
    IoTDataStreams,
    DataQualityRules,
    ISO14064Compliance,
    AssurancePartners,
    ReportTemplates,
    CustomEmissionFactors,
    DunningManagement,
    EmailDataCollectionForms,
    ProductLevelFootprinting,
    SpendBasedEmissions,
    RegulatoryDeadlines,
    TcfdDisclosures,
    IssbDisclosures,
    DatabaseConnections,
    DatabaseSyncLogs,
    BiApiKeys,
    SupplierPortalConfig,
    ComplianceAssessments,
    EmailImportLogs,
    DatapointVersions,
    ScheduledReports,
    SbtiTargets,
    GreenTaxonomyAssessments,
    ReportEmbedTokens,
    IoTGateways,
    Notifications,
    DashboardLayouts,
    AlertRules,
    SlackIntegrations,
    Automations,
    AutomationRuns,
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
