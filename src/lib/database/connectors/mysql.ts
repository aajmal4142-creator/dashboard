import mysql from "mysql2/promise";

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
  return `\`${ident.replace(/`/g, "``")}\``;
}

export function createMysqlConnector(credentials: SqlCredentials): DatabaseConnector {
  let pool: mysql.Pool | null = null;

  function getPool(): mysql.Pool {
    if (pool) return pool;
    pool = mysql.createPool({
      host: credentials.host,
      port: credentials.port,
      database: credentials.database,
      user: credentials.user,
      password: credentials.password,
      ssl: credentials.ssl ? {} : undefined,
      connectionLimit: 2,
      connectTimeout: 15_000,
    });
    return pool;
  }

  return {
    engine: "mysql",

    async testConnection(): Promise<TestConnectionResult> {
      try {
        const p = getPool();
        const [rows] = await p.query("SELECT 1 AS ok");
        void rows;
        return { ok: true, message: "MySQL connection succeeded" };
      } catch (err) {
        return { ok: false, message: sanitizeConnectorError(err) };
      }
    },

    async listTables(schema?: string): Promise<DiscoveredTable[]> {
      const p = getPool();
      const schemaFilter =
        schema?.trim() || credentials.schema?.trim() || credentials.database;
      const [tableRows] = await p.query<mysql.RowDataPacket[]>(
        `SELECT TABLE_SCHEMA AS table_schema, TABLE_NAME AS table_name
         FROM information_schema.TABLES
         WHERE TABLE_TYPE = 'BASE TABLE'
           AND TABLE_SCHEMA = ?
         ORDER BY TABLE_NAME
         LIMIT 200`,
        [schemaFilter],
      );

      const tables: DiscoveredTable[] = [];
      for (const t of tableRows) {
        const tableSchema = String(t.table_schema);
        const tableName = String(t.table_name);
        const [colRows] = await p.query<mysql.RowDataPacket[]>(
          `SELECT COLUMN_NAME AS column_name, DATA_TYPE AS data_type, IS_NULLABLE AS is_nullable
           FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
           ORDER BY ORDINAL_POSITION`,
          [tableSchema, tableName],
        );
        tables.push({
          schema: tableSchema,
          name: tableName,
          columns: colRows.map((col) => ({
            name: String(col.column_name),
            dataType: String(col.data_type),
            nullable: String(col.is_nullable) === "YES",
          })),
        });
      }
      return tables;
    },

    async queryRows(options: QueryRowsOptions): Promise<QueryRowsResult> {
      const p = getPool();
      const schema =
        options.schema?.trim() || credentials.schema?.trim() || credentials.database;
      const cols =
        options.columns.length > 0 ? options.columns.map(quoteIdent).join(", ") : "*";
      const from = `${quoteIdent(schema)}.${quoteIdent(options.table)}`;
      const params: unknown[] = [];
      let where = "";

      if (options.incrementalColumn && options.lastIncrementalValue) {
        where = ` WHERE ${quoteIdent(options.incrementalColumn)} > ?`;
        params.push(options.lastIncrementalValue);
      }

      const order = options.incrementalColumn
        ? ` ORDER BY ${quoteIdent(options.incrementalColumn)} ASC`
        : "";
      const limit = Math.min(Math.max(options.limit ?? 5000, 1), 20_000);
      params.push(limit);

      const sql = `SELECT ${cols} FROM ${from}${where}${order} LIMIT ?`;
      const [rows] = await p.query<mysql.RowDataPacket[]>(sql, params);

      let maxIncrementalValue: string | undefined;
      if (options.incrementalColumn) {
        for (const row of rows) {
          const v = row[options.incrementalColumn];
          if (v == null) continue;
          const s = v instanceof Date ? v.toISOString() : String(v);
          if (!maxIncrementalValue || s > maxIncrementalValue) {
            maxIncrementalValue = s;
          }
        }
      }

      return {
        rows: rows as Record<string, unknown>[],
        maxIncrementalValue,
      };
    },

    async close(): Promise<void> {
      if (pool) {
        const p = pool;
        pool = null;
        await p.end().catch(() => undefined);
      }
    },
  };
}
