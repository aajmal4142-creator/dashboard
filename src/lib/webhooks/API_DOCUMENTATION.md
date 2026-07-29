# ClearESG API & Webhook Data Ingestion

## Overview

The ClearESG API provides REST endpoints for organizations to programmatically ingest data and manage webhooks for real-time events. All endpoints require authentication and enforce rate limiting at 1000 requests per organization per hour.

## Base URL

```
https://api.clearesg.com/api/app
```

## Authentication

All API requests require:
- `Authorization: Bearer <user_token>` (from Clerk authentication)
- `Content-Type: application/json`
- TLS 1.2 or higher

## Rate Limiting

All endpoints respect the following rate limits per organization:
- **Limit**: 1000 requests per hour
- **Window**: 3600 seconds
- **Header**: `X-RateLimit-Remaining` (requests remaining in current window)
- **Status Code**: 429 Too Many Requests when limit exceeded

## API Endpoints

### 1. Ingest Datapoints

#### POST `/data/ingest`

Ingest datapoints into the organization's active reporting period. Supports both single and batch ingestion.

**Authentication Required**: Yes (Contributor role minimum)

**Request Body** (Single):
```json
{
  "metricKey": "emissions.scope1",
  "value": 150.5,
  "quality": "measured",
  "unit": "tCO2e"
}
```

**Request Body** (Batch - Array of 1-1000 items):
```json
[
  {
    "metricKey": "emissions.scope1",
    "value": 150.5,
    "quality": "measured",
    "unit": "tCO2e"
  },
  {
    "metricKey": "emissions.scope2",
    "value": 200,
    "quality": "calculated",
    "unit": "tCO2e"
  }
]
```

**Parameters**:
- `metricKey` (string, required): Unique identifier for the metric (e.g., "emissions.scope1")
- `value` (number, optional): The numeric value of the datapoint
- `quality` (string, required): Data quality indicator - one of:
  - `measured`: Primary data from direct measurement
  - `calculated`: Data derived from modeling/calculation
  - `estimated`: Data from industry estimates
  - `missing`: Placeholder for missing data
- `unit` (string, optional): Unit of measurement (e.g., "tCO2e", "kWh")

**Success Response** (Single):
```json
{
  "ok": true,
  "id": "datapoint-123",
  "status": "created",
  "timestamp": "2025-07-29T10:30:00Z"
}
```

**Success Response** (Batch):
```json
{
  "ok": true,
  "inserted": 950,
  "failed": 50,
  "errors": [
    {
      "index": 5,
      "error": "Invalid quality value"
    }
  ]
}
```

**Error Responses**:
- `400 API-004`: Invalid datapoint schema
- `401 API-006`: Insufficient permissions
- `402`: Billing issue (quota exceeded)
- `403`: User not authenticated
- `429 API-003`: Rate limit exceeded
- `409`: Reporting period is locked

---

### 2. Register Webhook

#### POST `/webhooks/register`

Register a webhook endpoint to receive real-time events.

**Authentication Required**: Yes (Admin role minimum)

**Request Body**:
```json
{
  "endpoint_url": "https://your-domain.com/webhooks/clearesg",
  "events": ["datapoint.created", "datapoint.updated"]
}
```

**Parameters**:
- `endpoint_url` (string, required): HTTPS URL to receive webhook events
- `events` (array, required): Event types to subscribe to
  - `datapoint.created`: Fired when a datapoint is created
  - `datapoint.updated`: Fired when a datapoint is updated

**Success Response** (201 Created):
```json
{
  "ok": true,
  "webhook_id": "wh_550e8400-e29b-41d4-a716-446655440000",
  "endpoint_url": "https://your-domain.com/webhooks/clearesg",
  "secret": "whsec_3d6d1e4f5a0c9b2e8f7a3c4d6e9f1a2b",
  "events": ["datapoint.created", "datapoint.updated"],
  "status": "active",
  "createdAt": "2025-07-29T10:30:00Z"
}
```

**Error Responses**:
- `400 API-009`: Invalid request format
- `401 API-006`: Insufficient permissions (Admin required)
- `403`: User not authenticated

---

### 3. List Webhooks

#### GET `/webhooks/register`

List all registered webhooks for the organization.

**Authentication Required**: Yes (Admin role minimum)

**Success Response**:
```json
{
  "ok": true,
  "webhooks": [
    {
      "webhook_id": "wh_550e8400-e29b-41d4-a716-446655440000",
      "endpoint_url": "https://your-domain.com/webhooks/clearesg",
      "events": ["datapoint.created", "datapoint.updated"],
      "status": "active",
      "last_triggered_at": "2025-07-29T10:30:00Z",
      "retry_count": 2,
      "createdAt": "2025-07-29T10:30:00Z"
    }
  ]
}
```

**Error Responses**:
- `401 API-006`: Insufficient permissions
- `403`: User not authenticated

---

### 4. Delete Webhook

#### DELETE `/webhooks/{webhook_id}`

Deactivate and remove a webhook registration.

**Authentication Required**: Yes (Admin role minimum)

**Path Parameters**:
- `webhook_id` (string, required): The webhook ID (UUID format)

**Success Response**:
```json
{
  "ok": true,
  "deleted": "wh_550e8400-e29b-41d4-a716-446655440000"
}
```

**Error Responses**:
- `401 API-006`: Insufficient permissions
- `403`: User not authenticated
- `404 API-002`: Webhook not found

---

### 5. Receive Webhook Events

#### POST `/webhooks/events`

**This endpoint receives events FROM your webhooks (i.e., ClearESG sends events to your registered endpoint).**

When webhook events occur in ClearESG, we POST events to your registered endpoint URL. Your endpoint must:
1. Verify the request signature
2. Process the event
3. Return a 2xx status code within 30 seconds

**Headers**:
- `X-Webhook-Signature`: HMAC-SHA256 signature for verification
- `X-Webhook-ID`: The webhook ID that triggered the event
- `X-Webhook-Event`: Event type (e.g., "datapoint.created")
- `Content-Type: application/json`

**Request Body** (Example):
```json
{
  "datapoint_id": "dp_123abc",
  "metricKey": "emissions.scope1",
  "value": 150.5,
  "quality": "measured",
  "timestamp": "2025-07-29T10:30:00Z"
}
```

**Signature Verification**

Each request includes `X-Webhook-Signature` header in format: `timestamp,hash`

```javascript
// Node.js example
const crypto = require('crypto');

function verifySignature(payload, signature, secret) {
  const [timestamp, hash] = signature.split(',');
  const ts = parseInt(timestamp, 10);
  
  // Reject if >5 minutes old
  if (Math.floor(Date.now() / 1000) - ts > 300) return false;
  
  const signed = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${payload}`)
    .digest('hex');
  
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signed));
}
```

**Expected Response**:
```
HTTP 200 OK
Content-Type: application/json

{
  "ok": true
}
```

**Retry Policy**

If your endpoint returns non-2xx or times out, ClearESG retries with exponential backoff:
- Attempt 1: Immediate
- Attempt 2: 1 second delay
- Attempt 3: 2 second delay
- Attempt 4: 5 second delay
- Attempt 5: 10 seconds (final attempt)

After 5 total attempts, the webhook is moved to a dead letter queue for manual review.

**Timeouts**: Maximum 30 seconds per request

---

## Error Codes Reference

| Code | HTTP Status | Description |
|------|---|---|
| API-001 | 400 | Invalid request signature |
| API-002 | 404 | Webhook not found |
| API-003 | 429 | Rate limit exceeded |
| API-004 | 400 | Invalid datapoint schema |
| API-005 | 402 | Organization quota exceeded |
| API-006 | 401/403 | Unauthorized or insufficient permissions |
| API-007 | 409 | Reporting period is closed |
| API-008 | 404 | Organization not found |
| API-009 | 400 | Invalid request format |
| API-010 | 500 | Webhook delivery failed (will retry) |
| API-011 | 500 | Internal server error |

---

## Examples

### Example 1: Ingest a Single Datapoint

```bash
curl -X POST https://api.clearesg.com/api/app/data/ingest \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "metricKey": "emissions.scope1",
    "value": 150.5,
    "quality": "measured",
    "unit": "tCO2e"
  }'
```

### Example 2: Batch Ingest Datapoints

```bash
curl -X POST https://api.clearesg.com/api/app/data/ingest \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '[
    {
      "metricKey": "emissions.scope1",
      "value": 150.5,
      "quality": "measured",
      "unit": "tCO2e"
    },
    {
      "metricKey": "emissions.scope2",
      "value": 200,
      "quality": "calculated",
      "unit": "tCO2e"
    }
  ]'
```

### Example 3: Register a Webhook

```bash
curl -X POST https://api.clearesg.com/api/app/webhooks/register \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "endpoint_url": "https://your-domain.com/webhooks/clearesg",
    "events": ["datapoint.created", "datapoint.updated"]
  }'
```

### Example 4: Handle Webhook Events

```javascript
// Express.js example
const crypto = require('crypto');
const express = require('express');
const app = express();

app.use(express.raw({ type: 'application/json' }));

app.post('/webhooks/clearesg', (req, res) => {
  const signature = req.get('X-Webhook-Signature');
  const webhookId = req.get('X-Webhook-ID');
  const eventType = req.get('X-Webhook-Event');
  
  const secret = process.env.CLEARESG_WEBHOOK_SECRET; // From registration response
  const payload = req.body.toString();
  
  // Verify signature
  const [timestamp, hash] = signature.split(',');
  const ts = parseInt(timestamp, 10);
  
  if (Math.floor(Date.now() / 1000) - ts > 300) {
    return res.status(401).json({ error: 'Signature expired' });
  }
  
  const signed = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${payload}`)
    .digest('hex');
  
  if (!crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signed))) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  // Process event
  const event = JSON.parse(payload);
  console.log(`Received ${eventType}:`, event);
  
  // Do your processing here
  
  res.json({ ok: true });
});

app.listen(3000);
```

---

## Security Best Practices

1. **Always verify signatures** - Never process unsigned webhook requests
2. **Use HTTPS only** - All endpoints require TLS 1.2+
3. **Rotate secrets periodically** - Contact support for secret rotation
4. **Idempotency** - Implement idempotent processing for retried events
5. **Timeouts** - Respond within 30 seconds
6. **Rate limiting** - Cache responses and implement exponential backoff for retries
7. **Logging** - Log all webhook deliveries for auditing

---

## Support

For API support and issues, contact: api-support@clearesg.com

API Stability: Stable (v1)
Last Updated: July 29, 2025
