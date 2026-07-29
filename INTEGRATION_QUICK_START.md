# Integration Quick Start Guide

## 1. SAP S/4HANA Integration

### Setup

```typescript
import { SAPService } from "@/lib/integrations/sap";
import { getPayload } from "payload";

const payload = await getPayload();
const sap = new SAPService(
  payload,
  process.env.SAP_CLIENT_ID,
  process.env.SAP_CLIENT_SECRET,
  process.env.SAP_REDIRECT_URI,
);
```

### Initiate Connection

```typescript
// 1. Get authorization URL
const authUrl = sap.getAuthUrl(connectionId);
// → Redirect user to SAP login

// 2. Handle callback with authorization code
const tokens = await sap.exchangeCodeForToken(code);

// 3. Save tokens in database
await payload.update({
  collection: "sap-connections",
  id: connectionId,
  data: {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: tokens.expiresAt,
    status: "connected",
  },
});
```

### Sync Data

```typescript
const result = await sap.syncData(connectionId, organisationId, periodId);
console.log(result);
// {
//   status: "success",
//   recordsProcessed: 150,
//   recordsFailed: 0,
//   details: {
//     glSynced: true,
//     bomSynced: true,
//     productionSynced: true
//   }
// }
```

### API Usage

```bash
# Initiate sync
curl -X POST http://localhost:3000/api/app/integrations/sap \
  -H "Content-Type: application/json" \
  -d '{
    "action": "sync",
    "connectionId": "conn-123",
    "organisationId": "org-1",
    "periodId": "period-1"
  }'

# Get OAuth URL
curl -X POST http://localhost:3000/api/app/integrations/sap \
  -H "Content-Type: application/json" \
  -d '{
    "action": "get-auth-url",
    "connectionId": "conn-123"
  }'
```

---

## 2. Data Warehouse Export

### Setup - Snowflake

```typescript
import { DataWarehouseService } from "@/lib/integrations/datawarehouse";

const payload = await getPayload();
const dwService = new DataWarehouseService(payload);

const connector = dwService.createConnector("snowflake", {
  account: "xy12345.us-east-1",
  warehouse: "COMPUTE_WH",
  database: "clearesg_db",
  schema: "analytics",
  role: "sysadmin",
  username: "clearesg_user",
  password: process.env.SNOWFLAKE_PASSWORD,
});
```

### Setup - BigQuery

```typescript
const connector = dwService.createConnector("bigquery", {
  projectId: "my-project",
  datasetId: "clearesg_analytics",
  credentials: {
    type: "service_account",
    project_id: "my-project",
    private_key_id: "xxx",
    private_key: "-----BEGIN PRIVATE KEY-----\n...",
    client_email: "sa@my-project.iam.gserviceaccount.com",
    client_id: "123",
    auth_uri: "https://accounts.google.com/o/oauth2/auth",
    token_uri: "https://oauth2.googleapis.com/token",
  },
});
```

### Setup - Databricks

```typescript
const connector = dwService.createConnector("databricks", {
  instanceUrl: "https://adb-123456789.azuredatabricks.net",
  token: process.env.DATABRICKS_TOKEN,
  warehouseId: "wh-123abc",
  schemaName: "clearesg_analytics",
});
```

### Test Connection

```typescript
const connected = await connector.testConnection();
if (!connected) {
  throw new Error("Failed to connect to data warehouse");
}
```

### Export Data

```typescript
const result = await dwService.exportToDataWarehouse(connectionId, organisationId, {
  tablePrefix: "clearesg",
  frequency: "daily",
  incremental: true,
});

console.log(`Exported ${result.recordsProcessed} records`);
```

### API Usage

```bash
# Test connection
curl -X POST http://localhost:3000/api/app/integrations/datawarehouse \
  -H "Content-Type: application/json" \
  -d '{
    "action": "test-connection",
    "provider": "snowflake",
    "config": {
      "account": "xy12345",
      "warehouse": "COMPUTE_WH",
      "database": "clearesg_db",
      "schema": "analytics",
      "role": "sysadmin",
      "username": "user"
    }
  }'

# Export data
curl -X POST http://localhost:3000/api/app/integrations/datawarehouse \
  -H "Content-Type: application/json" \
  -d '{
    "action": "export",
    "connectionId": "conn-123",
    "exportConfig": {
      "tablePrefix": "clearesg",
      "frequency": "daily",
      "incremental": true
    }
  }'
```

---

## 3. Webhook Automation (Zapier/Make)

### Register Webhook

```typescript
import { WebhookManager } from "@/lib/integrations/webhooks";

const payload = await getPayload();
const webhookMgr = new WebhookManager(payload);

const webhookId = await webhookMgr.registerWebhook("org-1", {
  url: "https://hooks.zapier.com/hooks/catch/12345/abcde",
  events: ["data.created", "alert.triggered"],
  active: true,
  retryPolicy: {
    maxRetries: 3,
    retryDelayMs: 1000,
    exponentialBackoff: true,
  },
  authentication: {
    type: "bearer",
    value: "zapier-api-key",
  },
});
```

### Test Webhook

```typescript
const success = await webhookMgr.testWebhook(webhookId);
if (success) {
  console.log("Webhook is working!");
}
```

### Send Event

```typescript
// Manually trigger webhook
await webhookMgr.sendWebhookEvent(
  "data.created",
  {
    id: "dp-123",
    metricKey: "emissions.scope1",
    value: 1000,
    unit: "kgCO2e",
  },
  "org-1",
);
```

### Get Templates

```typescript
const templates = webhookMgr.getWebhookTemplates();
// Returns pre-built Zapier/Make templates with event mappings

templates.forEach((template) => {
  console.log(`${template.provider}: ${template.name}`);
  console.log(`Events: ${template.events.join(", ")}`);
  console.log(`Mapping:`, template.mapping);
});
```

### API Usage

```bash
# Get templates
curl http://localhost:3000/api/app/integrations/webhooks?action=get-templates

# Register webhook
curl -X POST http://localhost:3000/api/app/integrations/webhooks \
  -H "Content-Type: application/json" \
  -d '{
    "action": "register",
    "config": {
      "url": "https://hooks.zapier.com/...",
      "events": ["data.created"],
      "active": true,
      "retryPolicy": {
        "maxRetries": 3,
        "retryDelayMs": 1000,
        "exponentialBackoff": true
      }
    }
  }'

# Test webhook
curl -X POST http://localhost:3000/api/app/integrations/webhooks \
  -H "Content-Type: application/json" \
  -d '{
    "action": "test",
    "webhookId": "webhook-123"
  }'

# Send event
curl -X POST http://localhost:3000/api/app/integrations/webhooks \
  -H "Content-Type: application/json" \
  -d '{
    "action": "send-event",
    "event": "data.created",
    "data": {"id": "dp-1", "value": 100}
  }'
```

---

## 4. Power BI / Tableau Integration

### Power BI Setup

```typescript
import { PowerBIConnector } from "@/lib/integrations/biconnector";

const payload = await getPayload();
const pbiConfig = {
  tenantId: "tenant-id",
  clientId: "client-id",
  clientSecret: "secret",
  workspaceId: "ws-id",
  reportId: "report-id",
};

const pbi = new PowerBIConnector(payload, pbiConfig);

// Get OAuth URL
const authUrl = pbi.getAuthUrl("https://your-domain.com/callback");
```

### Tableau Setup

```typescript
import { TableauConnector } from "@/lib/integrations/biconnector";

const tableauConfig = {
  serverUrl: "https://tableau.company.com",
  siteId: "site",
  accessToken: "personal-access-token",
  userId: "user-id",
  contentUrl: "site",
  rowLevelSecurity: {
    enabled: true,
    column: "Department",
    mapping: {
      "user@org.com": ["Engineering", "Sales"],
    },
  },
};

const tableau = new TableauConnector(payload, tableauConfig);
await tableau.authenticate();
```

### Sync Data to BI Platform

```typescript
import { BIConnectorService } from "@/lib/integrations/biconnector";

const biService = new BIConnectorService(payload);

const result = await biService.syncToBI(connectionId, organisationId, "powerbi", [
  {
    sourceTable: "datapoints",
    sourceFields: ["id", "metricKey", "value", "unit"],
    targetDataset: "ClearESG_Emissions",
    targetFields: ["DatapointID", "Metric", "Value", "Unit"],
    refreshSchedule: "daily",
  },
]);
```

### Schedule Refresh

```typescript
await biService.scheduleRefresh(connectionId, "powerbi", {
  time: "08:00",
  days: ["Monday", "Wednesday", "Friday"],
});
```

### API Usage

```bash
# Test connection
curl -X POST http://localhost:3000/api/app/integrations/bi \
  -H "Content-Type: application/json" \
  -d '{
    "action": "test-connection",
    "connectionId": "conn-123",
    "biType": "powerbi"
  }'

# Sync data
curl -X POST http://localhost:3000/api/app/integrations/bi \
  -H "Content-Type: application/json" \
  -d '{
    "action": "sync",
    "connectionId": "conn-123",
    "biType": "tableau",
    "mappings": [{
      "sourceTable": "datapoints",
      "sourceFields": ["id", "value"],
      "targetDataset": "Emissions",
      "targetFields": ["ID", "Emissions"],
      "refreshSchedule": "daily"
    }]
  }'

# Schedule refresh
curl -X POST http://localhost:3000/api/app/integrations/bi \
  -H "Content-Type: application/json" \
  -d '{
    "action": "schedule-refresh",
    "connectionId": "conn-123",
    "biType": "powerbi",
    "schedule": {
      "time": "08:00",
      "days": ["Mon", "Wed", "Fri"]
    }
  }'
```

---

## Common Error Handling

### All Integrations Return SyncResult

```typescript
interface SyncResult {
  status: "success" | "partial" | "failed";
  recordsProcessed: number;
  recordsFailed: number;
  errors: Array<{ message: string; recordId?: string }>;
  details: Record<string, unknown>;
  syncDurationMs: number;
}
```

### Example Error Handling

```typescript
const result = await sap.syncData(connectionId, orgId, periodId);

if (result.status === "failed") {
  console.error("Sync failed:", result.errors);
  // Handle error - perhaps retry later
}

if (result.status === "partial") {
  console.warn(`${result.recordsFailed} records failed to sync`);
  result.errors.forEach((err) => {
    console.log(`${err.recordId}: ${err.message}`);
  });
}

if (result.status === "success") {
  console.log(`Successfully synced ${result.recordsProcessed} records`);
}
```

---

## Webhook Event Payloads

### data.created

```json
{
  "event": "data.created",
  "timestamp": "2026-07-29T10:30:00Z",
  "organisationId": "org-1",
  "data": {
    "id": "dp-123",
    "metricKey": "emissions.scope1",
    "value": 1000,
    "unit": "kgCO2e",
    "quality": "measured"
  }
}
```

### alert.triggered

```json
{
  "event": "alert.triggered",
  "timestamp": "2026-07-29T10:30:00Z",
  "organisationId": "org-1",
  "data": {
    "level": "high",
    "message": "Emissions exceeded threshold",
    "threshold": 5000,
    "actual": 5500,
    "metrics": ["emissions.scope1", "emissions.scope2"]
  }
}
```

### sync.completed

```json
{
  "event": "sync.completed",
  "timestamp": "2026-07-29T10:30:00Z",
  "organisationId": "org-1",
  "data": {
    "provider": "sap",
    "recordsProcessed": 150,
    "status": "success",
    "duration": 2500
  }
}
```

---

## Debugging Tips

### Enable Logging

```typescript
// In your integration code
console.log("Starting sync...");
console.log("Connection:", connection);
const result = await service.syncData(...);
console.log("Result:", result);
if (result.errors.length) {
  console.error("Errors:", result.errors);
}
```

### Test Webhook Locally

```bash
# Use ngrok to expose local webhook endpoint
ngrok http 3000

# Register webhook with ngrok URL
curl -X POST http://localhost:3000/api/app/integrations/webhooks \
  -d '{
    "action": "register",
    "config": {
      "url": "https://abc123.ngrok.io/webhook"
    }
  }'

# View webhook logs
# Check WebhookLogs collection in admin panel
```

### Check Connection Status

```typescript
const connection = await payload.findByID({
  collection: "sap-connections",
  id: "conn-123",
});

console.log("Status:", connection.status);
console.log("Last sync:", connection.lastSyncAt);
console.log("Errors:", connection.syncErrorCount);
```

---

## Performance Tips

1. **Batch Operations**: Use incremental exports for large datasets
2. **Retry Strategy**: Use exponential backoff for webhooks
3. **Token Caching**: Cache tokens locally with expiry check
4. **Connection Pooling**: Reuse connectors for multiple operations
5. **Scheduling**: Run heavy syncs during off-peak hours

---

## Support

For detailed documentation, see **SPRINT6_INTEGRATIONS.md**
