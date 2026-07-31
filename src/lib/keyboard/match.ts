import type { ShortcutChord, ShortcutDefinition } from "@/lib/keyboard/types";

/** Normalize KeyboardEvent.key for matching against registry chords. */
export function normalizeKey(key: string): string {
  if (key === "Escape") return "escape";
  if (key.length === 1) return key.toLowerCase();
  return key.toLowerCase();
}

export function isMacPlatform(userAgent = ""): boolean {
  return /Mac|iPhone|iPad|iPod/i.test(userAgent);
}

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  if (target.closest("[contenteditable='true']")) return true;
  return false;
}

/** cmdk search field — allow Cmd+K to toggle the palette while focused there. */
export function isCommandPaletteInput(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  return Boolean(
    target.closest("[cmdk-input]") || target.getAttribute("cmdk-input") != null,
  );
}

export function matchesChord(event: KeyboardEvent, chord: ShortcutChord): boolean {
  const key = normalizeKey(event.key);
  if (key !== chord.key) return false;

  if (chord.metaOrCtrl) {
    if (!(event.metaKey || event.ctrlKey)) return false;
    // Require exactly the modifier combo (ignore Alt / Shift chord variants).
    if (event.altKey) return false;
    return true;
  }

  if (event.metaKey || event.ctrlKey || event.altKey) return false;
  return true;
}

export function shouldIgnoreShortcut(
  event: KeyboardEvent,
  def: Pick<ShortcutDefinition, "id" | "allowInEditable">,
): boolean {
  if (def.allowInEditable) return false;
  if (!isEditableTarget(event.target)) return false;
  if (def.id === "search" && isCommandPaletteInput(event.target)) return false;
  return true;
}

/** Human-readable chord for UI hints (Mac vs Win/Linux). */
export function formatShortcutLabel(
  chord: ShortcutChord,
  platform: "mac" | "win" = "mac",
): string {
  const keyLabel = chord.key === "escape" ? "Esc" : chord.key.toUpperCase();
  if (!chord.metaOrCtrl) return keyLabel;
  if (platform === "mac") {
    if (chord.key === "/") return "⌘/";
    if (chord.key === "\\") return "⌘\\";
    return `⌘${keyLabel}`;
  }
  if (chord.key === "/") return "Ctrl+/";
  if (chord.key === "\\") return "Ctrl+\\";
  return `Ctrl+${keyLabel}`;
}

export function detectShortcutPlatform(
  userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "",
): "mac" | "win" {
  return isMacPlatform(userAgent) ? "mac" : "win";
}

/** Find the first matching shortcut in a registry for a keydown event. */
export function matchShortcut(
  event: KeyboardEvent,
  registry: readonly ShortcutDefinition[],
): ShortcutDefinition | undefined {
  for (const def of registry) {
    if (!matchesChord(event, def.chord)) continue;
    if (shouldIgnoreShortcut(event, def)) continue;
    return def;
  }
  return undefined;
}
