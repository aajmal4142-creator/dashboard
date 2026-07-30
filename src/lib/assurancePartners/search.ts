import type { Where } from "payload";

import type { AssurancePartner } from "@/payload-types";

import type { FirmType, PartnerListItem } from "./types";
import { FIRM_TYPES } from "./types";

export type PartnerSearchParams = {
  q?: string | null;
  country?: string | null;
  specialization?: string | null;
  cert?: string | null;
  firmType?: string | null;
  minRating?: string | null;
  location?: string | null;
};

function isFirmType(value: string): value is FirmType {
  return (FIRM_TYPES as readonly string[]).includes(value);
}

/**
 * Build Payload Where clauses for directory filters.
 * Country / specialization / cert / firmType are applied in the DB query (not post-filter).
 */
export function buildPartnerWhere(params: PartnerSearchParams): Where {
  const clauses: Where[] = [];

  const q = params.q?.trim();
  if (q) {
    clauses.push({
      or: [
        { firmName: { contains: q } },
        { location: { contains: q } },
        { "specializations.spec": { contains: q } },
      ],
    });
  }

  const country = (params.country ?? params.location)?.trim().toUpperCase();
  if (country) {
    clauses.push({
      or: [
        { country: { equals: country } },
        { country: { contains: country } },
        { "countries.code": { equals: country } },
        { "countries.code": { contains: country } },
      ],
    });
  }

  const specialization = params.specialization?.trim();
  if (specialization) {
    clauses.push({
      "specializations.spec": { contains: specialization },
    });
  }

  const cert = params.cert?.trim();
  if (cert) {
    clauses.push({
      "certifications.cert": { equals: cert },
    });
  }

  const firmType = params.firmType?.trim();
  if (firmType && isFirmType(firmType)) {
    clauses.push({ firmType: { equals: firmType } });
  }

  const minRating = params.minRating?.trim();
  if (minRating) {
    const n = Number.parseFloat(minRating);
    if (!Number.isNaN(n)) {
      clauses.push({ rating: { greater_than_equal: n } });
    }
  }

  if (clauses.length === 0) return {};
  if (clauses.length === 1) return clauses[0]!;
  return { and: clauses };
}

export function mapPartnerDoc(p: AssurancePartner): PartnerListItem {
  const firmTypeRaw = p.firmType;
  const firmType: FirmType =
    typeof firmTypeRaw === "string" && isFirmType(firmTypeRaw)
      ? firmTypeRaw
      : "specialist";

  const countriesFromArray = Array.isArray(p.countries)
    ? p.countries
        .map((c) => (c?.code ? String(c.code) : null))
        .filter((c): c is string => Boolean(c))
    : [];

  const countries =
    countriesFromArray.length > 0 ? countriesFromArray : p.country ? [p.country] : [];

  return {
    id: p.id,
    name: p.firmName,
    firmType,
    website: p.website,
    email: p.contactEmail,
    phone: p.phone,
    location: p.location,
    country: p.country,
    countries,
    rating: p.rating ?? null,
    certifications: (p.certifications ?? []).map((c) => ({
      cert: c.cert,
      certifiedYear: c.certifiedYear ?? null,
    })),
    specializations: (p.specializations ?? [])
      .map((s) => s.spec)
      .filter((s): s is string => Boolean(s)),
    availability: p.availability ?? null,
    leadTime: p.leadTime ?? null,
    teamSize: p.teamSize ?? null,
    yearsInBusiness: p.yearsInBusiness ?? null,
    completedEngagements: p.completedEngagements ?? null,
  };
}

export function parsePartnerSearchParams(url: URL): PartnerSearchParams {
  return {
    q: url.searchParams.get("q"),
    country: url.searchParams.get("country"),
    specialization: url.searchParams.get("specialization"),
    cert: url.searchParams.get("cert"),
    firmType: url.searchParams.get("firmType") ?? url.searchParams.get("type"),
    minRating: url.searchParams.get("minRating"),
    location: url.searchParams.get("location"),
  };
}
