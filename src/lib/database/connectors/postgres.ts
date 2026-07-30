import { Client } from "pg";

import { sanitizeConnectorError } from "../encrypt";
import type {
  DatabaseConnector,
  DiscoveredTable,
  QueryRowsOptions,
  QueryRowsResult,
  SqlCredentials,
  TestConnectionResult,
} from "../types";

function quoteIdent(ident: string): string {
  return `"${ident.replace(/"/g, '""')}"`;
}

export function createPostgresConnector(credentials: SqlCredentials): DatabaseConnector {
  let client: Client | null = null;

  async function getClient(): Promise<Client> {
    if (client) return client;
    client = new Client({
      host: credentials.host,
      port: credentials.port,
      database: credentials.database,
      user: credentials.user,
      password: credentials.password,
      ssl: credentials.ssl ? { rejectUnauthorized: true } : undefined,
      connectionTimeoutMillis: 15_000,
      statement_timeout: 60_000,
    });
    await client.connect();
    return client;
  }

  return {
    engine: "postgresql",

    async testConnection(): Promise<TestConnectionResult> {
      try {
        const c = await getClient();
        await c.query("SELECT 1 AS ok");
        return { ok: true, message: "PostgreSQL connection succeeded" };
      } catch (err) {
        return {
          ok: false,
          message: sanitizeConnectorError(err),
        };
      }
    },

    async listTables(schema?: string): Promise<DiscoveredTable[]> {
      const c = await getClient();
      const schemaFilter = schema?.trim() || credentials.schema?.trim() || "public";
      const tablesRes = await c.query<{ table_schema: string; table_name: string }>(
        `SELECT table_schema, table_name
         FROM information_schema.tables
         WHERE table_type = 'BASE TABLE'
           AND table_schema = $1
         ORDER BY table_name
         LIMIT 200`,
        [schemaFilter],
      );

      const tables: DiscoveredTable[] = [];
      for (const t of tablesRes.rows) {
        const colsRes = await c.query<{
          column_name: string;
          data_type: string;
          is_nullable: string;
        }>(
          `SELECT column_name, data_type, is_nullable
           FROM information_schema.columns
           WHERE table_schema = $1 AND table_name = $2
           ORDER BY ordinal_position`,
          [t.table_schema, t.table_name],
        );
        tables.push({
          schema: t.table_schema,
          name: t.table_name,
          columns: colsRes.rows.map((col) => ({
            name: col.column_name,
            dataType: col.data_type,
            nullable: col.is_nullable === "YES",
          })),
        });
      }
      return tables;
    },

    async queryRows(options: QueryRowsOptions): Promise<QueryRowsResult> {
      const c = await getClient();
      const schema = options.schema?.trim() || credentials.schema?.trim() || "public";
      const cols =
        options.columns.length > 0 ? options.columns.map(quoteIdent).join(", ") : "*";
      const from = `${quoteIdent(schema)}.${quoteIdent(options.table)}`;
      const params: unknown[] = [];
      let where = "";

      if (options.incrementalColumn && options.lastIncrementalValue) {
        params.push(options.lastIncrementalValue);
        where = ` WHERE ${quoteIdent(options.incrementalColumn)} > $1`;
      }

      const order = options.incrementalColumn
        ? ` ORDER BY ${quoteIdent(options.incrementalColumn)} ASC`
        : "";
      const limit = Math.min(Math.max(options.limit ?? 5000, 1), 20_000);
      params.push(limit);
      const limitParam = `$${params.length}`;

      const sql = `SELECT ${cols} FROM ${from}${where}${order} LIMIT ${limitParam}`;
      const res = await c.query(sql, params);

      let maxIncrementalValue: string | undefined;
      if (options.incrementalColumn) {
        for (const row of res.rows) {
          const v = row[options.incrementalColumn];
          if (v == null) continue;
          const s = v instanceof Date ? v.toISOString() : String(v);
          if (!maxIncrementalValue || s > maxIncrementalValue) {
            maxIncrementalValue = s;
          }
        }
      }

      return {
        rows: res.rows as Record<string, unknown>[],
        maxIncrementalValue,
      };
    },

    async close(): Promise<void> {
      if (client) {
        const c = client;
        client = null;
        await c.end().catch(() => undefined);
      }
    },
  };
}
