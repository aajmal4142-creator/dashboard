import { describe, expect, it } from "vitest";

import { accentHover, onColor, relativeLuminance } from "@/lib/branding/color";
import {
  parseBrandCookie,
  brandingToCookiePayload,
  serializeBrandCookie,
} from "@/lib/branding/cookie";
import { brandingToCssVars, brandingToStyleSheet } from "@/lib/branding/cssVars";
import { resolveOrgBranding } from "@/lib/branding/resolve";
import { isHexColor } from "@/lib/branding/types";

describe("branding color helpers", () => {
  it("rejects invalid hex", () => {
    expect(isHexColor("#fff")).toBe(false);
    expect(isHexColor("#7A2E2E")).toBe(true);
    expect(isHexColor("red")).toBe(false);
  });

  it("picks contrasting on-accent", () => {
    expect(onColor("#000000")).toBe("#ffffff");
    expect(onColor("#ffffff")).toBe("#0f1520");
  });

  it("computes hover from luminance", () => {
    expect(accentHover("#0F766E")).toMatch(/^#[0-9a-f]{6}$/i);
    expect(relativeLuminance("#ffffff")).toBeGreaterThan(0.9);
  });
});

describe("resolveOrgBranding", () => {
  it("prefers settings over legacy brand", () => {
    const branding = resolveOrgBranding({
      brand: { primaryColor: "#7A2E2E", domain: "old.example" },
      settings: {
        branding: {
          primaryColor: "#0F766E",
          secondaryColor: "#5C6B62",
          fontFamily: "plus_jakarta",
          defaultMode: "light",
          radius: "soft",
        },
        domain: "new.example",
      },
    });
    expect(branding.primaryColor).toBe("#0F766E");
    expect(branding.secondaryColor).toBe("#5C6B62");
    expect(branding.fontFamily).toBe("plus_jakarta");
    expect(branding.domain).toBe("new.example");
    expect(branding.radius).toBe("soft");
  });

  it("falls back to legacy brand", () => {
    const branding = resolveOrgBranding({
      brand: {
        primaryColor: "#533AFD",
        domain: "esg.firm.com",
        logo: { id: "m1", url: "/media/logo.png" },
      },
    });
    expect(branding.primaryColor).toBe("#533AFD");
    expect(branding.logoUrl).toBe("/media/logo.png");
    expect(branding.logoId).toBe("m1");
    expect(branding.domain).toBe("esg.firm.com");
  });

  it("ignores invalid hex and font keys", () => {
    const branding = resolveOrgBranding({
      settings: {
        branding: {
          primaryColor: "not-a-color",
          fontFamily: "comic_sans",
          radius: "huge",
        },
      },
    });
    expect(branding.primaryColor).toBeNull();
    expect(branding.fontFamily).toBeNull();
    expect(branding.radius).toBeNull();
  });
});

describe("brandingToCssVars", () => {
  it("emits accent and derived tokens", () => {
    const vars = brandingToCssVars({
      primaryColor: "#0F766E",
      secondaryColor: "#5C6B62",
      fontFamily: "inter_tight",
      radius: "default",
    });
    expect(vars["--accent"]).toBe("#0F766E");
    expect(vars["--accent-hover"]).toBeTruthy();
    expect(vars["--on-accent"]).toBeTruthy();
    expect(vars["--brand-secondary"]).toBe("#5C6B62");
    expect(vars["--font-sans"]).toContain("--font-inter-tight");
    expect(vars["--radius"]).toBe("0.25rem");
  });

  it("returns empty when nothing set", () => {
    expect(brandingToCssVars({})).toEqual({});
    expect(brandingToStyleSheet({})).toBe("");
  });

  it("applies font-family on the shell stylesheet", () => {
    const css = brandingToStyleSheet(brandingToCssVars({ fontFamily: "plus_jakarta" }));
    expect(css).toContain("--font-sans:");
    expect(css).toContain("font-family: var(--font-sans)");
    expect(css).toContain("[data-app-shell] .font-display");
  });
});

describe("brand cookie", () => {
  it("round-trips", () => {
    const payload = brandingToCookiePayload("org1", {
      primaryColor: "#171717",
      secondaryColor: null,
      fontFamily: "fraunces",
      defaultMode: "dark",
      radius: "sharp",
      logoId: null,
      logoUrl: "/logo.svg",
      domain: null,
    });
    const raw = serializeBrandCookie(payload);
    const parsed = parseBrandCookie(raw);
    expect(parsed?.orgId).toBe("org1");
    expect(parsed?.fontFamily).toBe("fraunces");
    expect(parsed?.logoUrl).toBe("/logo.svg");
  });

  it("rejects garbage", () => {
    expect(parseBrandCookie("not-json")).toBeNull();
    expect(parseBrandCookie('{"v":2,"orgId":"x"}')).toBeNull();
  });
});
