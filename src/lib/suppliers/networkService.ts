import { randomBytes } from "node:crypto";

import type { Payload } from "payload";

import { SHARED_EMISSION_SNAPSHOTS_SLUG } from "@/collections/SharedEmissionSnapshots";
import { SUPPLIER_NETWORK_INVITES_SLUG } from "@/collections/SupplierNetworkInvites";

import {
  buildConsentedSnapshot,
  canTransitionInvite,
  inviteEmailMatchesUser,
  inviteExpiryFrom,
  isInviteExpired,
  isValidInviteEmail,
  normalizeInviteEmail,
  orgsAreDistinct,
  type ConsentedSnapshotInput,
  type NetworkInviteStatus,
  type SnapshotQuality,
} from "./network";

export type NetworkInviteDto = {
  id: string;
  inviteEmail: string;
  status: NetworkInviteStatus;
  token: string;
  buyerOrganisationId: string;
  buyerOrganisationName: string | null;
  supplierOrganisationId: string | null;
  supplierOrganisationName: string | null;
  supplierDisplayName: string | null;
  message: string | null;
  expiresAt: string;
  acceptedAt: string | null;
  declinedAt: string | null;
  revokedAt: string | null;
  createdAt: string | null;
  expired: boolean;
};

export type SharedEmissionSnapshotDto = {
  id: string;
  buyerOrganisationId: string;
  supplierOrganisationId: string;
  supplierOrganisationName: string | null;
  inviteId: string;
  periodLabel: string;
  periodStart: string | null;
  periodEnd: string | null;
  scope1Tco2e: number | null;
  scope2Tco2e: number | null;
  scope3Tco2e: number | null;
  quality: SnapshotQuality;
  consentedAt: string;
  note: string | null;
};

function relId(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "id" in value) {
    const id = (value as { id: unknown }).id;
    return typeof id === "string" ? id : null;
  }
  return null;
}

function relName(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const name = (value as { name?: unknown }).name;
  return typeof name === "string" ? name : null;
}

function asIso(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  return null;
}

function asNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return null;
}

function newInviteToken(): string {
  return randomBytes(24).toString("base64url");
}

export function docToInviteDto(
  doc: Record<string, unknown>,
  now = new Date(),
): NetworkInviteDto {
  const expiresAt = asIso(doc.expiresAt) ?? new Date(0).toISOString();
  const status = (doc.status as NetworkInviteStatus) ?? "pending";
  return {
    id: String(doc.id),
    inviteEmail: String(doc.inviteEmail ?? ""),
    status,
    token: String(doc.token ?? ""),
    buyerOrganisationId: relId(doc.organisation) ?? "",
    buyerOrganisationName: relName(doc.organisation),
    supplierOrganisationId: relId(doc.supplierOrganisation),
    supplierOrganisationName: relName(doc.supplierOrganisation),
    supplierDisplayName:
      typeof doc.supplierDisplayName === "string" ? doc.supplierDisplayName : null,
    message: typeof doc.message === "string" ? doc.message : null,
    expiresAt,
    acceptedAt: asIso(doc.acceptedAt),
    declinedAt: asIso(doc.declinedAt),
    revokedAt: asIso(doc.revokedAt),
    createdAt: asIso(doc.createdAt),
    expired: isInviteExpired(expiresAt, now),
  };
}

export function docToSnapshotDto(
  doc: Record<string, unknown>,
): SharedEmissionSnapshotDto {
  return {
    id: String(doc.id),
    buyerOrganisationId: relId(doc.organisation) ?? "",
    supplierOrganisationId: relId(doc.supplierOrganisation) ?? "",
    supplierOrganisationName: relName(doc.supplierOrganisation),
    inviteId: relId(doc.invite) ?? "",
    periodLabel: String(doc.periodLabel ?? ""),
    periodStart: asIso(doc.periodStart),
    periodEnd: asIso(doc.periodEnd),
    scope1Tco2e: asNumberOrNull(doc.scope1Tco2e),
    scope2Tco2e: asNumberOrNull(doc.scope2Tco2e),
    scope3Tco2e: asNumberOrNull(doc.scope3Tco2e),
    quality: (doc.quality as SnapshotQuality) ?? "missing",
    consentedAt: asIso(doc.consentedAt) ?? new Date(0).toISOString(),
    note: typeof doc.note === "string" ? doc.note : null,
  };
}

export async function listInvitesForBuyer(
  payload: Payload,
  buyerOrganisationId: string,
): Promise<NetworkInviteDto[]> {
  const result = await payload.find({
    collection: SUPPLIER_NETWORK_INVITES_SLUG,
    where: { organisation: { equals: buyerOrganisationId } },
    depth: 1,
    limit: 200,
    sort: "-createdAt",
    overrideAccess: true,
  });
  return result.docs.map((d) => docToInviteDto(d as unknown as Record<string, unknown>));
}

export async function listIncomingInvitesForEmail(
  payload: Payload,
  email: string,
): Promise<NetworkInviteDto[]> {
  const normalized = normalizeInviteEmail(email);
  const result = await payload.find({
    collection: SUPPLIER_NETWORK_INVITES_SLUG,
    where: {
      and: [{ inviteEmail: { equals: normalized } }, { status: { equals: "pending" } }],
    },
    depth: 1,
    limit: 100,
    sort: "-createdAt",
    overrideAccess: true,
  });
  const now = new Date();
  return result.docs
    .map((d) => docToInviteDto(d as unknown as Record<string, unknown>, now))
    .filter((inv) => !inv.expired);
}

export async function listSharesForBuyer(
  payload: Payload,
  buyerOrganisationId: string,
): Promise<SharedEmissionSnapshotDto[]> {
  const result = await payload.find({
    collection: SHARED_EMISSION_SNAPSHOTS_SLUG,
    where: { organisation: { equals: buyerOrganisationId } },
    depth: 1,
    limit: 200,
    sort: "-consentedAt",
    overrideAccess: true,
  });
  return result.docs.map((d) =>
    docToSnapshotDto(d as unknown as Record<string, unknown>),
  );
}

export async function createNetworkInvite(opts: {
  payload: Payload;
  buyerOrganisationId: string;
  invitedByUserId: string;
  inviteEmail: string;
  supplierDisplayName?: string | null;
  message?: string | null;
}): Promise<NetworkInviteDto> {
  const email = normalizeInviteEmail(opts.inviteEmail);
  if (!isValidInviteEmail(email)) {
    throw new Error("inviteEmail must be a valid email address");
  }

  const existing = await opts.payload.find({
    collection: SUPPLIER_NETWORK_INVITES_SLUG,
    where: {
      and: [
        { organisation: { equals: opts.buyerOrganisationId } },
        { inviteEmail: { equals: email } },
        { status: { equals: "pending" } },
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  });
  if (existing.docs.length > 0) {
    throw new Error("A pending invite already exists for this email");
  }

  const created = await opts.payload.create({
    collection: SUPPLIER_NETWORK_INVITES_SLUG,
    data: {
      organisation: opts.buyerOrganisationId,
      inviteEmail: email,
      token: newInviteToken(),
      status: "pending",
      supplierDisplayName: opts.supplierDisplayName?.trim() || undefined,
      message: opts.message?.trim() || undefined,
      invitedBy: opts.invitedByUserId,
      expiresAt: inviteExpiryFrom().toISOString(),
    },
    overrideAccess: true,
  });

  return docToInviteDto(created as unknown as Record<string, unknown>);
}

async function loadInvite(
  payload: Payload,
  inviteId: string,
): Promise<Record<string, unknown> | null> {
  try {
    const doc = await payload.findByID({
      collection: SUPPLIER_NETWORK_INVITES_SLUG,
      id: inviteId,
      depth: 1,
      overrideAccess: true,
    });
    return doc as unknown as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function revokeNetworkInvite(opts: {
  payload: Payload;
  inviteId: string;
  buyerOrganisationId: string;
}): Promise<NetworkInviteDto> {
  const doc = await loadInvite(opts.payload, opts.inviteId);
  if (!doc) throw new Error("Invite not found");
  const buyerId = relId(doc.organisation);
  if (buyerId !== opts.buyerOrganisationId) {
    throw new Error("Invite not found");
  }
  const status = (doc.status as NetworkInviteStatus) ?? "pending";
  if (!canTransitionInvite(status, "revoked")) {
    throw new Error(`Cannot revoke invite in status ${status}`);
  }

  const updated = await opts.payload.update({
    collection: SUPPLIER_NETWORK_INVITES_SLUG,
    id: opts.inviteId,
    data: {
      status: "revoked",
      revokedAt: new Date().toISOString(),
    },
    overrideAccess: true,
  });
  return docToInviteDto(updated as unknown as Record<string, unknown>);
}

export async function declineNetworkInvite(opts: {
  payload: Payload;
  inviteId: string;
  userEmail: string;
}): Promise<NetworkInviteDto> {
  const doc = await loadInvite(opts.payload, opts.inviteId);
  if (!doc) throw new Error("Invite not found");
  const inviteEmail = String(doc.inviteEmail ?? "");
  if (!inviteEmailMatchesUser(inviteEmail, opts.userEmail)) {
    throw new Error("Invite email does not match your account");
  }
  const status = (doc.status as NetworkInviteStatus) ?? "pending";
  if (!canTransitionInvite(status, "declined")) {
    throw new Error(`Cannot decline invite in status ${status}`);
  }
  if (isInviteExpired(asIso(doc.expiresAt))) {
    throw new Error("Invite has expired");
  }

  const updated = await opts.payload.update({
    collection: SUPPLIER_NETWORK_INVITES_SLUG,
    id: opts.inviteId,
    data: {
      status: "declined",
      declinedAt: new Date().toISOString(),
    },
    overrideAccess: true,
  });
  return docToInviteDto(updated as unknown as Record<string, unknown>);
}

export async function acceptNetworkInvite(opts: {
  payload: Payload;
  inviteId: string;
  userId: string;
  userEmail: string;
  supplierOrganisationId: string;
  share: ConsentedSnapshotInput;
}): Promise<{ invite: NetworkInviteDto; snapshot: SharedEmissionSnapshotDto }> {
  const doc = await loadInvite(opts.payload, opts.inviteId);
  if (!doc) throw new Error("Invite not found");

  const inviteEmail = String(doc.inviteEmail ?? "");
  if (!inviteEmailMatchesUser(inviteEmail, opts.userEmail)) {
    throw new Error("Invite email does not match your account");
  }

  const buyerId = relId(doc.organisation);
  if (!buyerId) throw new Error("Invite is missing buyer organisation");
  if (!orgsAreDistinct(buyerId, opts.supplierOrganisationId)) {
    throw new Error("Cannot accept an invite into the same organisation that sent it");
  }

  const status = (doc.status as NetworkInviteStatus) ?? "pending";
  if (!canTransitionInvite(status, "accepted")) {
    throw new Error(`Cannot accept invite in status ${status}`);
  }
  if (isInviteExpired(asIso(doc.expiresAt))) {
    throw new Error("Invite has expired");
  }

  const snapshotBuilt = buildConsentedSnapshot(opts.share);
  if ("error" in snapshotBuilt) {
    throw new Error(snapshotBuilt.error);
  }

  const nowIso = new Date().toISOString();

  const updated = await opts.payload.update({
    collection: SUPPLIER_NETWORK_INVITES_SLUG,
    id: opts.inviteId,
    data: {
      status: "accepted",
      supplierOrganisation: opts.supplierOrganisationId,
      acceptedAt: nowIso,
    },
    overrideAccess: true,
  });

  const snapshotData: {
    organisation: string;
    supplierOrganisation: string;
    invite: string;
    periodLabel: string;
    periodStart?: string;
    periodEnd?: string;
    scope1Tco2e?: number;
    scope2Tco2e?: number;
    scope3Tco2e?: number;
    quality: SnapshotQuality;
    consentedAt: string;
    consentedBy: string;
    note?: string;
  } = {
    organisation: buyerId,
    supplierOrganisation: opts.supplierOrganisationId,
    invite: opts.inviteId,
    periodLabel: snapshotBuilt.periodLabel,
    quality: snapshotBuilt.quality,
    consentedAt: nowIso,
    consentedBy: opts.userId,
  };
  if (snapshotBuilt.periodStart) snapshotData.periodStart = snapshotBuilt.periodStart;
  if (snapshotBuilt.periodEnd) snapshotData.periodEnd = snapshotBuilt.periodEnd;
  if (snapshotBuilt.scope1Tco2e !== null) {
    snapshotData.scope1Tco2e = snapshotBuilt.scope1Tco2e;
  }
  if (snapshotBuilt.scope2Tco2e !== null) {
    snapshotData.scope2Tco2e = snapshotBuilt.scope2Tco2e;
  }
  if (snapshotBuilt.scope3Tco2e !== null) {
    snapshotData.scope3Tco2e = snapshotBuilt.scope3Tco2e;
  }
  if (snapshotBuilt.note) snapshotData.note = snapshotBuilt.note;

  const snapshot = await opts.payload.create({
    collection: SHARED_EMISSION_SNAPSHOTS_SLUG,
    data: snapshotData,
    overrideAccess: true,
  });

  return {
    invite: docToInviteDto(updated as unknown as Record<string, unknown>),
    snapshot: docToSnapshotDto(snapshot as unknown as Record<string, unknown>),
  };
}
