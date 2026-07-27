import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: "#FBF9F5",
        color: "#1A1714",
        padding: 64,
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          fontSize: 22,
          letterSpacing: 3.2,
          textTransform: "uppercase",
          color: "#7A2E2E",
          fontWeight: 600,
        }}
      >
        ClearESG · ESRS disclosure
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ fontSize: 56, lineHeight: 1.05, maxWidth: 920 }}>
          Audit-ready ESG disclosure this quarter.
        </div>
        <div style={{ fontSize: 26, color: "#6B635A", maxWidth: 800 }}>
          Collect once. Derive ESRS views. Publish a living report.
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
        <div style={{ fontSize: 48, fontFamily: "monospace", color: "#0E7C4A" }}>72</div>
        <div
          style={{
            fontSize: 14,
            letterSpacing: 2,
            textTransform: "uppercase",
            color: "#6B635A",
          }}
        >
          Overall
        </div>
      </div>
    </div>,
    { ...size },
  );
}
