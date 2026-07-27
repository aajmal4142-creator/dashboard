/** Curated dashboard font keys — UI shows friendly labels. */
export const BRAND_FONT_KEYS = [
  "inter_tight",
  "plus_jakarta",
  "fraunces",
  "space_grotesk",
] as const;

export type BrandFontKey = (typeof BRAND_FONT_KEYS)[number];

export const BRAND_FONT_OPTIONS: Array<{ value: BrandFontKey; label: string }> = [
  { value: "inter_tight", label: "Modern sans" },
  { value: "plus_jakarta", label: "Friendly sans" },
  { value: "fraunces", label: "Editorial serif" },
  { value: "space_grotesk", label: "Geometric sans" },
];

export const BRAND_RADIUS_KEYS = ["sharp", "default", "soft"] as const;
export type BrandRadiusKey = (typeof BRAND_RADIUS_KEYS)[number];

export const BRAND_RADIUS_OPTIONS: Array<{ value: BrandRadiusKey; label: string }> = [
  { value: "sharp", label: "Sharp" },
  { value: "default", label: "Default" },
  { value: "soft", label: "Soft" },
];

export const BRAND_MODE_KEYS = ["light", "dark"] as const;
export type BrandModeKey = (typeof BRAND_MODE_KEYS)[number];

export type OrgBranding = {
  primaryColor: string | null;
  secondaryColor: string | null;
  fontFamily: BrandFontKey | null;
  defaultMode: BrandModeKey | null;
  radius: BrandRadiusKey | null;
  logoId: string | null;
  logoUrl: string | null;
  domain: string | null;
};

export type BrandCookiePayload = {
  v: 1;
  orgId: string;
  primaryColor: string | null;
  secondaryColor: string | null;
  fontFamily: BrandFontKey | null;
  defaultMode: BrandModeKey | null;
  radius: BrandRadiusKey | null;
  logoUrl: string | null;
};

export const BRAND_COOKIE = "clearesg-brand";
export const BRAND_COOKIE_VERSION = 1 as const;

export const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/;

export function isBrandFontKey(value: string | null | undefined): value is BrandFontKey {
  return BRAND_FONT_KEYS.includes(value as BrandFontKey);
}

export function isBrandRadiusKey(
  value: string | null | undefined,
): value is BrandRadiusKey {
  return BRAND_RADIUS_KEYS.includes(value as BrandRadiusKey);
}

export function isBrandModeKey(value: string | null | undefined): value is BrandModeKey {
  return BRAND_MODE_KEYS.includes(value as BrandModeKey);
}

export function isHexColor(value: string | null | undefined): value is string {
  return typeof value === "string" && HEX_COLOR_RE.test(value);
}
