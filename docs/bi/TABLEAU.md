# Tableau setup — ClearESG BI connectors

ClearESG exposes **read-only** JSON APIs under `/api/app/bi/*` for Tableau Desktop / Tableau Prep / Tableau Server web data connectors. This repo ships **setup samples**, not a packaged `.taco` / native WDC binary.

## Prerequisites

1. Create a BI API key in ClearESG **Settings → BI connectors** (owner/admin).
2. Copy the key at creation time.
3. Base URL: `https://<your-host>`.

## Authentication

- Header `Authorization: Bearer bi_…` **or**
- Header `X-ClearESG-Api-Key: bi_…`

## Endpoints

| Resource   | Path                                                   |
| ---------- | ------------------------------------------------------ |
| Emissions  | `GET /api/app/bi/emissions`                            |
| Datapoints | `GET /api/app/bi/datapoints?limit=100&page=1`          |
| Suppliers  | `GET /api/app/bi/suppliers`                            |
| Scenarios  | `GET /api/app/bi/scenarios`                            |
| Benchmarks | `GET /api/app/bi/benchmarks?metricKey=electricity_kwh` |

Rate limit: 120 requests / minute / key. Access is audit-logged (prefix only).

## Option A — Tableau Web Data Connector (WDC 2.x sample)

Host a minimal WDC page (static HTML/JS) that calls ClearESG. Tableau Desktop: **Connect → Web Data Connector** → paste the WDC URL.

Example connector logic (illustrative):

```javascript
// Sample only — host on HTTPS; do not embed production secrets in the page.
(function () {
  var myConnector = tableau.makeConnector();

  myConnector.getSchema = function (schemaCallback) {
    schemaCallback([
      {
        id: "emissions",
        alias: "ClearESG Emissions",
        columns: [
          { id: "periodId", dataType: tableau.dataTypeEnum.string },
          { id: "year", dataType: tableau.dataTypeEnum.int },
          { id: "scope1", dataType: tableau.dataTypeEnum.float },
          { id: "scope2", dataType: tableau.dataTypeEnum.float },
          { id: "scope3", dataType: tableau.dataTypeEnum.float },
          { id: "total", dataType: tableau.dataTypeEnum.float },
        ],
      },
    ]);
  };

  myConnector.getData = function (table, doneCallback) {
    var base = tableau.connectionData; // set by UI, e.g. https://app.example.com
    var key = tableau.password; // store API key as password in connection
    fetch(base + "/api/app/bi/emissions", {
      headers: { Authorization: "Bearer " + key },
    })
      .then(function (r) {
        return r.json();
      })
      .then(function (body) {
        var rows = (body.periods || []).map(function (p) {
          return {
            periodId: p.periodId,
            year: p.year,
            scope1: p.scope1,
            scope2: p.scope2,
            scope3: p.scope3,
            total: p.total,
          };
        });
        table.appendRows(rows);
        doneCallback();
      });
  };

  tableau.registerConnector(myConnector);
})();
```

Connection UI should collect **base URL** → `tableau.connectionData` and **API key** → `tableau.password` so the key is not hard-coded in the WDC HTML.

## Option B — Tableau Prep / Web query

1. In Prep, add a **JSON** or **Web** input pointing at  
   `https://<host>/api/app/bi/suppliers`.
2. Configure custom headers with the Bearer token.
3. Flatten nested arrays (`suppliers`, `datapoints`, `periods`) into rows.
4. Publish the flow; refresh credentials via Tableau Server/Cloud secrets where available.

## Option C — Hyper / extract via script

For automated extracts, a scheduled job can `GET` each endpoint and load Parquet/CSV into Hyper. Prefer service-side secret storage; never commit `bi_` keys.

## Modelling tips

- Relate datapoints to emissions on `periodId`.
- Treat benchmarks as a separate table; respect `available: false` when the peer cohort is below the platform gate.
- BI keys cannot create, update, or delete ClearESG data.

## Security

Revoke keys in ClearESG Settings when a workbook is retired. Audit events use action names such as `bi.read.emissions` and store only the key prefix.
