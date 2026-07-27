/**
 * ClearESG Variant 5 theme reference.
 * Colours live as CSS variables in globals.css — import this for names/spacing only.
 * Org branding can still override --accent via settings.
 */
export const theme = {
  colors: {
    canvas: "var(--canvas)",
    surface1: "var(--surface-1)",
    surface2: "var(--surface-2)",
    ink: "var(--ink)",
    inkMuted: "var(--ink-muted)",
    rule: "var(--rule)",
    accent: "var(--accent)",
    accentHover: "var(--accent-hover)",
    onAccent: "var(--on-accent)",
    signal: "var(--signal)",
    amber: "var(--amber)",
    rust: "var(--rust)",
    cobalt: "var(--cobalt)",
  },
  spacing: {
    sm: "8px",
    md: "16px",
    lg: "24px",
    xl: "32px",
  },
  layout: {
    readinessRail: "320px",
    progressRing: {
      desktop: 140,
      tablet: 120,
      mobile: 100,
    },
  },
  breakpoints: {
    mobileMax: 767,
    tabletMax: 1023,
    desktopMin: 1024,
  },
} as const;
