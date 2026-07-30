import { BigQuery } from "@google-cloud/bigquery";

import { sanitizeConnectorError } from "../encrypt";
import type {
  BigQueryCredentials,
  DatabaseConnector,
  DiscoveredTable,
  QueryRowsOptions,
  QueryRowsResult,
  TestConnectionResult,
} from "../types";

function quoteIdent(ident: string): string {
  return `\`${ident.replace(/`/g, "")}\``;
}

function parseServiceAccount(json: string): {
  client_email: string;
  private_key: string;
  project_id?: string;
} {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error(
      "BigQuery service account JSON is invalid. Paste the full key file contents.",
    );
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error("BigQuery service account JSON must be an object");
  }
  const obj = parsed as Record<string, unknown>;
  const clientEmail = obj.client_email;
  const privateKey = obj.private_key;
  if (typeof clientEmail !== "string" || typeof privateKey !== "string") {
    throw new Error(
      "BigQuery service account JSON must include client_email and private_key",
    );
  }
  return {
    client_email: clientEmail,
    private_key: privateKey,
    project_id: typeof obj.project_id === "string" ? obj.project_id : undefined,
  };
}

export function createBigQueryConnector(
  credentials: BigQueryCredentials,
): DatabaseConnector {
  let client: BigQuery | null = null;

  function getClient(): BigQuery {
    if (client) return client;
    const sa = parseServiceAccount(credentials.serviceAccountJson);
    client = new BigQuery({
      projectId: credentials.projectId || sa.project_id,
      credentials: {
        client_email: sa.client_email,
        private_key: sa.private_key,
      },
    });
    return client;
  }

  return {
    engine: "bigquery",

    async testConnection(): Promise<TestConnectionResult> {
      try {
        const bq = getClient();
        const dataset = bq.dataset(credentials.datasetId);
        const [exists] = await dataset.exists();
        if (!exists) {
          return {
            ok: false,
            message: `Dataset "${credentials.datasetId}" was not found in project "${credentials.projectId}"`,
          };
        }
        await bq.query({ query: "SELECT 1 AS ok", location: undefined });
        return { ok: true, message: "BigQuery connection succeeded" };
      } catch (err) {
        return { ok: false, message: sanitizeConnectorError(err) };
      }
    },

    async listTables(_schema?: string): Promise<DiscoveredTable[]> {
      const bq = getClient();
      const dataset = bq.dataset(credentials.datasetId);
      const [tables] = await dataset.getTables();
      const discovered: DiscoveredTable[] = [];

      for (const table of tables.slice(0, 200)) {
        const meta = table.metadata;
        const rawFields: Array<{ name?: string; type?: string; mode?: string }> =
          (meta?.schema?.fields as
            Array<{ name?: string; type?: string; mode?: string }> | undefined) ?? [];
        const fields = rawFields.map((f) => ({
          name: String(f.name ?? ""),
          dataType: String(f.type ?? "STRING"),
          nullable: f.mode !== "REQUIRED",
        }));
        discovered.push({
          schema: credentials.datasetId,
          name: String(table.id ?? meta?.tableReference?.tableId ?? "unknown"),
          columns: fields.filter((c) => c.name.length > 0),
        });
      }
      return discovered;
    },

    async queryRows(options: QueryRowsOptions): Promise<QueryRowsResult> {
      const bq = getClient();
      const dataset = options.schema?.trim() || credentials.datasetId;
      const cols =
        options.columns.length > 0 ? options.columns.map(quoteIdent).join(", ") : "*";
      const from = `${quoteIdent(credentials.projectId)}.${quoteIdent(dataset)}.${quoteIdent(options.table)}`;
      const params: Record<string, unknown> = {};
      let where = "";

      if (options.incrementalColumn && options.lastIncrementalValue) {
        where = ` WHERE ${quoteIdent(options.incrementalColumn)} > @lastValue`;
        params.lastValue = options.lastIncrementalValue;
      }

      const order = options.incrementalColumn
        ? ` ORDER BY ${quoteIdent(options.incrementalColumn)} ASC`
        : "";
      const limit = Math.min(Math.max(options.limit ?? 5000, 1), 20_000);

      const sql = `SELECT ${cols} FROM ${from}${where}${order} LIMIT ${limit}`;
      const [job] = await bq.createQueryJob({
        query: sql,
        params,
        useLegacySql: false,
      });
      const [rows] = await job.getQueryResults();

      let maxIncrementalValue: string | undefined;
      if (options.incrementalColumn) {
        for (const row of rows) {
          const v = (row as Record<string, unknown>)[options.incrementalColumn];
          if (v == null) continue;
          const s =
            typeof v === "object" && v !== null && "value" in v
              ? String((v as { value: unknown }).value)
              : v instanceof Date
                ? v.toISOString()
                : String(v);
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
      client = null;
    },
  };
}
