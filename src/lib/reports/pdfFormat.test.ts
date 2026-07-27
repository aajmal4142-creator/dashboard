import { describe, expect, it } from "vitest";

import { formatScore, formatTco2e, reportFrameworkLabel } from "./pdfFormat";

describe("pdfFormat", () => {
  it("formats noisy floats for print", () => {
    expect(formatTco2e(0.09799994000000001)).toBe("0.098");
    expect(formatTco2e(0)).toBe("0.00");
    expect(formatTco2e(12.3456)).toBe("12.35");
  });

  it("rounds scores", () => {
    expect(formatScore(45.2)).toBe("45");
  });

  it("humanises framework codes", () => {
    expect(reportFrameworkLabel("CSRD_SIMPLIFIED")).toBe("CSRD (simplified)");
  });
});
