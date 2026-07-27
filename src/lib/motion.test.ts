import { describe, expect, it } from "vitest";

import {
  heroStage,
  houseSpring,
  inkEase,
  inkSettleTransition,
  pageLayer,
  ruleDrawTransition,
  spring,
  springSnap,
  springSoft,
} from "@/lib/motion";

describe("motion layer", () => {
  it("exports house / soft / snap springs", () => {
    expect(spring).toEqual({ type: "spring", stiffness: 260, damping: 30 });
    expect(springSoft.stiffness).toBe(180);
    expect(springSnap.stiffness).toBe(400);
    expect(houseSpring).toEqual(spring);
  });

  it("keeps chrome → structure → data layer delays", () => {
    expect(pageLayer.chrome).toBe(0);
    expect(pageLayer.structure).toBe(0.04);
    expect(pageLayer.data).toBe(0.08);
  });

  it("stages hero print order", () => {
    expect(heroStage.chromeRules).toBeLessThan(heroStage.masthead);
    expect(heroStage.masthead).toBeLessThan(heroStage.gauge);
    expect(heroStage.gauge).toBeLessThan(heroStage.primaryMetric);
  });

  it("uses authoritative ink / rule transitions (400–600ms rules)", () => {
    expect(inkEase).toEqual([0.22, 1, 0.36, 1]);
    expect(inkSettleTransition.duration).toBe(0.45);
    expect(ruleDrawTransition.duration).toBeGreaterThanOrEqual(0.4);
    expect(ruleDrawTransition.duration).toBeLessThanOrEqual(0.6);
  });
});
