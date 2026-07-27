"use client";

import { useEffect } from "react";

import type { BrandModeKey } from "@/lib/branding";
import { THEME_COOKIE, isTheme } from "@/lib/theme";

function readThemeCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${THEME_COOKIE}=([^;]*)`));
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

/**
 * When the user has no personal theme cookie, apply the org defaultMode once.
 * Does not override an existing clearesg-theme preference.
 */
export function OrgDefaultTheme({ defaultMode }: { defaultMode: BrandModeKey | null }) {
  useEffect(() => {
    if (!defaultMode) return;
    const existing = readThemeCookie();
    if (isTheme(existing)) return;
    document.documentElement.setAttribute("data-theme", defaultMode);
    document.documentElement.style.colorScheme =
      defaultMode === "dark" ? "dark" : "light";
  }, [defaultMode]);

  return null;
}
