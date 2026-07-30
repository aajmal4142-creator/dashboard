/**
 * Curated assurance partner directory seed.
 *
 * Demo data only — not a live booking marketplace.
 * Contact emails use @example.com placeholders (RFC 2606); do not treat as live inboxes.
 * Websites point at public firm domains for orientation.
 */

import type { Payload } from "payload";

import { ASSURANCE_PARTNERS_SLUG } from "@/collections/AssurancePartners";

import type { FirmType } from "./types";

type CertValue = "iso_14064_2" | "csrd" | "brsr" | "gri" | "sasb" | "sbt";

type PartnerSeed = {
  firmName: string;
  firmType: FirmType;
  website: string;
  /** Placeholder only — @example.com, not a live firm inbox */
  contactEmail: string;
  phone: string;
  location: string;
  country: string;
  countries: string[];
  certifications: Array<{ cert: CertValue; certifiedYear?: number }>;
  specializations: string[];
  teamSize?: number;
  yearsInBusiness?: number;
  rating?: number;
  completedEngagements?: number;
  availability?: "available" | "limited" | "booked";
  leadTime?: number;
};

export const ASSURANCE_PARTNER_SEEDS: PartnerSeed[] = [
  {
    firmName: "Deloitte",
    firmType: "big4",
    website: "https://www.deloitte.com",
    contactEmail: "assurance-directory+deloitte@example.com",
    phone: "+44 20 7936 3000 (directory demo)",
    location: "London, United Kingdom",
    country: "GB",
    countries: ["GB", "IN", "US", "DE", "NL"],
    certifications: [
      { cert: "iso_14064_2", certifiedYear: 2018 },
      { cert: "csrd", certifiedYear: 2023 },
      { cert: "brsr", certifiedYear: 2022 },
      { cert: "gri", certifiedYear: 2016 },
    ],
    specializations: ["CSRD assurance", "GHG inventory", "Climate risk", "Manufacturing"],
    teamSize: 1200,
    yearsInBusiness: 175,
    rating: 4.4,
    completedEngagements: 420,
    availability: "limited",
    leadTime: 60,
  },
  {
    firmName: "PwC",
    firmType: "big4",
    website: "https://www.pwc.com",
    contactEmail: "assurance-directory+pwc@example.com",
    phone: "+44 20 7583 5000 (directory demo)",
    location: "London, United Kingdom",
    country: "GB",
    countries: ["GB", "IN", "US", "SG", "AE"],
    certifications: [
      { cert: "iso_14064_2", certifiedYear: 2017 },
      { cert: "csrd", certifiedYear: 2023 },
      { cert: "sasb", certifiedYear: 2020 },
      { cert: "sbt", certifiedYear: 2021 },
    ],
    specializations: ["CSRD assurance", "Financial services", "Energy", "TCFD"],
    teamSize: 1100,
    yearsInBusiness: 160,
    rating: 4.3,
    completedEngagements: 380,
    availability: "limited",
    leadTime: 75,
  },
  {
    firmName: "EY",
    firmType: "big4",
    website: "https://www.ey.com",
    contactEmail: "assurance-directory+ey@example.com",
    phone: "+44 20 7951 2000 (directory demo)",
    location: "London, United Kingdom",
    country: "GB",
    countries: ["GB", "IN", "US", "DE", "FR"],
    certifications: [
      { cert: "iso_14064_2", certifiedYear: 2019 },
      { cert: "csrd", certifiedYear: 2023 },
      { cert: "gri", certifiedYear: 2015 },
      { cert: "brsr", certifiedYear: 2022 },
    ],
    specializations: ["CSRD assurance", "Supply chain", "Transport", "ISSB"],
    teamSize: 1000,
    yearsInBusiness: 170,
    rating: 4.2,
    completedEngagements: 350,
    availability: "available",
    leadTime: 45,
  },
  {
    firmName: "KPMG",
    firmType: "big4",
    website: "https://kpmg.com",
    contactEmail: "assurance-directory+kpmg@example.com",
    phone: "+44 20 7311 1000 (directory demo)",
    location: "London, United Kingdom",
    country: "GB",
    countries: ["GB", "IN", "US", "NL", "AU"],
    certifications: [
      { cert: "iso_14064_2", certifiedYear: 2018 },
      { cert: "csrd", certifiedYear: 2023 },
      { cert: "sasb", certifiedYear: 2019 },
      { cert: "gri", certifiedYear: 2014 },
    ],
    specializations: ["CSRD assurance", "Manufacturing", "Retail", "Decarbonisation"],
    teamSize: 950,
    yearsInBusiness: 150,
    rating: 4.3,
    completedEngagements: 310,
    availability: "limited",
    leadTime: 60,
  },
  {
    firmName: "BDO",
    firmType: "mid_tier",
    website: "https://www.bdo.global",
    contactEmail: "assurance-directory+bdo@example.com",
    phone: "+44 20 7486 5888 (directory demo)",
    location: "London, United Kingdom",
    country: "GB",
    countries: ["GB", "IN", "DE", "NL"],
    certifications: [
      { cert: "iso_14064_2", certifiedYear: 2020 },
      { cert: "csrd", certifiedYear: 2024 },
      { cert: "gri", certifiedYear: 2018 },
    ],
    specializations: ["Mid-market CSRD", "SME GHG", "Manufacturing"],
    teamSize: 280,
    yearsInBusiness: 50,
    rating: 4.1,
    completedEngagements: 140,
    availability: "available",
    leadTime: 35,
  },
  {
    firmName: "Grant Thornton",
    firmType: "mid_tier",
    website: "https://www.grantthornton.global",
    contactEmail: "assurance-directory+grantthornton@example.com",
    phone: "+44 20 7383 5100 (directory demo)",
    location: "London, United Kingdom",
    country: "GB",
    countries: ["GB", "IN", "US", "IE"],
    certifications: [
      { cert: "iso_14064_2", certifiedYear: 2021 },
      { cert: "csrd", certifiedYear: 2024 },
      { cert: "brsr", certifiedYear: 2023 },
    ],
    specializations: ["BRSR readiness", "Private equity portfolio", "Energy"],
    teamSize: 220,
    yearsInBusiness: 100,
    rating: 4.0,
    completedEngagements: 110,
    availability: "available",
    leadTime: 30,
  },
  {
    firmName: "Carbon Trust",
    firmType: "specialist",
    website: "https://www.carbontrust.com",
    contactEmail: "assurance-directory+carbontrust@example.com",
    phone: "+44 20 7170 7000 (directory demo)",
    location: "London, United Kingdom",
    country: "GB",
    countries: ["GB", "IN", "SG", "MX"],
    certifications: [
      { cert: "iso_14064_2", certifiedYear: 2015 },
      { cert: "sbt", certifiedYear: 2018 },
      { cert: "gri", certifiedYear: 2016 },
    ],
    specializations: ["Product carbon footprint", "Science-based targets", "Energy"],
    teamSize: 180,
    yearsInBusiness: 20,
    rating: 4.6,
    completedEngagements: 260,
    availability: "available",
    leadTime: 28,
  },
  {
    firmName: "Bureau Veritas",
    firmType: "specialist",
    website: "https://www.bureauveritas.com",
    contactEmail: "assurance-directory+bureauveritas@example.com",
    phone: "+33 1 55 24 70 00 (directory demo)",
    location: "Paris, France",
    country: "FR",
    countries: ["FR", "IN", "GB", "DE", "US"],
    certifications: [
      { cert: "iso_14064_2", certifiedYear: 2014 },
      { cert: "csrd", certifiedYear: 2024 },
      { cert: "gri", certifiedYear: 2017 },
    ],
    specializations: ["Verification", "Industrial sites", "Transport", "ISO 14064"],
    teamSize: 400,
    yearsInBusiness: 190,
    rating: 4.2,
    completedEngagements: 500,
    availability: "available",
    leadTime: 40,
  },
  {
    firmName: "DNV",
    firmType: "specialist",
    website: "https://www.dnv.com",
    contactEmail: "assurance-directory+dnv@example.com",
    phone: "+47 67 57 99 00 (directory demo)",
    location: "Høvik, Norway",
    country: "NO",
    countries: ["NO", "GB", "IN", "SG", "US"],
    certifications: [
      { cert: "iso_14064_2", certifiedYear: 2016 },
      { cert: "csrd", certifiedYear: 2024 },
      { cert: "sbt", certifiedYear: 2019 },
    ],
    specializations: ["Energy", "Maritime", "Renewables", "GHG verification"],
    teamSize: 350,
    yearsInBusiness: 160,
    rating: 4.5,
    completedEngagements: 440,
    availability: "limited",
    leadTime: 50,
  },
  {
    firmName: "SGS",
    firmType: "specialist",
    website: "https://www.sgs.com",
    contactEmail: "assurance-directory+sgs@example.com",
    phone: "+41 22 739 91 11 (directory demo)",
    location: "Geneva, Switzerland",
    country: "CH",
    countries: ["CH", "IN", "GB", "DE", "CN"],
    certifications: [
      { cert: "iso_14064_2", certifiedYear: 2015 },
      { cert: "gri", certifiedYear: 2016 },
      { cert: "brsr", certifiedYear: 2023 },
    ],
    specializations: ["Supply chain audit", "Manufacturing", "ISO 14064", "Retail"],
    teamSize: 500,
    yearsInBusiness: 140,
    rating: 4.1,
    completedEngagements: 600,
    availability: "available",
    leadTime: 35,
  },
  {
    firmName: "ERM",
    firmType: "specialist",
    website: "https://www.erm.com",
    contactEmail: "assurance-directory+erm@example.com",
    phone: "+44 20 3206 5200 (directory demo)",
    location: "London, United Kingdom",
    country: "GB",
    countries: ["GB", "IN", "US", "NL", "AU"],
    certifications: [
      { cert: "csrd", certifiedYear: 2024 },
      { cert: "gri", certifiedYear: 2015 },
      { cert: "sasb", certifiedYear: 2019 },
      { cert: "sbt", certifiedYear: 2020 },
    ],
    specializations: ["Climate risk", "TCFD", "Nature", "Oil & gas"],
    teamSize: 320,
    yearsInBusiness: 50,
    rating: 4.4,
    completedEngagements: 210,
    availability: "available",
    leadTime: 40,
  },
  {
    firmName: "Thinkthrough Consulting",
    firmType: "specialist",
    website: "https://www.ttcglocal.com",
    contactEmail: "assurance-directory+ttc@example.com",
    phone: "+91 11 0000 0000 (directory demo)",
    location: "New Delhi, India",
    country: "IN",
    countries: ["IN"],
    certifications: [
      { cert: "brsr", certifiedYear: 2021 },
      { cert: "gri", certifiedYear: 2018 },
      { cert: "iso_14064_2", certifiedYear: 2020 },
    ],
    specializations: ["BRSR", "India listed companies", "GHG inventory"],
    teamSize: 80,
    yearsInBusiness: 15,
    rating: 4.3,
    completedEngagements: 95,
    availability: "available",
    leadTime: 21,
  },
];

/**
 * Idempotent upsert by firmName. Creates missing partners; does not overwrite existing rows.
 */
export async function ensureAssurancePartners(payload: Payload): Promise<{
  created: string[];
  existing: string[];
}> {
  const created: string[] = [];
  const existing: string[] = [];

  for (const seed of ASSURANCE_PARTNER_SEEDS) {
    const found = await payload.find({
      collection: ASSURANCE_PARTNERS_SLUG,
      where: { firmName: { equals: seed.firmName } },
      limit: 1,
      overrideAccess: true,
    });

    if (found.docs[0]) {
      existing.push(seed.firmName);
      continue;
    }

    await payload.create({
      collection: ASSURANCE_PARTNERS_SLUG,
      data: {
        firmName: seed.firmName,
        firmType: seed.firmType,
        website: seed.website,
        contactEmail: seed.contactEmail,
        phone: seed.phone,
        location: seed.location,
        country: seed.country,
        countries: seed.countries.map((code) => ({ code })),
        certifications: seed.certifications,
        specializations: seed.specializations.map((spec) => ({ spec })),
        teamSize: seed.teamSize,
        yearsInBusiness: seed.yearsInBusiness,
        rating: seed.rating,
        completedEngagements: seed.completedEngagements ?? 0,
        availability: seed.availability ?? "available",
        leadTime: seed.leadTime,
      },
      overrideAccess: true,
    });
    created.push(seed.firmName);
  }

  return { created, existing };
}
