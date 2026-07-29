# EcoVadis Integration Setup Guide (SM-001)

Complete setup and implementation guide for EcoVadis supplier assessment scoring.

## 1. Prerequisite: EcoVadis Account & API Credentials

1. Sign up at [EcoVadis Partner Portal](https://partners.ecovadis.com)
2. Request API access from your EcoVadis account manager
3. Create OAuth 2.0 application:
   - Navigate to Settings → API → OAuth Apps
   - Create new app: "ClearESG Integration"
   - Set redirect URI: `https://yourdomain.com/api/app/integrations/ecovadis/callback`
   - Copy **Client ID** and **Client Secret**

## 2. Environment Configuration

Add to `.env.local`:

```bash
ECOVADIS_CLIENT_ID=your-actual-client-id
ECOVADIS_CLIENT_SECRET=your-actual-client-secret
ECOVADIS_REDIRECT_URI=https://yourdomain.com/api/app/integrations/ecovadis/callback
```

For local development:
```bash
ECOVADIS_REDIRECT_URI=http://localhost:3000/api/app/integrations/ecovadis/callback
```

## 3. Database Setup

Run migrations to create the new collections:

```bash
npm run generate:types
npm run payload migrate
```

This creates:
- `ecovadis-connections` — OAuth tokens and sync metadata
- Updates `suppliers` with `ecovadis` and `riskMetrics` groups

## 4. Verify Installation

Check that new files exist:
```bash
src/collections/EcoVadisConnection.ts
src/lib/integrations/ecovadis/*.ts
src/app/(frontend)/api/app/integrations/ecovadis/*/route.ts
src/app/(frontend)/api/cron/ecovadis-sync/route.ts
```

## 5. Test OAuth Flow (Local)

### Step 1: Start the dev server
```bash
npm run dev
```

### Step 2: Connect via Admin UI
Visit `http://localhost:3000/admin` → Integrations → EcoVadis → "Connect"

### Step 3: Authorize
You'll be redirected to EcoVadis OAuth login. Authorize and you'll return to app.

### Step 4: Verify Connection
Check the database:
```bash
db.getCollection('ecovadis-connections').findOne({organisation: ObjectId("...")})
```

Should show:
- `status: "connected"`
- `accessToken: "..."`
- `refreshToken: "..."`
- `connectedAt: <timestamp>`

## 6. Test Manual Sync

### Via API
```bash
curl -X POST http://localhost:3000/api/app/integrations/ecovadis/manual-sync \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN" \
  -H "Content-Type: application/json"
```

### Via Admin UI
Settings → Integrations → EcoVadis → "Sync Now"

Response should show:
```json
{
  "success": true,
  "suppliersProcessed": 1000,
  "suppliersUpdated": 987,
  "suppliersWithErrors": 13
}
```

## 7. Verify Data in Suppliers

Query a supplier that was synced:
```bash
db.getCollection('suppliers').findOne(
  {name: "Acme Corp", organisation: ObjectId("...")},
  {ecovadis: 1, riskMetrics: 1}
)
```

Should show:
```json
{
  "ecovadis": {
    "score": 75,
    "assessmentDate": ISODate("2024-01-15"),
    "categories": {
      "environment": 80,
      "labor": 72,
      "ethics": 75,
      "procurement": 70
    },
    "trend": "improving",
    "ecoVadisUrl": "https://www.ecovadiscsrassessments.com/participant/ecovadis-123"
  },
  "riskMetrics": {
    "score": 42,
    "tier": "high",
    "flags": [],
    "calculatedAt": ISODate("2024-01-15T10:30:00Z")
  }
}
```

## 8. Configure Cron Job

The cron is already configured in `vercel.json` to run daily at 2 AM UTC.

### For Production (Vercel)
1. Add `CRON_SECRET` to Vercel environment variables
2. Deploy to production
3. Vercel will call `/api/cron/ecovadis-sync` automatically at 2 AM UTC

### For Local Testing
```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  http://localhost:3000/api/cron/ecovadis-sync
```

## 9. Run Tests

```bash
# Score mapping tests
npm test -- src/lib/integrations/ecovadis/scoreMapper.test.ts

# OAuth manager tests
npm test -- src/lib/integrations/ecovadis/oauth.test.ts

# All integration tests
npm test -- src/lib/integrations/ecovadis
```

Expected: 15+ unit tests passing, all green.

## 10. Monitoring & Alerts

### Check Sync Status
```bash
curl http://localhost:3000/api/app/integrations/ecovadis/status \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN"
```

### Monitor Failures
- Check Sentry for `EcoVadis API error` tags
- Look for `"lastSyncStatus": "failed"` in connection document
- Review `errorMessage` field for details

### Common Issues

**Issue**: `EcoVadis API error: 401 Unauthorized`
- **Cause**: Token expired, not refreshed in time
- **Fix**: Manually sync, or wait for next cron run

**Issue**: `Supplier not found in DB: XYZ Corp`
- **Cause**: Supplier name mismatch between EcoVadis and ClearESG
- **Fix**: Standardize supplier names, or use `externalId` matching

**Issue**: `No refresh token available`
- **Cause**: Initial OAuth didn't save refresh token
- **Fix**: Re-authenticate: Disconnect → Connect again

## 11. Performance Tuning

### Batch Size
Adjust `BATCH_SIZE` in `src/lib/integrations/ecovadis/sync.ts` for your data volume:
- 1000 suppliers: 100 batch size
- 10,000+ suppliers: 500 batch size

### Concurrent Requests
Limit concurrent API calls if hitting rate limits:
```typescript
// In sync.ts, add:
const concurrency = 5; // max concurrent score fetches
```

### Retry Strategy
Adjust `MAX_RETRIES` and `RETRY_DELAY_MS` if network unstable:
```typescript
const MAX_RETRIES = 3; // reduce to 2 for faster failures
const RETRY_DELAY_MS = 1000; // increase to 2000 for slow APIs
```

## 12. Production Checklist

- [ ] OAuth credentials configured in production env vars
- [ ] CRON_SECRET configured in Vercel
- [ ] Database backups enabled (MongoDB)
- [ ] Sentry monitoring active
- [ ] Sync logs reviewed (manual first sync successful)
- [ ] Risk tiers validated (spot-check 5-10 suppliers)
- [ ] Supplier names standardized between systems
- [ ] Email alerts configured for critical risks
- [ ] Load tested with 1000+ suppliers
- [ ] Documentation updated for team

## 13. Next Steps (Future Enhancements)

- [ ] Supplier risk dashboard (filterable by tier, category, spend)
- [ ] Historical trending (30/60/90 day comparisons)
- [ ] Webhook notifications for score changes
- [ ] Bulk CSV import for initial data load
- [ ] Custom risk formula per industry/location
- [ ] Alert emails to suppliers on high-risk flags
- [ ] Integration with procurement workflows
- [ ] API rate limit handling improvements

## Support

For issues:
1. Check logs in Sentry
2. Review `ecovadis-connections` collection for error details
3. Ensure supplier names match between systems
4. Test OAuth flow manually
5. Check EcoVadis API status (sometimes down for maintenance)

Questions? Contact your EcoVadis account manager or ClearESG support.
