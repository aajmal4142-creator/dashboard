"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "clearesg-sidebar";
const COLLAPSED_W = 64;
const MIN_W = 200;
const MAX_W = 320;
const SNAP_W = 120;
const DEFAULT_W = 240;

type Stored = { collapsed: boolean; width: number };

function readStored(): Stored {
  if (typeof window === "undefined") {
    return { collapsed: false, width: DEFAULT_W };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { collapsed: false, width: DEFAULT_W };
    const parsed = JSON.parse(raw) as Partial<Stored>;
    const width = Math.min(MAX_W, Math.max(MIN_W, Number(parsed.width) || DEFAULT_W));
    return { collapsed: Boolean(parsed.collapsed), width };
  } catch {
    return { collapsed: false, width: DEFAULT_W };
  }
}

function writeStored(state: Stored) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore quota */
  }
}

export function useSidebarChrome() {
  const [collapsed, setCollapsed] = useState(false);
  const [width, setWidth] = useState(DEFAULT_W);
  const [dragging, setDragging] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const dragStartX = useRef(0);
  const dragStartW = useRef(DEFAULT_W);

  useEffect(() => {
    void Promise.resolve().then(() => {
      const s = readStored();
      setCollapsed(s.collapsed);
      setWidth(s.width);
      setHydrated(true);
    });
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    writeStored({ collapsed, width });
  }, [collapsed, width, hydrated]);

  const toggle = useCallback(() => {
    setCollapsed((c) => !c);
  }, []);

  const expand = useCallback(() => {
    setCollapsed(false);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "[") return;
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
      setCollapsed((c) => !c);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const onDragStart = useCallback(
    (clientX: number) => {
      setDragging(true);
      dragStartX.current = clientX;
      dragStartW.current = collapsed ? COLLAPSED_W : width;
      if (collapsed) {
        setCollapsed(false);
        dragStartW.current = MIN_W;
      }
    },
    [collapsed, width],
  );

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: PointerEvent) => {
      const delta = e.clientX - dragStartX.current;
      const next = dragStartW.current + delta;
      setWidth(Math.min(MAX_W, Math.max(COLLAPSED_W, next)));
    };
    const onUp = () => {
      setDragging(false);
      setWidth((w) => {
        if (w < SNAP_W) {
          setCollapsed(true);
          return MIN_W;
        }
        setCollapsed(false);
        return Math.min(MAX_W, Math.max(MIN_W, w));
      });
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [dragging]);

  const effectiveWidth = collapsed ? COLLAPSED_W : width;

  return {
    collapsed,
    width: effectiveWidth,
    expandedWidth: width,
    dragging,
    hydrated,
    toggle,
    expand,
    onDragStart,
    COLLAPSED_W,
  };
}
