/**
 * Bare layout for interactive HTML report pages (no AppShell).
 * Auth is enforced in the page via getCurrentContext + Membership.
 */
export default function ReportViewLayout({ children }: { children: React.ReactNode }) {
  return children;
}
