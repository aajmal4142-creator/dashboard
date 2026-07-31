"use client";

import { useEffect, useRef } from "react";

import { DEFAULT_SHORTCUTS, matchShortcut, type ShortcutId } from "@/lib/keyboard";

export type KeyboardShortcutHandlers = Partial<Record<ShortcutId, () => void>>;

/**
 * Global keydown listener backed by the default shortcut registry.
 * Mount once from AppShell (or a provider). Handlers are looked up by shortcut id.
 */
export function useKeyboardShortcuts(
  handlers: KeyboardShortcutHandlers,
  opts: { enabled?: boolean } = {},
): void {
  const enabled = opts.enabled ?? true;
  const handlersRef = useRef(handlers);

  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (event: KeyboardEvent) => {
      const matched = matchShortcut(event, DEFAULT_SHORTCUTS);
      if (!matched) return;

      const handler = handlersRef.current[matched.id];
      if (!handler) return;

      if (matched.preventDefault) {
        event.preventDefault();
      }
      handler();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled]);
}
