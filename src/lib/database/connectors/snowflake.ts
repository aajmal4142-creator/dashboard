/**
 * Snowflake warehouse connector via SQL REST API (same DatabaseConnector surface).
 * Requires account, warehouse, database, schema, user, and personal access token / password.
 */

import { sanitizeConnectorError } from "../encrypt";
import type {
  DatabaseConnector,
  DiscoveredTable,
  QueryRowsOptions,
  QueryRowsResult,
  SnowflakeCredentials,
  TestConnectionResult,
} from "../types";

function quoteIdent(ident: string): string {
  return `"${ident.replace(/"/g, '""')}"`;
}

function accountHost(account: string): string {
  const a = account
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/$/, "");
  if (a.includes(".snowflakecomputing.com")) return a;
  return `${a}.snowflakecomputing.com`;
}

async function snowflakeSql(
  credentials: SnowflakeCredentials,
  statement: string,
): Promise<{
  data?: unknown[][];
  resultSetMetaData?: { rowType?: Array<{ name?: string; type?: string }> };
}> {
  const host = accountHost(credentials.account);
  const auth = Buffer.from(
    `${credentials.user}:${credentials.passwordOrToken}`,
    "utf8",
  ).toString("base64");

  const res = await fetch(`https://${host}/api/v2/statements`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Basic ${auth}`,
      "X-Snowflake-Authorization-Token-Type": "BASIC",
    },
    body: JSON.stringify({
      statement,
      timeout: 60,
      database: credentials.database,
      schema: credentials.schema,
      warehouse: credentials.warehouse,
      role: credentials.role || undefined,
    }),
  });

  const body = (await res.json().catch(() => ({}))) as {
    message?: string;
    code?: string;
    data?: unknown[][];
    resultSetMetaData?: { rowType?: Array<{ name?: string; type?: string }> };
  };

  if (!res.ok) {
    throw new Error(body.message || `Snowflake HTTP ${res.status}`);
  }
  return body;
}

export function createSnowflakeConnector(
  credentials: SnowflakeCredentials,
): DatabaseConnector {
  return {
    engine: "snowflake",

    async testConnection(): Promise<TestConnectionResult> {
      try {
        await snowflakeSql(credentials, "SELECT 1 AS ok");
        return { ok: true, message: "Snowflake connection succeeded" };
      } catch (err) {
        return { ok: false, message: sanitizeConnectorError(err) };
      }
    },

    async listTables(schema?: string): Promise<DiscoveredTable[]> {
      const sch = (schema?.trim() || credentials.schema).toUpperCase();
      const db = credentials.database.toUpperCase();
      const result = await snowflakeSql(
        credentials,
        `SELECT TABLE_SCHEMA, TABLE_NAME
         FROM ${quoteIdent(db)}.INFORMATION_SCHEMA.TABLES
         WHERE TABLE_SCHEMA = '${sch.replace(/'/g, "''")}'
         ORDER BY TABLE_NAME
         LIMIT 200`,
      );
      const rows = result.data ?? [];
      const discovered: DiscoveredTable[] = [];

      for (const row of rows) {
        const tableSchema = String(row[0] ?? sch);
        const tableName = String(row[1] ?? "");
        if (!tableName) continue;

        const colsResult = await snowflakeSql(
          credentials,
          `SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
           FROM ${quoteIdent(db)}.INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = '${tableSchema.replace(/'/g, "''")}'
             AND TABLE_NAME = '${tableName.replace(/'/g, "''")}'
           ORDER BY ORDINAL_POSITION`,
        );
        const colRows = colsResult.data ?? [];
        discovered.push({
          schema: tableSchema,
          name: tableName,
          columns: colRows
            .map((c) => ({
              name: String(c[0] ?? ""),
              dataType: String(c[1] ?? "TEXT"),
              nullable: String(c[2] ?? "YES").toUpperCase() !== "NO",
            }))
            .filter((c) => c.name.length > 0),
        });
      }
      return discovered;
    },

    async queryRows(options: QueryRowsOptions): Promise<QueryRowsResult> {
      const sch = (options.schema?.trim() || credentials.schema).toUpperCase();
      const cols =
        options.columns.length > 0 ? options.columns.map(quoteIdent).join(", ") : "*";
      const from = `${quoteIdent(credentials.database)}.${quoteIdent(sch)}.${quoteIdent(options.table)}`;
      let sql = `SELECT ${cols} FROM ${from}`;
      if (options.incrementalColumn && options.lastIncrementalValue) {
        const col = quoteIdent(options.incrementalColumn);
        const val = String(options.lastIncrementalValue).replace(/'/g, "''");
        sql += ` WHERE ${col} > '${val}'`;
      }
      const limit = options.limit && options.limit > 0 ? options.limit : 5000;
      sql += ` LIMIT ${limit}`;

      const result = await snowflakeSql(credentials, sql);
      const meta = result.resultSetMetaData?.rowType ?? [];
      const names = meta.map((m, i) => String(m.name ?? `col_${i}`));
      const rows: Record<string, unknown>[] = (result.data ?? []).map((r) => {
        const obj: Record<string, unknown> = {};
        for (let i = 0; i < names.length; i++) {
          obj[names[i]!] = r[i];
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
      // Stateless HTTP — nothing to close
    },
  };
}
