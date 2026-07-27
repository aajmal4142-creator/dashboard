export const THEME_COOKIE = "clearesg-theme";

export type Theme = "light" | "dark";

export function isTheme(value: string | undefined | null): value is Theme {
  return value === "light" || value === "dark";
}

/**
 * Theme is applied server-side in root layout via cookies() → data-theme.
 * ThemeToggle updates the cookie + attribute on the client.
 * No inline boot script — React 19 rejects <script> in the component tree.
 * Cream (light) remains the PRIMARY default; dark is cookie opt-in only.
 */
