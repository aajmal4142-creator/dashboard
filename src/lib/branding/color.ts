import { isHexColor } from "@/lib/branding/types";

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function parseHex(hex: string): { r: number; g: number; b: number } | null {
  if (!isHexColor(hex)) return null;
  return {
    r: Number.parseInt(hex.slice(1, 3), 16),
    g: Number.parseInt(hex.slice(3, 5), 16),
    b: Number.parseInt(hex.slice(5, 7), 16),
  };
}

function toHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((c) => clampByte(c).toString(16).padStart(2, "0")).join("")}`;
}

/** Relative luminance (sRGB) 0–1. */
export function relativeLuminance(hex: string): number {
  const rgb = parseHex(hex);
  if (!rgb) return 0;
  const lin = [rgb.r, rgb.g, rgb.b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * (lin[0] ?? 0) + 0.7152 * (lin[1] ?? 0) + 0.0722 * (lin[2] ?? 0);
}

/** Text colour that contrasts on the given fill. */
export function onColor(fillHex: string, light = "#ffffff", dark = "#0f1520"): string {
  return relativeLuminance(fillHex) > 0.45 ? dark : light;
}

/** Mix toward white (amount 0–1). */
export function lightenHex(hex: string, amount: number): string {
  const rgb = parseHex(hex);
  if (!rgb) return hex;
  const t = Math.max(0, Math.min(1, amount));
  return toHex(
    rgb.r + (255 - rgb.r) * t,
    rgb.g + (255 - rgb.g) * t,
    rgb.b + (255 - rgb.b) * t,
  );
}

/** Mix toward black (amount 0–1). */
export function darkenHex(hex: string, amount: number): string {
  const rgb = parseHex(hex);
  if (!rgb) return hex;
  const t = Math.max(0, Math.min(1, amount));
  return toHex(rgb.r * (1 - t), rgb.g * (1 - t), rgb.b * (1 - t));
}

export function accentHover(primaryHex: string): string {
  return relativeLuminance(primaryHex) > 0.35
    ? darkenHex(primaryHex, 0.12)
    : lightenHex(primaryHex, 0.14);
}
