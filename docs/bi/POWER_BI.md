# Power BI setup — ClearESG BI connectors

ClearESG exposes **read-only** JSON APIs under `/api/app/bi/*`. Power BI connects via **Web** / **OData-style** REST (Get Data → Web). There is no native `.mez` / certified connector package in this repository — use the REST endpoints below with an organisation API key from **Settings → BI connectors**.

## Prerequisites

1. Owner or admin creates a BI API key in ClearESG **Settings**.
2. Copy the key when shown (prefix only is stored thereafter).
3. Base URL: `https://<your-host>` (local: `http://localhost:3000`).

## Authentication

Send the key on every request:

- `Authorization: Bearer bi_…` **or**
- `X-ClearESG-Api-Key: bi_…`

Do not paste the full key into shared workspaces or commit it to source control. Rotate by revoking the key in Settings and creating a new one.

## Endpoints

| Resource   | Method | Path                     | Notes                                           |
| ---------- | ------ | ------------------------ | ----------------------------------------------- |
| Emissions  | GET    | `/api/app/bi/emissions`  | Scope 1/2/3 totals per reporting period (tCO2e) |
| Datapoints | GET    | `/api/app/bi/datapoints` | `?limit=&page=&periodId=`                       |
| Suppliers  | GET    | `/api/app/bi/suppliers`  | `?limit=&page=`                                 |
| Scenarios  | GET    | `/api/app/bi/scenarios`  | `?limit=&page=`                                 |
| Benchmarks | GET    | `/api/app/bi/benchmarks` | `?metricKey=electricity_kwh`                    |

All methods other than GET are rejected. Mutations are not available on BI keys.

Rate limit: **120 requests / minute / key**. Responses include `X-RateLimit-*` and `Retry-After` when limited. Access is audit-logged (key prefix only).

## Power BI Desktop — Get Data from Web

1. **Home → Get Data → Web**.
2. Enter a full URL, for example:
   `https://<host>/api/app/bi/emissions`
3. Choose **Advanced** and add an HTTP header:
   - Name: `Authorization`
   - Value: `Bearer bi_<your-key>`
4. Transform the JSON (e.g. expand `periods` into a table).
5. Repeat for other resources, or use **Power Query** to call multiple URLs into one model.

### Sample Power Query (Web.Contents)

```powerquery
let
  BaseUrl = "https://<host>",
  ApiKey = "bi_<your-key>",
  Response = Json.Document(
    Web.Contents(
      BaseUrl & "/api/app/bi/emissions",
      [
        Headers = [#"Authorization" = "Bearer " & ApiKey]
      ]
    )
  ),
  Periods = Table.FromList(Response[periods], Splitter.SplitByNothing(), {"Record"}),
  Expanded = Table.ExpandRecordColumn(
    Periods,
    "Record",
    {"periodId", "year", "scope1", "scope2", "scope3", "total", "quality"}
  )
in
  Expanded
```

Store the key in a **parameter** or Azure Key Vault–backed connection when publishing to the Power BI service. Scheduled refresh requires the same header on the gateway / cloud connection.

## Modelling tips

- Join `datapoints.periodId` to `emissions.periodId`.
- Use `suppliers.riskScore` and category for heat maps; do not expect peer identities from benchmarks.
- Benchmarks may return `available: false` when the cohort gate is not met — handle empty states in visuals.

## Security

- Keys are org-scoped and read-only.
- Revoke unused keys in Settings.
- ClearESG never returns the full key after creation and never writes it to audit logs.
