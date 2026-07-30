export const THEME_COOKIE = "clearesg-theme";

export type Theme = "light" | "dark";

export function isTheme(value: string | undefined | null): value is Theme {
  return value === "light" || value === "dark";
}

/**
 * Theme is applied server-side in root layout via cookies() → data-theme.
 * ThemeToggle / applyTheme update the cookie + attribute on the client.
 * No inline boot script — React 19 rejects <script> in the component tree.
 * Light remains the PRIMARY default (no prefers-color-scheme); dark is cookie opt-in only.
 * OrgDefaultTheme may seed the cookie from org branding only when no user cookie exists.
 */
