import { describe, expect, it } from "vitest";

import { cn } from "@/lib/utils";
import { houseSpring, spring, springSnap, springSoft } from "@/lib/motion";

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });
});

describe("spring", () => {
  it("exports house / soft / snap springs", () => {
    expect(spring).toEqual({ type: "spring", stiffness: 260, damping: 30 });
    expect(springSoft.stiffness).toBe(180);
    expect(springSnap.stiffness).toBe(400);
  });
});

describe("houseSpring", () => {
  it("aliases the house spring", () => {
    expect(houseSpring).toEqual(spring);
  });
});
