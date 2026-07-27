import { getPayload } from "payload";

import { limits, normalizePlan, type PlanId } from "@/lib/billing";
import config from "@/payload.config";

export type UsageMeters = {
  plan: PlanId;
  periods: { used: number; max: number | null };
  suppliers: { used: number; max: number | null };
  clients: { used: number; max: number | null };
  watermarkedPdf: boolean;
  evidenceVault: boolean;
  whiteLabel: boolean;
};

function cap(n: number): number | null {
  return Number.isFinite(n) ? n : null;
}

export async function getUsageMeters(
  organisationId: string,
  plan: string | null | undefined,
): Promise<UsageMeters> {
  const payload = await getPayload({ config });
  const id = normalizePlan(plan);
  const lim = limits(id);

  const [periods, suppliers, clients] = await Promise.all([
    payload.find({
      collection: "reporting-periods",
      where: { organisation: { equals: organisationId } },
      limit: 1,
      overrideAccess: true,
    }),
    payload.find({
      collection: "suppliers",
      where: { organisation: { equals: organisationId } },
      limit: 1,
      overrideAccess: true,
    }),
    payload.find({
      collection: "organisations",
      where: { parentOrg: { equals: organisationId } },
      limit: 1,
      overrideAccess: true,
    }),
  ]);

  return {
    plan: id,
    periods: { used: periods.totalDocs, max: cap(lim.maxPeriods) },
    suppliers: { used: suppliers.totalDocs, max: cap(lim.maxSuppliers) },
    clients: { used: clients.totalDocs, max: cap(lim.maxClients) },
    watermarkedPdf: id === "free",
    evidenceVault: id !== "free",
    whiteLabel: id === "consultant",
  };
}
