import { accentHover, onColor } from "@/lib/branding/color";
import {
  isBrandFontKey,
  isBrandRadiusKey,
  isHexColor,
  type BrandFontKey,
  type BrandRadiusKey,
  type OrgBranding,
} from "@/lib/branding/types";

const FONT_CSS_VAR: Record<BrandFontKey, string> = {
  inter_tight: "var(--font-inter-tight)",
  plus_jakarta: "var(--font-plus-jakarta, var(--font-inter-tight))",
  fraunces: "var(--font-fraunces)",
  space_grotesk: "var(--font-space-grotesk)",
};

const RADIUS_MAP: Record<
  BrandRadiusKey,
  { panel: string; control: string; chip: string }
> = {
  sharp: { panel: "0.125rem", control: "0.125rem", chip: "0.0625rem" },
  default: { panel: "0.375rem", control: "0.25rem", chip: "0.125rem" },
  soft: { panel: "0.75rem", control: "0.5rem", chip: "0.25rem" },
};

export type BrandingCssVars = {
  "--accent"?: string;
  "--accent-hover"?: string;
  "--accent-quiet"?: string;
  "--on-accent"?: string;
  "--brand-secondary"?: string;
  "--font-sans"?: string;
  "--font-display"?: string;
  "--radius-panel"?: string;
  "--radius"?: string;
  "--radius-chip"?: string;
};

/** Map org branding → CSS custom properties (dashboard only). */
export function brandingToCssVars(
  branding: Partial<OrgBranding> | null | undefined,
): BrandingCssVars {
  const vars: BrandingCssVars = {};

  if (isHexColor(branding?.primaryColor ?? null)) {
    const primary = branding!.primaryColor!;
    vars["--accent"] = primary;
    vars["--accent-hover"] = accentHover(primary);
    vars["--accent-quiet"] = `color-mix(in srgb, ${primary} 10%, transparent)`;
    vars["--on-accent"] = onColor(primary);
  }

  if (isHexColor(branding?.secondaryColor ?? null)) {
    vars["--brand-secondary"] = branding!.secondaryColor!;
  }

  const font = branding?.fontFamily;
  if (isBrandFontKey(font)) {
    const family = FONT_CSS_VAR[font];
    vars["--font-sans"] = family;
    vars["--font-display"] = family;
  }

  const radius = branding?.radius;
  if (isBrandRadiusKey(radius)) {
    const r = RADIUS_MAP[radius];
    vars["--radius-panel"] = r.panel;
    vars["--radius"] = r.control;
    vars["--radius-chip"] = r.chip;
  }

  return vars;
}

/** Serialize CSS vars for a `<style>` tag scoped to dashboard. */
export function brandingToStyleSheet(vars: BrandingCssVars): string {
  const entries = Object.entries(vars).filter(
    (entry): entry is [string, string] =>
      typeof entry[1] === "string" && entry[1].length > 0,
  );
  if (entries.length === 0) return "";
  const body = entries.map(([k, v]) => `${k}: ${v};`).join(" ");
  const fontApply = vars["--font-sans"]
    ? " font-family: var(--font-sans), system-ui, sans-serif;"
    : "";
  // Set tokens on shell + html:has(shell) so inherited type and .font-display resolve.
  return [
    `[data-app-shell], html:has([data-app-shell]) { ${body}${fontApply} }`,
    vars["--font-display"]
      ? `[data-app-shell] .font-display, [data-app-shell] .display-40, [data-app-shell] .display-56, [data-app-shell] .display-80 { font-family: var(--font-display), system-ui, sans-serif; }`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function brandingCssVarsToInlineStyle(
  vars: BrandingCssVars,
): Record<string, string> {
  const style: Record<string, string> = {};
  for (const [k, v] of Object.entries(vars)) {
    if (typeof v === "string" && v.length > 0) style[k] = v;
  }
  return style;
}
