"use client";

import { HelpCenterModal } from "@/components/help/HelpCenterModal";

/**
 * F2 shortcuts help — now opens the tabbed Help center on the Shortcuts tab.
 * Prefer HelpCenterModal for new call sites.
 */
export function ShortcutsHelpModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <HelpCenterModal open={open} onOpenChange={onOpenChange} initialTab="shortcuts" />
  );
}
