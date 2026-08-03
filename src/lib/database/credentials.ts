import type {
  BigQueryCredentials,
  ConnectorCredentials,
  DatabaseEngine,
  SnowflakeCredentials,
  SqlCredentials,
} from "./types";

export type PublicConnectionCredentials =
  | {
      engine: "postgresql" | "mysql";
      host: string;
      port: number;
      database: string;
      user: string;
      ssl: boolean;
      schema?: string;
    }
  | {
      engine: "bigquery";
      projectId: string;
      datasetId: string;
    }
  | {
      engine: "snowflake";
      account: string;
      warehouse: string;
      database: string;
      schema: string;
      user: string;
      role?: string;
    };

export function parseCredentialsInput(
  engine: DatabaseEngine,
  body: Record<string, unknown>,
): ConnectorCredentials {
  if (engine === "bigquery") {
    const projectId = typeof body.projectId === "string" ? body.projectId.trim() : "";
    const datasetId = typeof body.datasetId === "string" ? body.datasetId.trim() : "";
    const serviceAccountJson =
      typeof body.serviceAccountJson === "string" ? body.serviceAccountJson.trim() : "";
    if (!projectId) throw new Error("projectId is required for BigQuery");
    if (!datasetId) throw new Error("datasetId is required for BigQuery");
    if (!serviceAccountJson) {
      throw new Error("serviceAccountJson is required for BigQuery");
    }
    try {
      JSON.parse(serviceAccountJson);
    } catch {
      throw new Error(
        "serviceAccountJson must be valid JSON (full service account key file)",
      );
    }
    return {
      projectId,
      datasetId,
      serviceAccountJson,
    };
  }

  if (engine === "snowflake") {
    const account = typeof body.account === "string" ? body.account.trim() : "";
    const warehouse = typeof body.warehouse === "string" ? body.warehouse.trim() : "";
    const database = typeof body.database === "string" ? body.database.trim() : "";
    const schema =
      typeof body.schema === "string" && body.schema.trim()
        ? body.schema.trim()
        : "PUBLIC";
    const user = typeof body.user === "string" ? body.user.trim() : "";
    const passwordOrToken =
      typeof body.passwordOrToken === "string"
        ? body.passwordOrToken
        : typeof body.password === "string"
          ? body.password
          : "";
    const role =
      typeof body.role === "string" && body.role.trim() ? body.role.trim() : undefined;
    if (!account) throw new Error("account is required for Snowflake");
    if (!warehouse) throw new Error("warehouse is required for Snowflake");
    if (!database) throw new Error("database is required for Snowflake");
    if (!user) throw new Error("user is required for Snowflake");
    if (!passwordOrToken) {
      throw new Error("passwordOrToken is required for Snowflake");
    }
    return {
      account,
      warehouse,
      database,
      schema,
      user,
      passwordOrToken,
      role,
    };
  }

  const host = typeof body.host === "string" ? body.host.trim() : "";
  const database = typeof body.database === "string" ? body.database.trim() : "";
  const user = typeof body.user === "string" ? body.user.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const portRaw = body.port;
  const port =
    typeof portRaw === "number"
      ? portRaw
      : typeof portRaw === "string"
        ? Number(portRaw)
        : engine === "mysql"
          ? 3306
          : 5432;
  const ssl =
    typeof body.ssl === "boolean" ? body.ssl : body.ssl === "false" ? false : true;
  const schema =
    typeof body.schema === "string" && body.schema.trim()
      ? body.schema.trim()
      : undefined;

  if (!host) throw new Error("host is required");
  if (!database) throw new Error("database is required");
  if (!user) throw new Error("user is required");
  if (!password) throw new Error("password is required");
  if (!Number.isFinite(port) || port < 1 || port > 65535) {
    throw new Error("port must be a number between 1 and 65535");
  }

  return {
    host,
    port,
    database,
    user,
    password,
    ssl,
    schema,
  };
}

export function credentialsDisplay(
  engine: DatabaseEngine,
  credentials: ConnectorCredentials,
): { displayHost: string; displayDatabase: string; sslEnabled: boolean } {
  if (engine === "bigquery") {
    const c = credentials as BigQueryCredentials;
    return {
      displayHost: c.projectId,
      displayDatabase: c.datasetId,
      sslEnabled: true,
    };
  }
  if (engine === "snowflake") {
    const c = credentials as SnowflakeCredentials;
    return {
      displayHost: c.account,
      displayDatabase: `${c.database}.${c.schema}`,
      sslEnabled: true,
    };
  }
  const c = credentials as SqlCredentials;
  return {
    displayHost: c.host,
    displayDatabase: c.database,
    sslEnabled: c.ssl,
  };
}

export function publicCredentialsShape(
  engine: DatabaseEngine,
  credentials: ConnectorCredentials,
): PublicConnectionCredentials {
  if (engine === "bigquery") {
    const c = credentials as BigQueryCredentials;
    return {
      engine: "bigquery",
      projectId: c.projectId,
      datasetId: c.datasetId,
    };
  }
  if (engine === "snowflake") {
    const c = credentials as SnowflakeCredentials;
    return {
      engine: "snowflake",
      account: c.account,
      warehouse: c.warehouse,
      database: c.database,
      schema: c.schema,
      user: c.user,
      role: c.role,
    };
  }
  const c = credentials as SqlCredentials;
  return {
    engine,
    host: c.host,
    port: c.port,
    database: c.database,
    user: c.user,
    ssl: c.ssl,
    schema: c.schema,
  };
}
