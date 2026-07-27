import {
  isBrandFontKey,
  isBrandModeKey,
  isBrandRadiusKey,
  isHexColor,
  type OrgBranding,
} from "@/lib/branding/types";

type MediaLike = {
  id?: string;
  url?: string | null;
  filename?: string | null;
} | null;

type BrandGroup = {
  logo?: string | MediaLike | null;
  primaryColor?: string | null;
  domain?: string | null;
} | null;

type SettingsGroup = {
  branding?: {
    logo?: string | MediaLike | null;
    primaryColor?: string | null;
    secondaryColor?: string | null;
    fontFamily?: string | null;
    defaultMode?: string | null;
    radius?: string | null;
  } | null;
  domain?: string | null;
} | null;

export type OrgBrandSource = {
  brand?: BrandGroup;
  settings?: SettingsGroup;
};

function mediaId(logo: string | MediaLike | null | undefined): string | null {
  if (!logo) return null;
  if (typeof logo === "string") return logo;
  return logo.id ?? null;
}

function mediaUrl(logo: string | MediaLike | null | undefined): string | null {
  if (!logo || typeof logo === "string") return null;
  if (logo.url) return logo.url;
  if (logo.filename) return `/media/${logo.filename}`;
  return null;
}

function pickHex(value: string | null | undefined): string | null {
  return isHexColor(value) ? value : null;
}

/**
 * Resolve dashboard branding from `settings.branding` with fallback to legacy `brand`.
 */
export function resolveOrgBranding(org: OrgBrandSource | null | undefined): OrgBranding {
  const settings = org?.settings?.branding;
  const legacy = org?.brand;

  const logoSource = settings?.logo ?? legacy?.logo ?? null;
  const primary = pickHex(settings?.primaryColor) ?? pickHex(legacy?.primaryColor);
  const secondary = pickHex(settings?.secondaryColor);
  const fontFamily = isBrandFontKey(settings?.fontFamily) ? settings!.fontFamily! : null;
  const defaultMode = isBrandModeKey(settings?.defaultMode)
    ? settings!.defaultMode!
    : null;
  const radius = isBrandRadiusKey(settings?.radius) ? settings!.radius! : null;
  const domain =
    (org?.settings?.domain?.trim() || null) ?? (legacy?.domain?.trim() || null);

  return {
    primaryColor: primary,
    secondaryColor: secondary,
    fontFamily,
    defaultMode,
    radius,
    logoId: mediaId(logoSource),
    logoUrl: mediaUrl(logoSource),
    domain,
  };
}
