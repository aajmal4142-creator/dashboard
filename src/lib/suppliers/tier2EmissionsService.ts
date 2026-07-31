/**
 * Tier 2/3 emissions I/O — load suppliers/network, run pure cascade, persist results.
 */

import type { Payload } from "payload";

import { SUPPLY_CHAIN_NETWORKS_SLUG } from "@/collections/SupplyChainNetworks";
import {
  SUPPLIER_REPORTED_METRIC,
  SUPPLIER_SPEND_ESTIMATE_METRIC,
} from "@/lib/suppliers/fields";
import {
  calculateTier1Cascade,
  composeCategory1Breakdown,
  MissingNaceError,
  type Category1Breakdown,
  type EstimationMethod,
  type Tier1CascadeResult,
  type TierNodeInput,
  type SupplyTier,
} from "@/lib/suppliers/tier2Emissions";
import { sendTransactionalEmail } from "@/lib/email/send";

function relationId(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "id" in value) {
    return String((value as { id: string }).id);
  }
  return null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return null;
}

function asTier(value: unknown): SupplyTier {
  const n = typeof value === "number" ? value : Number(value);
  if (n === 2) return 2;
  if (n === 3) return 3;
  return 1;
}

type SupplierDoc = {
  id: string;
  name: string;
  contactEmail?: string | null;
  emailConsent?: boolean | null;
  organisation?: unknown;
  tier?: number | null;
  annualSpend?: number | null;
  directSpend?: number | null;
  naceCode?: string | null;
  industryIntensityOverride?: number | null;
  totalRevenue?: number | null;
  estimatedEmissions?: number | null;
  estimationMethod?: string | null;
  estimationConfidence?: string | null;
  parentSupplier?: unknown;
  submittedData?: unknown;
};

async function loadReportedEmissions(
  payload: Payload,
  organisationId: string,
  supplierId: string,
): Promise<number | null> {
  const dps = await payload.find({
    collection: "datapoints",
    where: {
      and: [
        { organisation: { equals: organisationId } },
        {
          or: [
            { supplier: { equals: supplierId } },
            { supplierKey: { equals: supplierId } },
          ],
        },
        {
          metricKey: {
            in: [SUPPLIER_REPORTED_METRIC, SUPPLIER_SPEND_ESTIMATE_METRIC],
          },
        },
      ],
    },
    limit: 20,
    sort: "-updatedAt",
    overrideAccess: true,
  });

  let reported: number | null = null;
  let estimate: number | null = null;
  for (const dp of dps.docs) {
    const v = asNumber(dp.value);
    if (v == null || !(v >= 0)) continue;
    if (dp.metricKey === SUPPLIER_REPORTED_METRIC && reported == null) reported = v;
    if (dp.metricKey === SUPPLIER_SPEND_ESTIMATE_METRIC && estimate == null) estimate = v;
  }
  return reported ?? estimate;
}

function submittedTco2e(doc: SupplierDoc): number | null {
  const data = doc.submittedData;
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const raw = (data as Record<string, unknown>).estimated_tco2e;
  return asNumber(raw);
}

export function supplierDocToNode(
  doc: SupplierDoc,
  opts: {
    tier: SupplyTier;
    parentId: string | null;
    actualEmissions: number | null;
  },
): TierNodeInput {
  const spend = asNumber(doc.directSpend) ?? asNumber(doc.annualSpend) ?? 0;
  return {
    id: String(doc.id),
    name: doc.name ?? "Supplier",
    tier: opts.tier,
    spend: spend > 0 ? spend : 0,
    actualEmissions: opts.actualEmissions,
    naceCode:
      typeof doc.naceCode === "string" && doc.naceCode.trim()
        ? doc.naceCode.trim()
        : null,
    intensityOverride: asNumber(doc.industryIntensityOverride),
    totalRevenue: asNumber(doc.totalRevenue),
    parentId: opts.parentId,
  };
}

async function loadSupplierDoc(
  payload: Payload,
  organisationId: string,
  supplierId: string,
): Promise<SupplierDoc> {
  const doc = await payload.findByID({
    collection: "suppliers",
    id: supplierId,
    depth: 0,
    overrideAccess: true,
  });
  const orgId = relationId(doc.organisation);
  if (orgId !== organisationId) {
    throw new Error("Supplier not found");
  }
  return doc as SupplierDoc;
}

async function listChildSuppliers(
  payload: Payload,
  organisationId: string,
  parentId: string,
  tier: SupplyTier,
): Promise<SupplierDoc[]> {
  const result = await payload.find({
    collection: "suppliers",
    where: {
      and: [
        { organisation: { equals: organisationId } },
        { parentSupplier: { equals: parentId } },
        { tier: { equals: tier } },
      ],
    },
    limit: 200,
    overrideAccess: true,
  });
  return result.docs as SupplierDoc[];
}

/** Also pull Tier 2/3 from supply-chain network edges linked to this Tier 1. */
async function networkChildrenForParent(
  payload: Payload,
  organisationId: string,
  parentSupplierId: string,
): Promise<
  Array<{
    tier: SupplyTier;
    supplierId: string | null;
    spend: number;
    emissions: number;
    name: string;
    edgeId: string;
  }>
> {
  const edges = await payload.find({
    collection: SUPPLY_CHAIN_NETWORKS_SLUG,
    where: {
      and: [
        { organisation: { equals: organisationId } },
        { parent_supplier_id: { equals: parentSupplierId } },
        { tier_level: { in: [2, 3] } },
      ],
    },
    limit: 500,
    overrideAccess: true,
  });

  return edges.docs.map((doc) => ({
    edgeId: String(doc.id),
    tier: asTier(doc.tier_level),
    supplierId: relationId(doc.supplier_id),
    spend: asNumber(doc.spend) ?? 0,
    emissions: asNumber(doc.emissions) ?? 0,
    name: typeof doc.name === "string" ? doc.name : "Upstream",
  }));
}

async function resolveActual(
  payload: Payload,
  organisationId: string,
  doc: SupplierDoc,
): Promise<number | null> {
  const fromDp = await loadReportedEmissions(payload, organisationId, String(doc.id));
  if (fromDp != null) return fromDp;
  return submittedTco2e(doc);
}

export type Tier2EstimateResult = {
  cascade: Tier1CascadeResult;
  persisted: {
    supplierId: string;
    estimatedEmissions: number;
    estimationMethod: EstimationMethod;
  }[];
};

type BuildArgs = {
  payload: Payload;
  organisationId: string;
  supplierId: string;
  allowTopDown?: boolean;
};

async function buildCascadeForSupplier(args: BuildArgs): Promise<{
  cascade: Tier1CascadeResult;
  networkKids: Awaited<ReturnType<typeof networkChildrenForParent>>;
}> {
  const { payload, organisationId, supplierId } = args;
  const tier1Doc = await loadSupplierDoc(payload, organisationId, supplierId);
  const tier1Actual = await resolveActual(payload, organisationId, tier1Doc);

  if (!tier1Doc.naceCode && tier1Actual == null && !tier1Doc.industryIntensityOverride) {
    throw new MissingNaceError(String(tier1Doc.id), tier1Doc.name);
  }

  const tier1 = supplierDocToNode(tier1Doc, {
    tier: 1,
    parentId: null,
    actualEmissions: tier1Actual,
  });

  const childDocsT2 = await listChildSuppliers(payload, organisationId, supplierId, 2);
  const networkKids = await networkChildrenForParent(payload, organisationId, supplierId);

  const tier2Inputs: TierNodeInput[] = [];
  const seen = new Set<string>();

  for (const doc of childDocsT2) {
    const id = String(doc.id);
    if (seen.has(id)) continue;
    seen.add(id);
    const actual = await resolveActual(payload, organisationId, doc);
    if (
      !doc.naceCode &&
      actual == null &&
      !doc.industryIntensityOverride &&
      !args.allowTopDown
    ) {
      throw new MissingNaceError(id, doc.name);
    }
    tier2Inputs.push(
      supplierDocToNode(doc, { tier: 2, parentId: supplierId, actualEmissions: actual }),
    );
  }

  for (const edge of networkKids.filter((e) => e.tier === 2)) {
    if (edge.supplierId && seen.has(edge.supplierId)) continue;
    const id = edge.supplierId ?? `edge:${edge.edgeId}`;
    if (seen.has(id)) continue;
    seen.add(id);

    if (edge.supplierId) {
      const doc = await loadSupplierDoc(payload, organisationId, edge.supplierId);
      const actual = await resolveActual(payload, organisationId, doc);
      const input = supplierDocToNode(doc, {
        tier: 2,
        parentId: supplierId,
        actualEmissions: actual ?? (edge.emissions > 0 ? edge.emissions : null),
      });
      if (!(input.spend > 0) && edge.spend > 0) input.spend = edge.spend;
      tier2Inputs.push(input);
    } else {
      tier2Inputs.push({
        id,
        name: edge.name,
        tier: 2,
        spend: edge.spend,
        actualEmissions: edge.emissions > 0 ? edge.emissions : null,
        naceCode: tier1.naceCode,
        intensityOverride: null,
        totalRevenue: null,
        parentId: supplierId,
      });
    }
  }

  const childDocsT3: SupplierDoc[] = [];
  for (const t2 of tier2Inputs) {
    if (t2.id.startsWith("edge:")) continue;
    const kids = await listChildSuppliers(payload, organisationId, t2.id, 3);
    childDocsT3.push(...kids);
  }

  const tier3Inputs: TierNodeInput[] = [];
  const seen3 = new Set<string>();
  for (const doc of childDocsT3) {
    const id = String(doc.id);
    if (seen3.has(id)) continue;
    seen3.add(id);
    const actual = await resolveActual(payload, organisationId, doc);
    const parentId = relationId(doc.parentSupplier) ?? supplierId;
    if (
      !doc.naceCode &&
      actual == null &&
      !doc.industryIntensityOverride &&
      !args.allowTopDown
    ) {
      throw new MissingNaceError(id, doc.name);
    }
    tier3Inputs.push(
      supplierDocToNode(doc, { tier: 3, parentId, actualEmissions: actual }),
    );
  }

  for (const edge of networkKids.filter((e) => e.tier === 3)) {
    const id = edge.supplierId ?? `edge:${edge.edgeId}`;
    if (seen3.has(id) || (edge.supplierId && seen3.has(edge.supplierId))) continue;
    seen3.add(id);
    if (edge.supplierId) {
      const doc = await loadSupplierDoc(payload, organisationId, edge.supplierId);
      const actual = await resolveActual(payload, organisationId, doc);
      const input = supplierDocToNode(doc, {
        tier: 3,
        parentId: relationId(doc.parentSupplier),
        actualEmissions: actual ?? (edge.emissions > 0 ? edge.emissions : null),
      });
      if (!(input.spend > 0) && edge.spend > 0) input.spend = edge.spend;
      tier3Inputs.push(input);
    } else {
      tier3Inputs.push({
        id,
        name: edge.name,
        tier: 3,
        spend: edge.spend,
        actualEmissions: edge.emissions > 0 ? edge.emissions : null,
        naceCode: tier1.naceCode,
        intensityOverride: null,
        totalRevenue: null,
        parentId: null,
      });
    }
  }

  if (tier2Inputs.length === 0 && tier1.naceCode && tier1.spend > 0) {
    tier2Inputs.push({
      id: `synth-t2-${supplierId}`,
      name: `Upstream of ${tier1.name}`,
      tier: 2,
      spend: tier1.spend * 0.35,
      actualEmissions: null,
      naceCode: tier1.naceCode,
      intensityOverride: null,
      totalRevenue: null,
      parentId: supplierId,
    });
  }

  const cascade = calculateTier1Cascade({
    tier1,
    tier2: tier2Inputs,
    tier3: tier3Inputs,
    allowTopDown: args.allowTopDown === true,
  });

  return { cascade, networkKids };
}

/**
 * Trigger hybrid Tier 2/3 estimate for a Tier-1 supplier and persist results.
 */
export async function estimateTier2ForSupplier(args: {
  payload: Payload;
  organisationId: string;
  supplierId: string;
  allowTopDown?: boolean;
}): Promise<Tier2EstimateResult> {
  const { payload } = args;
  const { cascade, networkKids } = await buildCascadeForSupplier(args);

  const persisted: Tier2EstimateResult["persisted"] = [];

  async function persistNode(
    nodeId: string,
    emissions: number,
    method: EstimationMethod,
    confidence: string,
    tier: SupplyTier,
  ) {
    if (nodeId.startsWith("edge:") || nodeId.startsWith("synth-")) return;
    await payload.update({
      collection: "suppliers",
      id: nodeId,
      data: {
        estimatedEmissions: emissions,
        estimationMethod: method,
        estimationConfidence: confidence as "high" | "medium" | "low",
        tier,
      },
      overrideAccess: true,
      context: { skipRiskRecalc: true },
    });
    persisted.push({
      supplierId: nodeId,
      estimatedEmissions: emissions,
      estimationMethod: method,
    });
  }

  await persistNode(
    cascade.tier1Direct.id,
    cascade.tier1Direct.attributableEmissions,
    cascade.tier1Direct.estimationMethod,
    cascade.tier1Direct.confidence,
    1,
  );
  for (const n of cascade.tier2) {
    await persistNode(n.id, n.attributableEmissions, n.estimationMethod, n.confidence, 2);
  }
  for (const n of cascade.tier3) {
    await persistNode(n.id, n.attributableEmissions, n.estimationMethod, n.confidence, 3);
  }

  for (const edge of networkKids) {
    const match =
      cascade.tier2.find(
        (n) => n.id === edge.supplierId || n.id === `edge:${edge.edgeId}`,
      ) ??
      cascade.tier3.find(
        (n) => n.id === edge.supplierId || n.id === `edge:${edge.edgeId}`,
      );
    if (!match) continue;
    await payload.update({
      collection: SUPPLY_CHAIN_NETWORKS_SLUG,
      id: edge.edgeId,
      data: {
        emissions: match.attributableEmissions,
        estimated: match.estimated,
        spend: match.spend > 0 ? match.spend : edge.spend,
      },
      overrideAccess: true,
    });
  }

  return { cascade, persisted };
}

export async function getTier2Emissions(args: {
  payload: Payload;
  organisationId: string;
  supplierId: string;
}): Promise<Tier1CascadeResult> {
  const { cascade } = await buildCascadeForSupplier({
    ...args,
    allowTopDown: true,
  });
  return cascade;
}

/**
 * Org-level Scope 3 Category 1 = Tier1 direct + Tier2 + Tier3 (deduped).
 */
export async function getCategory1Breakdown(args: {
  payload: Payload;
  organisationId: string;
}): Promise<Category1Breakdown> {
  const { payload, organisationId } = args;
  const tier1s = await payload.find({
    collection: "suppliers",
    where: {
      and: [
        { organisation: { equals: organisationId } },
        {
          or: [{ tier: { equals: 1 } }, { tier: { exists: false } }],
        },
      ],
    },
    limit: 500,
    overrideAccess: true,
  });

  const cascades: Tier1CascadeResult[] = [];
  for (const doc of tier1s.docs as SupplierDoc[]) {
    try {
      const { cascade } = await buildCascadeForSupplier({
        payload,
        organisationId,
        supplierId: String(doc.id),
        allowTopDown: true,
      });
      cascades.push(cascade);
    } catch (err) {
      if (err instanceof MissingNaceError) {
        continue;
      }
      throw err;
    }
  }

  return composeCategory1Breakdown(cascades);
}

export type Tier2SurveyResult = {
  link: string | null;
  delivery: "resend" | "console" | "failed" | "skipped";
  error?: string;
};

/**
 * Send a Tier-2 emissions survey email (consent-gated).
 */
export async function sendTier2Survey(args: {
  payload: Payload;
  organisationId: string;
  orgName: string;
  supplierId: string;
  origin: string;
}): Promise<Tier2SurveyResult> {
  const doc = await loadSupplierDoc(args.payload, args.organisationId, args.supplierId);
  if (!doc.contactEmail) {
    return { link: null, delivery: "failed", error: "Supplier has no contact email." };
  }
  if (doc.emailConsent !== true) {
    return {
      link: null,
      delivery: "skipped",
      error:
        "Supplier has not consented to engagement email. Record consent before sending a Tier 2 survey.",
    };
  }

  const link = `${args.origin}/suppliers/${args.supplierId}/tier-emissions`;
  const subject = `${args.orgName}: Tier 2 / upstream emissions survey`;

  try {
    const result = await sendTransactionalEmail({
      to: doc.contactEmail,
      subject,
      html: `<p>Hi ${escapeHtml(doc.name)},</p>
<p>${escapeHtml(args.orgName)} is collecting upstream (Tier 2/3) emissions for Scope 3 Category 1.</p>
<p>Please confirm your <strong>NACE industry code</strong> and annual emissions (tCO₂e), or spend intensity. Do not invent industry codes.</p>
<p><a href="${escapeHtml(link)}">Open Tier 2 emissions form</a></p>`,
    });
    return {
      link,
      delivery: result.delivery === "resend" ? "resend" : "console",
    };
  } catch (err) {
    return {
      link,
      delivery: "failed",
      error: err instanceof Error ? err.message : "Email send failed",
    };
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
