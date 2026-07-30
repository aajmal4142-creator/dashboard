import { createBigQueryConnector } from "./bigquery";
import { createMysqlConnector } from "./mysql";
import { createPostgresConnector } from "./postgres";
import type {
  BigQueryCredentials,
  ConnectorCredentials,
  DatabaseConnector,
  DatabaseEngine,
  SqlCredentials,
} from "../types";

export function createConnector(
  engine: DatabaseEngine,
  credentials: ConnectorCredentials,
): DatabaseConnector {
  switch (engine) {
    case "postgresql":
      return createPostgresConnector(credentials as SqlCredentials);
    case "mysql":
      return createMysqlConnector(credentials as SqlCredentials);
    case "bigquery":
      return createBigQueryConnector(credentials as BigQueryCredentials);
    default: {
      const _exhaustive: never = engine;
      throw new Error(`Unsupported database engine: ${String(_exhaustive)}`);
    }
  }
}

export { createPostgresConnector } from "./postgres";
export { createMysqlConnector } from "./mysql";
export { createBigQueryConnector } from "./bigquery";
