export const FIRM_TYPES = ["big4", "mid_tier", "specialist"] as const;

export type FirmType = (typeof FIRM_TYPES)[number];

export const FIRM_TYPE_LABELS: Record<FirmType, string> = {
  big4: "Big 4",
  mid_tier: "Mid-tier",
  specialist: "Specialist",
};

export const CERT_LABELS: Record<string, string> = {
  iso_14064_2: "ISO 14064-2",
  csrd: "CSRD",
  brsr: "BRSR",
  gri: "GRI",
  sasb: "SASB",
  sbt: "Science Based Targets",
};

export type PartnerListItem = {
  id: string;
  name: string;
  firmType: FirmType;
  website: string;
  email: string;
  phone: string;
  location: string;
  country: string;
  countries: string[];
  rating: number | null;
  certifications: Array<{ cert: string; certifiedYear: number | null }>;
  specializations: string[];
  availability: string | null;
  leadTime: number | null;
  teamSize: number | null;
  yearsInBusiness: number | null;
  completedEngagements: number | null;
};
