/**
 * Databricks SQL warehouse connector via Statement Execution API.
 * Same DatabaseConnector surface as Snowflake.
 */

import { sanitizeConnectorError } from "../encrypt";
import type {
  DatabaseConnector,
  DatabricksCredentials,
  DiscoveredTable,
  QueryRowsOptions,
  QueryRowsResult,
  TestConnectionResult,
} from "../types";

function workspaceBase(host: string): string {
  const h = host.trim().replace(/\/$/, "");
  if (h.startsWith("https://") || h.startsWith("http://")) return h;
  return `https://${h}`;
}

async function databricksSql(
  credentials: DatabricksCredentials,
  statement: string,
): Promise<{
  result?: {
    data_array?: unknown[][];
    schema?: { columns?: Array<{ name?: string; type_text?: string }> };
  };
  status?: { state?: string; error?: { message?: string } };
}> {
  const base = workspaceBase(credentials.host);
  const res = await fetch(`${base}/api/2.0/sql/statements`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${credentials.token}`,
    },
    body: JSON.stringify({
      statement,
      warehouse_id: credentials.warehouseId,
      catalog: credentials.catalog || undefined,
      schema: credentials.schema || undefined,
      wait_timeout: "50s",
      disposition: "INLINE",
      format: "JSON_ARRAY",
    }),
  });

  const body = (await res.json().catch(() => ({}))) as {
    message?: string;
    error?: string | { message?: string };
    result?: {
      data_array?: unknown[][];
      schema?: { columns?: Array<{ name?: string; type_text?: string }> };
    };
    status?: { state?: string; error?: { message?: string } };
  };

  if (!res.ok) {
    const errMsg =
      typeof body.error === "string"
        ? body.error
        : body.error?.message || body.message || `Databricks HTTP ${res.status}`;
    throw new Error(errMsg);
  }

  const state = body.status?.state;
  if (state === "FAILED" || state === "CANCELED" || state === "CLOSED") {
    throw new Error(
      body.status?.error?.message || `Databricks statement ${state ?? "failed"}`,
    );
  }

  return body;
}

function quoteIdent(ident: string): string {
  return `\`${ident.replace(/`/g, "``")}\``;
}

export function createDatabricksConnector(
  credentials: DatabricksCredentials,
): DatabaseConnector {
  return {
    engine: "databricks",

    async testConnection(): Promise<TestConnectionResult> {
      try {
        await databricksSql(credentials, "SELECT 1 AS ok");
        return { ok: true, message: "Databricks connection succeeded" };
      } catch (err) {
        return { ok: false, message: sanitizeConnectorError(err) };
      }
    },

    async listTables(schema?: string): Promise<DiscoveredTable[]> {
      const sch = schema?.trim() || credentials.schema || "default";
      const catalog = credentials.catalog?.trim();
      const from = catalog
        ? `${quoteIdent(catalog)}.information_schema.tables`
        : "information_schema.tables";
      const result = await databricksSql(
        credentials,
        `SELECT table_schema, table_name
         FROM ${from}
         WHERE table_schema = '${sch.replace(/'/g, "''")}'
         ORDER BY table_name
         LIMIT 200`,
      );
      const rows = result.result?.data_array ?? [];
      const discovered: DiscoveredTable[] = [];

      for (const row of rows) {
        const tableSchema = String(row[0] ?? sch);
        const tableName = String(row[1] ?? "");
        if (!tableName) continue;

        const colsFrom = catalog
          ? `${quoteIdent(catalog)}.information_schema.columns`
          : "information_schema.columns";
        const colsResult = await databricksSql(
          credentials,
          `SELECT column_name, data_type, is_nullable
           FROM ${colsFrom}
           WHERE table_schema = '${tableSchema.replace(/'/g, "''")}'
             AND table_name = '${tableName.replace(/'/g, "''")}'
           ORDER BY ordinal_position`,
        );
        const colRows = colsResult.result?.data_array ?? [];
        discovered.push({
          schema: tableSchema,
          name: tableName,
          columns: colRows
            .map((c) => ({
              name: String(c[0] ?? ""),
              dataType: String(c[1] ?? "STRING"),
              nullable: String(c[2] ?? "YES").toUpperCase() !== "NO",
            }))
            .filter((c) => c.name.length > 0),
        });
      }
      return discovered;
    },

    async queryRows(options: QueryRowsOptions): Promise<QueryRowsResult> {
      const sch = options.schema?.trim() || credentials.schema || "default";
      const catalog = credentials.catalog?.trim();
      const cols =
        options.columns.length > 0 ? options.columns.map(quoteIdent).join(", ") : "*";
      const tableParts = catalog
        ? [quoteIdent(catalog), quoteIdent(sch), quoteIdent(options.table)]
        : [quoteIdent(sch), quoteIdent(options.table)];
      const from = tableParts.join(".");
      let sql = `SELECT ${cols} FROM ${from}`;
      if (options.incrementalColumn && options.lastIncrementalValue) {
        const col = quoteIdent(options.incrementalColumn);
        const val = String(options.lastIncrementalValue).replace(/'/g, "''");
        sql += ` WHERE ${col} > '${val}'`;
      }
      const limit = options.limit && options.limit > 0 ? options.limit : 5000;
      sql += ` LIMIT ${limit}`;

      const result = await databricksSql(credentials, sql);
      const meta = result.result?.schema?.columns ?? [];
      const names =
        meta.length > 0
          ? meta.map((m, i) => String(m.name ?? `col_${i}`))
          : options.columns.length > 0
            ? options.columns
            : [];
      const data = result.result?.data_array ?? [];
      const rows: Record<string, unknown>[] = data.map((r) => {
        const obj: Record<string, unknown> = {};
        const colsCount = names.length > 0 ? names.length : r.length;
        for (let i = 0; i < colsCount; i++) {
          const key = names[i] ?? `col_${i}`;
          obj[key] = r[i];
        }
        return obj;
      });

      let maxIncrementalValue: string | undefined;
      if (options.incrementalColumn) {
        for (const row of rows) {
          const v = row[options.incrementalColumn];
          if (v == null) continue;
          const s = String(v);
          if (!maxIncrementalValue || s > maxIncrementalValue) maxIncrementalValue = s;
        }
      }

      return { rows, maxIncrementalValue };
    },

    async close(): Promise<void> {
      // Stateless HTTP
    },
  };
}
