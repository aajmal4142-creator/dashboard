import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Apple touch icon — ClearESG teal C. */
export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0F766E",
        color: "#FFFFFF",
        fontSize: 110,
        fontWeight: 700,
        fontFamily: "system-ui, sans-serif",
        letterSpacing: "-0.04em",
        borderRadius: 36,
      }}
    >
      C
    </div>,
    { ...size },
  );
}
