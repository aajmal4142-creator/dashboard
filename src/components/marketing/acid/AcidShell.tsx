import type { ReactNode } from "react";

/** Design A — Acid Climate scope wrapper. Tokens live under [data-design="acid"]. */
export function AcidShell({ children }: { children: ReactNode }) {
  return (
    <div
      data-design="acid"
      className="flex min-h-full flex-col bg-canvas text-ink antialiased"
    >
      {children}
    </div>
  );
}
