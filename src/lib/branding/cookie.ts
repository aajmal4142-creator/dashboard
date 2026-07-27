import {
  BRAND_COOKIE,
  BRAND_COOKIE_VERSION,
  isBrandFontKey,
  isBrandModeKey,
  isBrandRadiusKey,
  isHexColor,
  type BrandCookiePayload,
  type OrgBranding,
} from "@/lib/branding/types";

export { BRAND_COOKIE };

export function brandingToCookiePayload(
  orgId: string,
  branding: OrgBranding,
): BrandCookiePayload {
  return {
    v: BRAND_COOKIE_VERSION,
    orgId,
    primaryColor: branding.primaryColor,
    secondaryColor: branding.secondaryColor,
    fontFamily: branding.fontFamily,
    defaultMode: branding.defaultMode,
    radius: branding.radius,
    logoUrl: branding.logoUrl,
  };
}

export function serializeBrandCookie(payload: BrandCookiePayload): string {
  return JSON.stringify(payload);
}

export function parseBrandCookie(
  raw: string | undefined | null,
): BrandCookiePayload | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Partial<BrandCookiePayload>;
    if (data.v !== BRAND_COOKIE_VERSION || typeof data.orgId !== "string") return null;
    return {
      v: BRAND_COOKIE_VERSION,
      orgId: data.orgId,
      primaryColor: isHexColor(data.primaryColor) ? data.primaryColor : null,
      secondaryColor: isHexColor(data.secondaryColor) ? data.secondaryColor : null,
      fontFamily: isBrandFontKey(data.fontFamily) ? data.fontFamily : null,
      defaultMode: isBrandModeKey(data.defaultMode) ? data.defaultMode : null,
      radius: isBrandRadiusKey(data.radius) ? data.radius : null,
      logoUrl: typeof data.logoUrl === "string" ? data.logoUrl : null,
    };
  } catch {
    return null;
  }
}

export function cookiePayloadToBranding(
  payload: BrandCookiePayload,
): Pick<
  OrgBranding,
  "primaryColor" | "secondaryColor" | "fontFamily" | "defaultMode" | "radius" | "logoUrl"
> {
  return {
    primaryColor: payload.primaryColor,
    secondaryColor: payload.secondaryColor,
    fontFamily: payload.fontFamily,
    defaultMode: payload.defaultMode,
    radius: payload.radius,
    logoUrl: payload.logoUrl,
  };
}

export const brandCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
};
