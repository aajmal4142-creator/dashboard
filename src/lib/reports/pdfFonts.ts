import path from "node:path";

import { Font } from "@react-pdf/renderer";

let registered = false;

/** Register ClearESG print fonts once per process (React-PDF). */
export function registerReportPdfFonts(): void {
  if (registered) return;
  const dir = path.join(process.cwd(), "src/lib/reports/fonts");
  const fraunces = path.join(dir, "Fraunces-Variable.ttf");
  Font.register({
    family: "Fraunces",
    fonts: [
      { src: fraunces, fontWeight: 400 },
      { src: fraunces, fontWeight: 600 },
    ],
  });
  Font.register({
    family: "Inter",
    fonts: [
      { src: path.join(dir, "Inter-Regular.ttf"), fontWeight: 400 },
      { src: path.join(dir, "Inter-Medium.ttf"), fontWeight: 500 },
    ],
  });
  Font.register({
    family: "JetBrainsMono",
    fonts: [
      { src: path.join(dir, "JetBrainsMono-Regular.ttf"), fontWeight: 400 },
      { src: path.join(dir, "JetBrainsMono-Medium.ttf"), fontWeight: 500 },
    ],
  });
  registered = true;
}
