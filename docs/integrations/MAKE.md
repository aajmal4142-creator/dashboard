# Make.com — ClearESG webhooks

ClearESG posts signed JSON to your Make **Custom webhook** (or HTTP module) when events fire.

## Prerequisites

1. Owner or admin opens **Integrations → Webhooks**.
2. In Make, create a scenario with **Webhooks → Custom webhook** and copy the URL.
3. Register that URL in ClearESG with the events below. Save the signing secret if you verify HMAC.

## Events

| Event               | Use in Make                                   |
| ------------------- | --------------------------------------------- |
| `datapoint.created` | Route new readings into Sheets, Notion, Slack |
| `datapoint.updated` | Sync corrections                              |
| `report.generated`  | Notify finance / assurance channels           |

ClearESG does not emit `alert.triggered` or `sync.completed` on the registration API yet — use Automations / Alerts inside the product for those paths, or poll BI APIs.

## Scenario setup

1. Trigger: Custom webhook → determine data structure from a ClearESG test delivery.
2. Router / filters on `event` if one scenario handles multiple event types.
3. Modules: Google Sheets, Slack, email, HTTP to your ERP.

## Sample filter

```
event = datapoint.created
AND data.quality = measured
```

## Recipes

| Recipe                    | Modules                                                       |
| ------------------------- | ------------------------------------------------------------- |
| Meter reading → ops sheet | Webhook → Google Sheets → Add a row                           |
| Report generated → Teams  | Webhook → Microsoft 365 Email / Teams                         |
| Failed delivery recovery  | Use ClearESG **Replay** on dead-letter rows, then re-run Make |

See also `docs/integrations/ZAPIER.md` and `src/lib/webhooks/API_DOCUMENTATION.md`.
