import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

/** ClearESG favicon — teal mark with C. */
export default function Icon() {
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
        fontSize: 20,
        fontWeight: 700,
        fontFamily: "system-ui, sans-serif",
        letterSpacing: "-0.04em",
      }}
    >
      C
    </div>,
    { ...size },
  );
}
