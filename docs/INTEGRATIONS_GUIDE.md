# Enterprise Integrations Guide

This guide explains the three enterprise integrations implemented in Sprint 5: Salesforce, NetSuite, and Accounting Systems (Xero/QuickBooks).

## Overview

### INT-001: Salesforce Integration (12h)

Enables bi-directional sync between ClearESG and Salesforce:

- **Data synced**: Accounts → supplier organizations, Contacts → team members
- **OAuth flow**: OAuth 2.0 with access token + refresh token storage
- **Features**:
  - Account hierarchy mapping (Salesforce → ClearESG orgs)
  - Contact syncing with email validation
  - ESG metrics write-back to custom fields (if enabled)
  - Configurable sync frequency (manual, hourly, daily, weekly)
- **Status tracking**: Connection status, last sync time, error count

### INT-002: NetSuite Integration (10h)

Syncs General Ledger data and calculates spend-based emissions:

- **Data synced**: GL codes → emissions categories, GL balances → spend-based emissions
- **OAuth flow**: OAuth 2.0 with account ID requirement
- **Features**:
  - GL code mapping to emissions categories
  - Automatic spend-based emissions calculation
  - Invoice and PO integration (optional)
  - Monthly reconciliation ready
- **Emissions calculation**: Each GL balance × category factor → tCO2e

### INT-003: Accounting System Sync (8h)

Connects Xero or QuickBooks for expense syncing:

- **Providers**: Xero, QuickBooks Online
- **OAuth flow**: Provider-specific OAuth 2.0
- **Features**:
  - Expense category syncing with GL code mapping
  - Spend-based emissions calculation
  - Automated category mapping
  - Bank feed support (Xero only)
- **Data flow**: Invoices/Expenses → GL codes → emissions calculations

## Architecture

### Database Collections

#### 1. `salesforce-connections`

```typescript
{
  organisationId: relationship; // Foreign key to organisations
  status: "pending" | "connected" | "failed" | "expired";
  instanceUrl: string; // Salesforce instance URL
  accessToken: string; // OAuth access token (encrypted)
  refreshToken: string; // OAuth refresh token (encrypted)
  expiresAt: date; // Token expiration
  accountMapping: json; // { salesforceAccountId: organisationId }
  syncConfig: {
    // Configuration options
    enableAccountSync: boolean;
    enableContactSync: boolean;
    enableMetricsWrite: boolean;
    syncFrequency: string; // "manual" | "hourly" | "daily" | "weekly"
  }
  lastSyncAt: date; // Last sync timestamp
  lastSyncStatus: string; // "success" | "partial" | "failed"
  syncErrorCount: number; // Count of sync errors
  connectedAt: date; // When connection was established
}
```

#### 2. `netsuite-connections`

```typescript
{
  organisationId: relationship;
  status: "pending" | "connected" | "failed" | "expired";
  accountId: string; // NetSuite Account ID
  consumerKey: string; // OAuth consumer key
  consumerSecret: string; // OAuth consumer secret
  accessToken: string; // OAuth access token
  accessTokenSecret: string; // OAuth token secret
  glCodeMapping: json; // { "6000": "electricity", "6100": "gas" }
  syncConfig: {
    enableGlSync: boolean;
    enableInvoiceSync: boolean;
    enableSpendCalculation: boolean;
    syncFrequency: string; // "manual" | "daily" | "weekly" | "monthly"
  }
  lastSyncAt: date;
  lastSyncStatus: string;
  syncErrorCount: number;
  connectedAt: date;
}
```

#### 3. `accounting-connections`

```typescript
{
  organisationId: relationship;
  provider: "xero" | "quickbooks";
  status: "pending" | "connected" | "failed" | "expired";
  providerId: string; // Xero Tenant ID or QB Realm ID
  accessToken: string; // OAuth access token
  refreshToken: string; // OAuth refresh token
  expiresAt: date;
  expenseCategoryMapping: json; // { "travel": "6200", "utilities": "6100" }
  syncConfig: {
    enableExpenseSync: boolean;
    enableBankFeedSync: boolean;
    enableAutoCateg: boolean;
    syncFrequency: string; // "manual" | "daily" | "weekly" | "monthly"
  }
  lastSyncAt: date;
  lastSyncStatus: string;
  syncErrorCount: number;
  connectedAt: date;
}
```

#### 4. `integration-sync-logs`

Audit trail for all syncs:

```typescript
{
  organisationId: relationship;
  integrationId: string; // Connection ID
  provider: string; // "salesforce" | "netsuite" | "xero" | "quickbooks"
  status: "success" | "partial" | "failed";
  recordsProcessed: number;
  recordsFailed: number;
  details: json; // Sync-specific details
  errors: array; // Error log
  syncDurationMs: number; // How long sync took
  triggeredBy: string; // User ID or "auto"
  createdAt: date; // Sync timestamp
}
```

### Service Classes

#### `SalesforceService`

Located at `src/lib/integrations/salesforce.ts`

Key methods:

- `getAuthUrl(connectionId)` - Generate OAuth authorization URL
- `exchangeCodeForToken(code)` - Exchange auth code for tokens
- `refreshAccessToken(refreshToken)` - Refresh expired token
- `fetchAccounts(instanceUrl, accessToken)` - Get Salesforce accounts
- `fetchContacts(instanceUrl, accessToken)` - Get Salesforce contacts
- `writeMetricsToAccounts(...)` - Write ESG metrics to custom fields
- `syncData(connectionId, organisationId)` - Full sync operation

Returns `SyncResult`:

```typescript
{
  status: "success" | "partial" | "failed";
  recordsProcessed: number;
  recordsFailed: number;
  errors: Array<{ message; recordId? }>;
  details: Record<string, any>;
  syncDurationMs: number;
}
```

#### `NetSuiteService`

Located at `src/lib/integrations/netsuite.ts`

Key methods:

- `getAuthUrl(connectionId)` - Generate OAuth URL
- `exchangeCodeForToken(code)` - Exchange auth code
- `refreshAccessToken(refreshToken)` - Refresh token
- `fetchGLRecords(accountId, accessToken, periodId)` - Get GL data
- `calculateEmissionsFromGL(glRecords, glCodeMapping)` - Calculate emissions
- `syncGLData(connectionId, organisationId, periodId)` - Full sync

Emissions calculation uses simplified factors (kg CO2e per £ spent):

- Electricity: 0.45
- Gas: 0.21
- Water: 0.35
- Travel: 0.22
- Waste: 0.18
- Procurement: 0.15

#### `AccountingService`

Located at `src/lib/integrations/accounting.ts`

Key methods:

- `getAuthUrl(connectionId)` - Generate OAuth URL (Xero or QB)
- `exchangeCodeForToken(code, realmId)` - Exchange auth code
- `refreshAccessToken(refreshToken)` - Refresh token
- `syncExpenses(connectionId, organisationId, periodId)` - Sync expense data

## API Routes

### Salesforce Routes

#### `POST /api/app/integrations/salesforce/auth`

Initiates OAuth flow

```json
Response:
{
  "authUrl": "https://login.salesforce.com/services/oauth2/authorize?...",
  "connectionId": "uuid"
}
```

#### `GET /api/app/integrations/salesforce/callback`

OAuth callback handler. Redirects to `/integrations/salesforce?connected=true`

#### `POST /api/app/integrations/salesforce/sync`

Triggers manual sync

```json
Request:
{
  "connectionId": "uuid"
}

Response:
{
  "status": "success" | "partial" | "failed",
  "recordsProcessed": 42,
  "recordsFailed": 0,
  "errors": [],
  "details": { "accountsSynced": 30, "contactsSynced": 12 },
  "syncDurationMs": 1234
}
```

### NetSuite Routes

#### `POST /api/app/integrations/netsuite/auth`

Initiates OAuth flow (same response format as Salesforce)

#### `GET /api/app/integrations/netsuite/callback`

OAuth callback handler

#### `POST /api/app/integrations/netsuite/sync`

Syncs GL data

```json
Request:
{
  "connectionId": "uuid",
  "periodId": "2024-Q1"
}

Response: SyncResult with emissions calculations
```

### Accounting Routes

#### `POST /api/app/integrations/accounting/auth`

```json
Request:
{
  "provider": "xero" | "quickbooks"
}

Response:
{
  "authUrl": "...",
  "connectionId": "uuid"
}
```

#### `GET /api/app/integrations/accounting/callback`

OAuth callback handler

#### `POST /api/app/integrations/accounting/sync`

```json
Request:
{
  "connectionId": "uuid",
  "periodId": "2024-Q1"
}

Response: SyncResult with expense categories and emissions
```

### Status Route

#### `GET /api/app/integrations/status`

Returns all connections for current org

```json
Response:
{
  "salesforce": [ { id, status, connectedAt, lastSyncAt, lastSyncStatus } ],
  "netsuite": [ { id, status, accountId, connectedAt, lastSyncAt, lastSyncStatus } ],
  "accounting": [ { id, provider, status, connectedAt, lastSyncAt, lastSyncStatus } ]
}
```

## Environment Variables

Required:

```bash
# Salesforce
SALESFORCE_CLIENT_ID=...
SALESFORCE_CLIENT_SECRET=...

# NetSuite
NETSUITE_CLIENT_ID=...
NETSUITE_CLIENT_SECRET=...

# Xero
XERO_CLIENT_ID=...
XERO_CLIENT_SECRET=...

# QuickBooks
QB_CLIENT_ID=...
QB_CLIENT_SECRET=...

# App URL (for OAuth callbacks)
NEXT_PUBLIC_APP_URL=https://clearesg.local
```

## UI Pages

### Main Integrations Dashboard

**URL**: `/integrations`

Shows:

- Connection status cards for each integration
- Quick action buttons (Configure)
- Last sync timestamps
- Connection counts

### Salesforce Configuration

**URL**: `/integrations/salesforce`

Features:

- OAuth connection button
- Status indicator with instance URL
- Account/Contact sync configuration
- Manual sync trigger
- Connection requirements

### NetSuite Configuration

**URL**: `/integrations/netsuite`

Features:

- OAuth connection button
- GL code mapping interface
- Period selection for GL sync
- Emissions calculation preview
- Sync frequency settings

### Accounting Configuration

**URL**: `/integrations/accounting`

Features:

- Separate panels for Xero and QB
- OAuth buttons for each
- Expense category mapping
- Period selection
- Sync frequency configuration

## Permission Model

All integration endpoints require:

- **Permission**: `manage:integration:organisation`
- **Scope**: Organisation level
- **User role**: Admin or Contributor with override

Validated in API routes via:

```typescript
const allowed = await requirePermission(
  ctx.user.id,
  ctx.activeOrg.id,
  "manage",
  "integration",
  ctx.activeOrg.id,
  "organisation",
);
```

## Data Flow

### Salesforce Sync Flow

```
1. User clicks "Sync Now" on /integrations/salesforce
2. POST /api/app/integrations/salesforce/sync { connectionId }
3. SalesforceService.syncData() called
4. Fetch accounts and contacts from Salesforce API
5. For each account/contact:
   - Validate data
   - Create datapoint if emissions enabled
6. Update connection.lastSyncAt
7. Log sync in integration-sync-logs
8. Return SyncResult
9. UI updates with results
```

### NetSuite Sync Flow

```
1. User selects period and clicks "Sync GL Data"
2. POST /api/app/integrations/netsuite/sync { connectionId, periodId }
3. NetSuiteService.syncGLData() called
4. Fetch GL records for period
5. Apply GL code mapping to categorize
6. Calculate emissions: balance × factor → tCO2e
7. For each category:
   - Create datapoint with quality: "estimated"
   - Source: "netsuite"
8. Update connection.lastSyncAt
9. Log sync in integration-sync-logs
10. Return SyncResult
```

### Accounting Sync Flow

```
1. User selects period and clicks "Sync Expenses"
2. POST /api/app/integrations/accounting/sync { connectionId, periodId }
3. AccountingService.syncExpenses() called
4. If Xero: fetch invoices via REST API
   If QB: query expenses via SOAP/JSON API
5. For each expense:
   - Extract category from GL code mapping
   - Sum amounts by category
6. Calculate emissions: amount × factor → tCO2e
7. For each category:
   - Create datapoint with quality: "estimated"
   - Source: "xero" or "quickbooks"
8. Update connection.lastSyncAt
9. Log sync in integration-sync-logs
10. Return SyncResult
```

## Error Handling

### Connection Errors

- **Status**: "failed"
- **Logged**: lastSyncStatus contains error message
- **Retry**: User can re-authorize via auth endpoint

### Token Expiration

- **Check**: On every sync, verify expiresAt > now
- **Refresh**: If expired, call refreshAccessToken
- **Update**: Store new tokens in connection
- **Fallback**: If refresh fails, status → "expired"

### Sync Errors

- **Recorded**: In integration-sync-logs with error details
- **Continues**: Sync doesn't stop on single record error
- **Status**: "partial" if some records succeed
- **Retry**: User can retry sync, no duplicate prevention

### Data Validation

- **Empty fields**: Skipped (logged as warning)
- **Invalid types**: Type-coerced or skipped
- **Duplicate detection**: Future enhancement
- **Anomalies**: Logged but not blocked

## Testing Strategy

### Unit Tests

```typescript
// lib/integrations/__tests__/salesforce.test.ts
- Test OAuth flow
- Test token refresh
- Test data fetching
- Test emissions calculation

// lib/integrations/__tests__/netsuite.test.ts
- Test GL fetching
- Test emissions calculation
- Test error handling

// lib/integrations/__tests__/accounting.test.ts
- Test Xero vs QB flows
- Test expense syncing
- Test category mapping
```

### Integration Tests

```typescript
// Integration tests for API routes
- POST /api/app/integrations/salesforce/auth → creates connection
- GET /api/app/integrations/salesforce/callback → stores tokens
- POST /api/app/integrations/salesforce/sync → creates datapoints

// End-to-end tests
- Mock OAuth providers
- Verify datapoints created with correct values
- Verify sync logs recorded
```

### Manual Testing Checklist

- [ ] Connect to each provider
- [ ] Verify auth flow redirects correctly
- [ ] Verify tokens stored encrypted
- [ ] Manually trigger sync
- [ ] Verify datapoints created
- [ ] Check sync logs in admin panel
- [ ] Test token refresh on expired token
- [ ] Test error handling (invalid GL codes, etc.)

## Security Considerations

1. **Token Storage**: Encrypted at rest via Payload CMS encryption
2. **Token Refresh**: Only server-side, tokens never sent to client
3. **API Keys**: Read from environment variables, never hardcoded
4. **CORS**: Proxy through API routes (no direct client calls)
5. **Rate Limiting**: Implement per integration (TODO)
6. **Audit Logging**: All syncs logged with user ID + timestamp

## Future Enhancements

1. **Scheduled Syncs**: Use cron jobs for auto-sync by frequency
2. **Deduplication**: Prevent duplicate datapoints on re-sync
3. **Conflict Resolution**: Handle concurrent edits to GL codes
4. **Partial Failures**: Email admins on sync errors
5. **Data Lineage**: Track which datapoints came from which sync
6. **Rollback**: Ability to undo a sync's datapoints
7. **Webhooks**: Real-time sync on account/GL changes
8. **Multi-currency**: Handle different currencies in GL sync
9. **Advanced Mapping**: Custom transformation functions per GL code
10. **Batch Operations**: Sync multiple periods at once

## Troubleshooting

### Connection fails immediately

- Verify OAuth credentials are correct
- Check redirect URI matches configured URL
- Ensure provider API access is enabled

### Sync creates no datapoints

- Check GL code mapping is configured
- Verify GL codes exist in NetSuite/Xero/QB
- Check org.id matches in database
- Review error logs in integration-sync-logs

### Token refresh fails

- Verify refresh token wasn't revoked in provider
- Check token expiration window (usually 60 days)
- Re-authorize connection
- Contact provider support if persistent

### Emissions values seem wrong

- Verify GL code mapping is correct
- Check emissions factors in service code
- Review datapoint quality (should be "estimated")
- Compare to manual calculations

## Support

For issues or questions:

1. Check integration-sync-logs for error messages
2. Verify OAuth app configuration in provider console
3. Check environment variables are set
4. Review API route permissions
5. Contact support with connection ID + sync log
