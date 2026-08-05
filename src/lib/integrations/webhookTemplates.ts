import type { WebhookTemplate } from "./types";

/** Published Zapier / Make recipes — safe for client import. */
export function listWebhookTemplates(): WebhookTemplate[] {
  return [
    {
      name: "Zapier - New Datapoint",
      provider: "zapier",
      events: ["datapoint.created"],
      mapping: {
        event: "event",
        timestamp: "timestamp",
        dataId: "data.id",
        metricKey: "data.metricKey",
        value: "data.value",
        unit: "data.unit",
      },
      description: "Catch Hook on datapoint.created. Recipe: docs/integrations/ZAPIER.md",
    },
    {
      name: "Make - New Datapoint",
      provider: "make",
      events: ["datapoint.created"],
      mapping: {
        event: "event",
        timestamp: "timestamp",
        metricKey: "data.metricKey",
        value: "data.value",
        quality: "data.quality",
      },
      description:
        "Custom webhook on datapoint.created. Recipe: docs/integrations/MAKE.md",
    },
    {
      name: "Zapier - Report Generated",
      provider: "zapier",
      events: ["report.generated"],
      mapping: {
        event: "event",
        timestamp: "timestamp",
        reportId: "data.reportId",
        reportType: "data.type",
        reportUrl: "data.downloadUrl",
      },
      description: "Trigger workflows when reports are generated",
    },
    {
      name: "Make - Datapoint Updated",
      provider: "make",
      events: ["datapoint.updated"],
      mapping: {
        event: "event",
        timestamp: "timestamp",
        dataId: "data.id",
        metricKey: "data.metricKey",
        value: "data.value",
      },
      description: "Sync corrections into Sheets or CRM",
    },
  ];
}
