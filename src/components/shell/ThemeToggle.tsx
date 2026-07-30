"use client";

import { MoonIcon, SunIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { applyTheme, useDocumentTheme } from "@/lib/theme/client";
import { cn } from "@/lib/utils";

type ThemeToggleProps = {
  className?: string;
};

/** shadcn-style sun/moon theme toggle. */
export function ThemeToggle({ className }: ThemeToggleProps) {
  const theme = useDocumentTheme();
  const isDark = theme === "dark";

  return (
    <Button
      type="button"
      variant="outline"
      size="icon-sm"
      onClick={() => applyTheme(isDark ? "light" : "dark")}
      className={cn(
        "relative size-8 shrink-0 rounded-full border-rule bg-surface-1 text-ink shadow-none",
        "hover:bg-surface-2 hover:text-ink",
        className,
      )}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Light mode" : "Dark mode"}
    >
      {isDark ? (
        <SunIcon className="size-4" aria-hidden />
      ) : (
        <MoonIcon className="size-4" aria-hidden />
      )}
    </Button>
  );
}
