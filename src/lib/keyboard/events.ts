/** Dispatched when Cmd/Ctrl+S should save the active datapoint row. */
export const SAVE_DATAPOINT_EVENT = "clearesg:save-datapoint";

/** Dispatched when Cmd/Ctrl+\\ should toggle the app sidebar. */
export const TOGGLE_SIDEBAR_EVENT = "clearesg:toggle-sidebar";

export function dispatchSaveDatapoint(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(SAVE_DATAPOINT_EVENT));
}

export function dispatchToggleSidebar(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(TOGGLE_SIDEBAR_EVENT));
}
