import type { Payload } from "payload";
import type { SAPGLPosting, SAPBOM, SAPProductionData, SyncResult } from "./types";
import { OAuthBase, type OAuthConfig } from "./oauth.base";

const SAP_AUTH_URL = "https://oauth.sapfioritrial.com/oauth/authorize";
const SAP_TOKEN_URL = "https://oauth.sapfioritrial.com/oauth/token";
const SAP_API_URL = "https://sandbox.api.sap.com/s4hanacloud";

export class SAPService extends OAuthBase {
  constructor(
    payload: Payload,
    clientId: string,
    clientSecret: string,
    redirectUri: string,
  ) {
    const config: OAuthConfig = {
      authUrl: SAP_AUTH_URL,
      tokenUrl: SAP_TOKEN_URL,
      clientId,
      clientSecret,
      redirectUri,
      scope: "s4hanacloud",
    };
    super(payload, config, "sap-connections");
  }

  async postGLTransaction(
    accessToken: string,
    posting: SAPGLPosting,
  ): Promise<{ documentNumber: string }> {
    const response = await fetch(`${SAP_API_URL}/api_generalledger/post`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(posting),
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw this.createOAuthError(
          {
            type: "token_revoked",
            message: "Token revoked or permission denied",
            retryable: false,
          },
          response.status,
        );
      }
      throw new Error(`Failed to post GL transaction: ${response.statusText}`);
    }

    const data = (await response.json()) as { documentNumber: string };
    return data;
  }

  /**
   * Fetch Bill of Materials
   */
  async fetchBOM(accessToken: string, materialId: string): Promise<SAPBOM> {
    const response = await fetch(`${SAP_API_URL}/api_materialmaster/bom/${materialId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch BOM: ${response.statusText}`);
    }

    const data = (await response.json()) as {
      material: string;
      materialDescription: string;
      bomVersion: string;
      bomItems: Array<{
        component: string;
        quantity: number;
        unitOfMeasure: string;
      }>;
    };

    return {
      materialId: data.material,
      materialDescription: data.materialDescription,
      bomVersion: data.bomVersion,
      components: data.bomItems.map((item) => ({
        componentId: item.component,
        quantity: item.quantity,
        unit: item.unitOfMeasure,
      })),
    };
  }

  /**
   * Fetch production orders
   */
  async fetchProductionOrders(
    accessToken: string,
    materialId?: string,
  ): Promise<SAPProductionData[]> {
    let url = `${SAP_API_URL}/api_production/orders`;
    if (materialId) {
      url += `?materialId=${materialId}`;
    }

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch production orders: ${response.statusText}`);
    }

    const data = (await response.json()) as {
      orders: Array<{
        orderID: string;
        material: string;
        plannedQuantity: number;
        orderUnit: string;
        duration: number;
        startDate: string;
        completionDate: string;
        status: string;
      }>;
    };

    return data.orders.map((order) => ({
      orderId: order.orderID,
      materialId: order.material,
      quantity: order.plannedQuantity,
      unit: order.orderUnit,
      duration: order.duration,
      startDate: order.startDate,
      completionDate: order.completionDate,
      status: order.status as SAPProductionData["status"],
    }));
  }

  /**
   * Sync SAP data with ClearESG
   */
  async syncData(
    connectionId: string,
    organisationId: string,
    periodId: string,
  ): Promise<SyncResult> {
    const startTime = Date.now();
    const errors: Array<{ message: string; recordId?: string }> = [];
    let processed = 0;

    try {
      const connection = await this.payload.findByID({
        collection: "sap-connections",
        id: connectionId,
      });

      if (!connection?.accessToken) {
        throw new Error("SAP connection not properly configured");
      }

      let accessToken = connection.accessToken as string;

      if (connection.expiresAt && new Date(connection.expiresAt) < new Date()) {
        if (!connection.refreshToken) {
          throw new Error("Token expired and no refresh token available");
        }
        const tokens = await this.refreshAccessToken(connection.refreshToken as string);
        accessToken = tokens.accessToken;
        await this.payload.update({
          collection: "sap-connections",
          id: connectionId,
          data: {
            accessToken: tokens.accessToken,
            expiresAt: tokens.expiresAt,
          },
          overrideAccess: true,
        });
      }

      const syncConfig = connection.syncConfig;
      const trackingMaterials = (syncConfig?.trackingMaterials || [])
        .map((m) => m?.materialId)
        .filter((id): id is string => Boolean(id));

      // Sync GL data
      if (syncConfig?.enableGlSync) {
        try {
          // Placeholder for GL data sync
          // In production, this would fetch GL balances and post to ClearESG
          processed += 1;
        } catch (err) {
          errors.push({
            message: `GL sync failed: ${String(err)}`,
          });
        }
      }

      // Sync BOM data
      if (syncConfig?.enableBomSync && trackingMaterials.length > 0) {
        try {
          for (const materialId of trackingMaterials) {
            const bom = await this.fetchBOM(accessToken, materialId);
            processed += 1;

            // Create datapoint for BOM tracking
            await this.payload.create({
              collection: "datapoints",
              data: {
                organisation: organisationId,
                period: periodId,
                metricKey: `production.bom.${materialId}`,
                value: bom.components.length,
                unit: "components",
                quality: "measured",
                provenance: "manual",
                source: "api",
                approvalState: "approved",
                note: `BOM for material ${materialId}: ${bom.materialDescription}`,
              },
              overrideAccess: true,
            });
          }
        } catch (err) {
          errors.push({
            message: `BOM sync failed: ${String(err)}`,
          });
        }
      }

      // Sync production data
      if (syncConfig?.enableProductionSync) {
        try {
          const orders = await this.fetchProductionOrders(accessToken);
          processed += orders.length;

          for (const order of orders) {
            // Calculate emissions from production
            const emissionFactor = 0.15; // kg CO2e per unit produced
            const emissions = order.quantity * emissionFactor;

            await this.payload.create({
              collection: "datapoints",
              data: {
                organisation: organisationId,
                period: periodId,
                metricKey: `emissions.production.${order.orderId}`,
                value: emissions,
                unit: "kgCO2e",
                quality: "estimated",
                provenance: "manual",
                source: "api",
                approvalState: "pending",
                note: `Production emissions from order ${order.orderId}: ${order.quantity} units produced`,
              },
              overrideAccess: true,
            });
          }
        } catch (err) {
          errors.push({
            message: `Production sync failed: ${String(err)}`,
          });
        }
      }

      await this.payload.update({
        collection: "sap-connections",
        id: connectionId,
        data: {
          lastSyncAt: new Date().toISOString(),
          lastSyncStatus: errors.length === 0 ? "success" : "partial",
          syncErrorCount: errors.length,
        },
        overrideAccess: true,
      });

      return {
        status: errors.length === 0 ? "success" : "partial",
        recordsProcessed: processed,
        recordsFailed: errors.length,
        errors,
        details: {
          recordsProcessed: processed,
          glSynced: syncConfig?.enableGlSync ? true : false,
          bomSynced: syncConfig?.enableBomSync ? true : false,
          productionSynced: syncConfig?.enableProductionSync ? true : false,
        },
        syncDurationMs: Date.now() - startTime,
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      errors.push({ message: errorMsg });
      return {
        status: "failed",
        recordsProcessed: processed,
        recordsFailed: 1,
        errors,
        details: {},
        syncDurationMs: Date.now() - startTime,
      };
    }
  }
}
