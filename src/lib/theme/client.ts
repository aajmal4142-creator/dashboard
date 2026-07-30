"use client";

import { useSyncExternalStore } from "react";

import { THEME_COOKIE, type Theme } from "@/lib/theme";

const listeners = new Set<() => void>();

function emitThemeChange() {
  for (const listener of listeners) listener();
}

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
}

function readTheme(): Theme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.getAttribute("data-theme") === "dark"
    ? "dark"
    : "light";
}

/** Apply theme to document + cookie. Light is default; dark is opt-in only. */
export function applyTheme(theme: Theme) {
  const maxAge = 60 * 60 * 24 * 365;
  document.cookie = `${THEME_COOKIE}=${theme}; path=/; max-age=${maxAge}; SameSite=Lax`;
  document.documentElement.setAttribute("data-theme", theme);
  document.documentElement.style.colorScheme = theme === "dark" ? "dark" : "light";

  const root = document.documentElement;
  root.classList.add("theme-animating");
  window.setTimeout(() => root.classList.remove("theme-animating"), 220);

  emitThemeChange();
}

/** Live document theme for client UI (toggle, toasts). SSR snapshot is light. */
export function useDocumentTheme(): Theme {
  return useSyncExternalStore(subscribe, readTheme, () => "light" as const);
}
