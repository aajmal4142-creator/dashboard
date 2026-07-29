import { getPayload } from "payload";
import config from "@/payload.config";
import { getOAuthManager, getOrRefreshToken } from "./oauth";
import { mapEcoVadisScoreToRisk } from "./scoreMapper";

export interface SyncResult {
  success: boolean;
  organisationId: string;
  suppliersProcessed: number;
  suppliersUpdated: number;
  suppliersWithErrors: number;
  errors: string[];
  startedAt: Date;
  completedAt: Date;
}

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function syncEcoVadisSuppliers(organisationId: string): Promise<SyncResult> {
  const startedAt = new Date();
  const result: SyncResult = {
    success: true,
    organisationId,
    suppliersProcessed: 0,
    suppliersUpdated: 0,
    suppliersWithErrors: 0,
    errors: [],
    startedAt,
    completedAt: new Date(),
  };

  try {
    const payload = await getPayload({ config });

    // Get OAuth token
    const token = await getOrRefreshToken(organisationId);
    const manager = await getOAuthManager();

    // Fetch all suppliers with pagination
    let page = 0;
    let allSuppliers: { id: string; businessName: string }[] = [];
    const BATCH_SIZE = 100;

    while (true) {
      const res = await manager.fetchSuppliers(
        token.accessToken,
        page * BATCH_SIZE,
        BATCH_SIZE,
      );

      if (res.suppliers.length === 0) break;

      allSuppliers = allSuppliers.concat(res.suppliers);

      if (page * BATCH_SIZE + res.suppliers.length >= res.total) break;
      page += 1;
    }

    // Find suppliers in DB that match by name
    const dbSuppliers = await payload.find({
      collection: "suppliers",
      where: { organisation: { equals: organisationId } },
      limit: 1000,
      overrideAccess: true,
    });

    const supplierMap = new Map(dbSuppliers.docs.map((s) => [s.name, s]));

    // Sync each supplier
    for (const ecoVadisSupplier of allSuppliers) {
      result.suppliersProcessed += 1;

      const dbSupplier = supplierMap.get(ecoVadisSupplier.businessName);
      if (!dbSupplier) {
        result.errors.push(`Supplier not found in DB: ${ecoVadisSupplier.businessName}`);
        result.suppliersWithErrors += 1;
        continue;
      }

      let retries = 0;
      let scoreData = null;

      // Retry logic for fetching scores
      while (retries < MAX_RETRIES) {
        try {
          scoreData = await manager.fetchSupplierScores(
            token.accessToken,
            ecoVadisSupplier.id,
          );
          break;
        } catch (error) {
          retries += 1;
          if (retries >= MAX_RETRIES) {
            result.errors.push(
              `Failed to fetch scores for ${ecoVadisSupplier.businessName}: ${error}`,
            );
            result.suppliersWithErrors += 1;
            break;
          }
          await sleep(RETRY_DELAY_MS);
        }
      }

      if (!scoreData) continue;

      const riskData = mapEcoVadisScoreToRisk(scoreData.score);
      const assessmentDate = new Date(scoreData.assessmentDate).toISOString();
      const calculatedAt = new Date().toISOString();

      // Update supplier with EcoVadis data
      await payload.update({
        collection: "suppliers",
        id: dbSupplier.id,
        data: {
          ecovadis: {
            score: scoreData.score,
            assessmentDate,
            categories: scoreData.categories,
            lastAssessed: assessmentDate,
            trend: scoreData.trend,
            ecoVadisUrl: `https://www.ecovadiscsrassessments.com/participant/${ecoVadisSupplier.id}`,
          },
          riskMetrics: {
            score: riskData.score,
            tier: riskData.tier,
            flags: riskData.flags,
            calculatedAt,
          },
        },
        overrideAccess: true,
      });

      result.suppliersUpdated += 1;
    }

    // Update connection status
    const connection = await payload.find({
      collection: "ecovadis-connections",
      where: { organisation: { equals: organisationId } },
      limit: 1,
      overrideAccess: true,
    });

    if (connection.docs[0]) {
      await payload.update({
        collection: "ecovadis-connections",
        id: connection.docs[0].id,
        data: {
          lastSyncAt: new Date().toISOString(),
          lastSyncStatus: result.errors.length === 0 ? "success" : "failed",
          errorMessage: result.errors.length > 0 ? result.errors.join("; ") : null,
          syncCount: (connection.docs[0].syncCount || 0) + 1,
          totalSuppliersSynced: result.suppliersUpdated,
        },
        overrideAccess: true,
      });
    }
  } catch (error) {
    result.success = false;
    result.errors.push(String(error));
  }

  result.completedAt = new Date();
  return result;
}
