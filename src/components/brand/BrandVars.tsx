import {
  brandingToStyleSheet,
  brandingToCssVars,
  type OrgBranding,
} from "@/lib/branding";

/**
 * Injects org dashboard branding CSS variables.
 * Scoped via [data-app-shell] — never touches marketing frontend.
 * Does not override data colours (--signal, --amber, --rust, --cobalt).
 */
export function BrandVars({ branding }: { branding: Partial<OrgBranding> | null }) {
  const vars = brandingToCssVars(branding);
  const css = brandingToStyleSheet(vars);
  if (!css) return null;
  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}
