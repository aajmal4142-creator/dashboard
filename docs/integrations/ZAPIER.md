# Zapier — ClearESG webhooks

ClearESG delivers signed HTTPS POSTs when organisation events fire. Zapier catches them via **Webhooks by Zapier → Catch Hook**.

## Prerequisites

1. Owner or admin opens **Integrations → Webhooks** in ClearESG.
2. Create a registration with one or more events (see below).
3. Copy the signing secret when shown — store it in Zapier for optional signature checks.

## Events ClearESG delivers

| Event               | When                                             |
| ------------------- | ------------------------------------------------ |
| `datapoint.created` | New datapoint written (ingest, UI, integrations) |
| `datapoint.updated` | Existing datapoint updated                       |
| `report.generated`  | Report artefact generated                        |

Register these exact strings on the webhook. Older template aliases such as `data.created` are not emitted.

## Zap setup

1. **Trigger:** Webhooks by Zapier → Catch Hook. Copy the Zapier URL.
2. In ClearESG, create a webhook pointing at that URL with `datapoint.created` (or the events you need).
3. Trigger a test datapoint (or use **Replay** on a past delivery).
4. Map payload fields in later Zap steps (`event`, `timestamp`, nested `data`).

## Sample payload (`datapoint.created`)

```json
{
  "event": "datapoint.created",
  "timestamp": "2026-08-05T10:00:00.000Z",
  "data": {
    "id": "dp_…",
    "metricKey": "electricity_kwh",
    "value": 1200,
    "unit": "kWh",
    "quality": "measured"
  }
}
```

Headers include `X-Webhook-Event` and `X-Webhook-Signature` (HMAC) when a secret is configured. See `src/lib/webhooks/API_DOCUMENTATION.md` for signature verification.

## Recipes (start here)

| Recipe                      | Trigger event       | Suggested Zap actions                    |
| --------------------------- | ------------------- | ---------------------------------------- |
| New datapoint → spreadsheet | `datapoint.created` | Google Sheets / Airtable append row      |
| Report ready → Slack        | `report.generated`  | Slack channel message with download link |
| Datapoint update → CRM note | `datapoint.updated` | HubSpot / Salesforce create note         |

Published templates also appear on **Integrations → Webhooks** (Zapier / Make cards) and in Developers docs under Webhooks.
