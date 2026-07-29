import { NextResponse } from "next/server";
import { getPayload } from "payload";

import { getCurrentContext } from "@/lib/auth";
import { requirePermission } from "@/lib/policy/protect";
import { DataWarehouseService } from "@/lib/integrations/datawarehouse";
import type {
  DataWarehouseProvider,
  SnowflakeConfig,
  BigQueryConfig,
  DatabricksConfig,
  DataWarehouseExportConfig,
} from "@/lib/integrations/types";
import config from "@/payload.config";

export async function POST(request: Request) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.activeOrg) {
      return NextResponse.json({ error: "No active organisation" }, { status: 403 });
    }

    const allowed = await requirePermission(
      ctx.user.id,
      ctx.activeOrg.id,
      "edit",
      "organisation",
      ctx.activeOrg.id,
      "organisation",
    );
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const organisationId = ctx.activeOrg.id;
    const {
      action,
      connectionId,
      exportConfig,
      provider,
      config: dwConfig,
    } = (await request.json()) as {
      action: string;
      connectionId: string;
      exportConfig?: DataWarehouseExportConfig;
      provider?: DataWarehouseProvider;
      config?: SnowflakeConfig | BigQueryConfig | DatabricksConfig;
    };

    const payload = await getPayload({ config });
    const dwService = new DataWarehouseService(payload);

    if (action === "export") {
      if (!exportConfig) {
        return NextResponse.json({ error: "Export config required" }, { status: 400 });
      }
      const result = await dwService.exportToDataWarehouse(
        connectionId,
        organisationId,
        exportConfig,
      );
      return NextResponse.json(result);
    }

    if (action === "test-connection") {
      if (!provider || !dwConfig) {
        return NextResponse.json(
          { error: "Provider and config required" },
          { status: 400 },
        );
      }

      const connector = dwService.createConnector(provider, dwConfig);
      const connected = await connector.testConnection();
      return NextResponse.json({ connected });
    }

    if (action === "export-datasets") {
      if (!provider || !dwConfig) {
        return NextResponse.json(
          { error: "Provider and config required" },
          { status: 400 },
        );
      }

      const connector = dwService.createConnector(provider, dwConfig);
      const data = await connector.exportDatasets(["datapoints", "emissions"]);
      return NextResponse.json({ records: data.length, data });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Data warehouse integration error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Integration failed" },
      { status: 500 },
    );
  }
}
