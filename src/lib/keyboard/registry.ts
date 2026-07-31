import type { ShortcutDefinition } from "@/lib/keyboard/types";

/** Default ClearESG app shortcuts (local; not user-persisted for F2). */
export const DEFAULT_SHORTCUTS: readonly ShortcutDefinition[] = [
  {
    id: "search",
    label: "Open search / command palette",
    context: "Everywhere",
    chord: { key: "k", metaOrCtrl: true },
    allowInEditable: false,
    preventDefault: true,
  },
  {
    id: "save",
    label: "Save datapoint",
    context: "Datapoint edit",
    chord: { key: "s", metaOrCtrl: true },
    allowInEditable: true,
    preventDefault: true,
  },
  {
    id: "close",
    label: "Close modal / palette / help / tour",
    context: "Modal open",
    chord: { key: "escape", metaOrCtrl: false },
    allowInEditable: true,
    preventDefault: false,
  },
  {
    id: "help",
    label: "Open help (shortcuts, tours, FAQ)",
    context: "Everywhere",
    chord: { key: "/", metaOrCtrl: true },
    allowInEditable: false,
    preventDefault: true,
  },
  {
    id: "newDatapoint",
    label: "New datapoint (Metrics)",
    context: "Everywhere",
    chord: { key: "n", metaOrCtrl: true },
    allowInEditable: false,
    preventDefault: true,
  },
  {
    id: "newReport",
    label: "New report",
    context: "Everywhere",
    chord: { key: "r", metaOrCtrl: true },
    allowInEditable: false,
    preventDefault: true,
  },
  {
    id: "toggleSidebar",
    label: "Toggle sidebar",
    context: "Everywhere",
    chord: { key: "\\", metaOrCtrl: true },
    allowInEditable: false,
    preventDefault: true,
  },
] as const;

export function shortcutById(
  id: ShortcutDefinition["id"],
  registry: readonly ShortcutDefinition[] = DEFAULT_SHORTCUTS,
): ShortcutDefinition | undefined {
  return registry.find((s) => s.id === id);
}
