export type ShortcutId =
  "search" | "save" | "close" | "help" | "newDatapoint" | "newReport" | "toggleSidebar";

export type ShortcutChord = {
  /** Lowercase letter, `/`, `\\`, or `escape`. */
  key: string;
  /** True when Cmd (Mac) or Ctrl (Win/Linux) must be held. */
  metaOrCtrl: boolean;
};

export type ShortcutDefinition = {
  id: ShortcutId;
  label: string;
  context: string;
  chord: ShortcutChord;
  /** When true, fires even inside input/textarea/contenteditable. */
  allowInEditable: boolean;
  preventDefault: boolean;
};
