"use client";

import { Command } from "cmdk";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "nextjs-toploader/app";

import { buildNavGroups } from "@/components/shell/navConfig";

export function CommandPalette({
  orgType,
  onboarded,
  open: openProp,
  onOpenChange,
}: {
  orgType: "company" | "consultancy" | null;
  onboarded: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = openProp ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const router = useRouter();
  const groups = useMemo(
    () => buildNavGroups({ orgType, onboarded }),
    [orgType, onboarded],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(!open);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80]">
      <button
        type="button"
        className="absolute inset-0 bg-ink/30"
        aria-label="Close command palette"
        onClick={() => setOpen(false)}
      />
      <div className="relative mx-auto mt-[12vh] w-full max-w-lg px-4">
        <Command
          className="overflow-hidden rounded-[6px] border border-rule bg-surface-1 shadow-[0_16px_40px_-20px_rgba(26,23,20,0.35)]"
          label="Command palette"
        >
          <Command.Input
            placeholder="Go to…"
            className="w-full border-b border-rule bg-transparent px-4 py-3 text-sm text-ink outline-none placeholder:text-ink-muted"
            autoFocus
          />
          <Command.List className="max-h-72 overflow-y-auto p-2">
            <Command.Empty className="px-3 py-6 text-center text-sm text-ink-muted">
              No matches.
            </Command.Empty>
            {groups.map((group) => (
              <Command.Group
                key={group.id}
                heading={group.label}
                className="[&_[cmdk-group-heading]]:label-caps [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:text-ink-muted"
              >
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Command.Item
                      key={item.href}
                      value={`${item.label} ${group.label}`}
                      onSelect={() => {
                        setOpen(false);
                        router.push(item.href);
                      }}
                      className="flex cursor-pointer items-center gap-2 rounded-[4px] px-2 py-2 text-sm text-ink aria-selected:bg-accent aria-selected:text-canvas"
                    >
                      <Icon className="size-4 text-ink-muted" aria-hidden />
                      {item.label}
                    </Command.Item>
                  );
                })}
              </Command.Group>
            ))}
          </Command.List>
          <div className="border-t border-rule px-3 py-2 text-[11px] text-ink-muted">
            <span className="font-data">⌘K</span> /{" "}
            <span className="font-data">Ctrl+K</span> to toggle
          </div>
        </Command>
      </div>
    </div>
  );
}
