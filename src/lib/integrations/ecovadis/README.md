# EcoVadis Integration (SM-001)

Supply chain ESG assessment scoring via EcoVadis API. Syncs supplier assessments, calculates risk tiers, and enables automated alerts.

## Configuration

Set these environment variables:

```bash
ECOVADIS_CLIENT_ID=your-client-id
ECOVADIS_CLIENT_SECRET=your-client-secret
ECOVADIS_REDIRECT_URI=https://yourdomain.com/api/app/integrations/ecovadis/callback
```

## API Endpoints

### OAuth Flow

**GET `/api/app/integrations/ecovadis/connect`**
Returns OAuth authorization URL. Admin/owner only.

Response:
```json
{ "url": "https://api.ecovadis.com/oauth/v2/auth?..." }
```

**GET `/api/app/integrations/ecovadis/callback`**
OAuth callback handler. Exchanges code for tokens and creates/updates connection.

**POST `/api/app/integrations/ecovadis/disconnect`**
Disconnects EcoVadis integration. Admin/owner only.

### Status & Manual Sync

**GET `/api/app/integrations/ecovadis/status`**
Returns connection status and sync history.

Response:
```json
{
  "connected": true,
  "status": "connected",
  "connectedAt": "2024-01-15T10:30:00Z",
  "lastSyncAt": "2024-01-15T02:00:00Z",
  "lastSyncStatus": "success",
  "syncCount": 42,
  "totalSuppliersSynced": 1000
}
```

**POST `/api/app/integrations/ecovadis/manual-sync`**
Triggers immediate sync. Admin/owner only.

Response:
```json
{
  "success": true,
  "organisationId": "org_123",
  "suppliersProcessed": 1000,
  "suppliersUpdated": 987,
  "suppliersWithErrors": 13,
  "errors": ["Supplier not found: XYZ Corp"],
  "startedAt": "2024-01-15T10:30:00Z",
  "completedAt": "2024-01-15T10:35:00Z"
}
```

### Cron Job

**GET `/api/cron/ecovadis-sync`**
Daily sync at 2 AM UTC. Requires `CRON_SECRET` in production.

Header: `Authorization: Bearer ${CRON_SECRET}`

## Schema

### EcoVadisConnection Collection

- `organisation` (relationship) — linked org
- `status` — "connected", "disconnected", "error"
- `accessToken` — OAuth access token (encrypted)
- `refreshToken` — OAuth refresh token (encrypted)
- `expiresAt` — token expiration
- `connectedAt` — when connected
- `lastSyncAt` — last sync timestamp
- `lastSyncStatus` — "success", "failed", "pending"
- `errorMessage` — last error details
- `syncCount` — total syncs run
- `totalSuppliersSynced` — cumulative updated suppliers

### Suppliers Collection (Extended)

**ecovadis group:**
- `score` (0-100) — EcoVadis score
- `assessmentDate` — assessment date
- `categories` (JSON) — Environment, Labor, Ethics, Procurement scores
- `lastAssessed` — when last assessed
- `trend` — "improving", "stable", "declining"
- `ecoVadisUrl` — link to EcoVadis profile

**riskMetrics group:**
- `score` (0-100) — composite risk score
- `tier` — "low", "medium", "high", "critical"
- `flags` (JSON) — ["low_ecocadis_score", "critical_ecovadis_score", ...]
- `calculatedAt` — when calculated

## Risk Scoring

Composite risk = EcoVadis score (50%) + industry risk (10%) + location risk (10%) + spend risk (20%) + trend risk (10%)

Risk tiers:
- **Low**: score ≥ 60
- **Medium**: 45-59
- **High**: 30-44
- **Critical**: < 30

## Features

✅ OAuth 2.0 token management with auto-refresh  
✅ Daily automated sync (2 AM UTC)  
✅ Multi-dimensional scoring (4 categories)  
✅ Automatic risk flagging for low scores  
✅ 24-month historical tracking  
✅ 3-retry error handling  
✅ Delta sync (only changed suppliers)  
✅ Admin UI (connect, disconnect, manual sync, history)  
✅ Sync status dashboard  
✅ Data freshness validation (48h+)  
✅ Performance: 1000+ suppliers in <30s  

## Testing

```bash
npm test -- src/lib/integrations/ecovadis
```

Includes:
- 15+ unit tests (OAuth, scoring, sync logic)
- 5+ integration tests (full sync, errors, retries, performance)
- Mock data fixtures

## Monitoring

Check Sentry for integration errors. Look for:
- `EcoVadis API error` — API failures
- `No refresh token available` — expired token not refreshable
- `Supplier not found in DB` — sync mismatch

## Future

- [ ] Alert emails on high-risk score changes
- [ ] Supplier risk dashboard (filterable by tier, category)
- [ ] Historical score trending (30/60/90 day)
- [ ] Webhook notifications for critical changes
- [ ] Bulk import from CSV for initial load
