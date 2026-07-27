import { BrandVars } from "@/components/brand/BrandVars";
import { OrgDefaultTheme } from "@/components/brand/OrgDefaultTheme";
import { AppShellServer } from "@/components/shell/AppShellServer";
import { Toaster } from "@/components/ui/sonner";
import { getCurrentContext } from "@/lib/auth";

/**
 * All /dashboard routes require identity + Membership context.
 * Auth is enforced here (resource-level), not in proxy.ts.
 * Org branding CSS vars injected from active org settings (dashboard only).
 * AppShell lifted once — pages must not wrap AppShell again.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getCurrentContext();
  const branding = ctx.activeOrg?.brand.branding ?? null;
  return (
    <>
      <BrandVars branding={branding} />
      <OrgDefaultTheme defaultMode={branding?.defaultMode ?? null} />
      <AppShellServer logoUrl={branding?.logoUrl ?? null}>{children}</AppShellServer>
      <Toaster />
    </>
  );
}
