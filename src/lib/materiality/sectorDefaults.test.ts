import { describe, expect, it } from "vitest";

import { naceLetter, sectorDefaults, topicOriginAgainstDefault } from "./sectorDefaults";

describe("sectorDefaults", () => {
  it("returns one row per ESRS topic", () => {
    const rows = sectorDefaults("C10.1");
    expect(rows.length).toBeGreaterThanOrEqual(10);
    expect(rows.every((r) => r.esrsTopic && r.rationale)).toBe(true);
  });

  it("elevates E1 for manufacturing (NACE C)", () => {
    const e1 = sectorDefaults("C").find((r) => r.esrsTopic === "E1");
    expect(e1?.impactSeverity).toBeGreaterThanOrEqual(3);
  });

  it("parses NACE letter from code", () => {
    expect(naceLetter("H49.4")).toBe("H");
    expect(naceLetter("")).toBe("C");
  });
});

describe("topicOriginAgainstDefault", () => {
  it("suggested when unchanged", () => {
    const [row] = sectorDefaults("C");
    expect(topicOriginAgainstDefault(row, row)).toBe("suggested");
  });

  it("adjusted when a score changes", () => {
    const [row] = sectorDefaults("C");
    expect(
      topicOriginAgainstDefault({ ...row, impactSeverity: row.impactSeverity + 1 }, row),
    ).toBe("adjusted");
  });
});
