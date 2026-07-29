import { describe, it, expect } from "vitest";
import { evaluatePolicy, mergeCapabilities } from "./evaluator";
import type { EffectiveCapabilities, Capability } from "./types";

describe("ABAC Policy Evaluator", () => {
  const mockCapabilities = (capabilities: Capability[]): EffectiveCapabilities => {
    const map = new Map<string, Capability>();
    capabilities.forEach((cap) => {
      map.set(`${cap.action}:${cap.resource}`, cap);
    });

    return {
      capabilities: map,
      roleId: "role-123",
      roleName: "TestRole",
    };
  };

  describe("evaluatePolicy", () => {
    it("should allow view action when capability exists", () => {
      const caps = mockCapabilities([
        { action: "view", resource: "datapoint", scope: "organisation" },
      ]);

      const result = evaluatePolicy(caps, "view", "datapoint", "organisation");
      expect(result.decision).toBe("allowed");
    });

    it("should deny action when capability does not exist", () => {
      const caps = mockCapabilities([]);

      const result = evaluatePolicy(caps, "view", "datapoint");
      expect(result.decision).toBe("denied");
      expect(result.reason).toContain("does not have permission");
    });

    it("should deny revoked capability", () => {
      const caps = mockCapabilities([
        {
          action: "edit",
          resource: "datapoint",
          scope: "organisation",
          isGrant: false,
        },
      ]);

      const result = evaluatePolicy(caps, "edit", "datapoint");
      expect(result.decision).toBe("denied");
      expect(result.reason).toContain("explicitly revoked");
    });

    it("should respect scope: 'all' allows any scope", () => {
      const caps = mockCapabilities([
        { action: "view", resource: "datapoint", scope: "all" },
      ]);

      expect(evaluatePolicy(caps, "view", "datapoint", "own").decision).toBe("allowed");
      expect(evaluatePolicy(caps, "view", "datapoint", "team").decision).toBe("allowed");
      expect(evaluatePolicy(caps, "view", "datapoint", "organisation").decision).toBe(
        "allowed",
      );
      expect(evaluatePolicy(caps, "view", "datapoint", "all").decision).toBe("allowed");
    });

    it("should respect scope: 'organisation' allows org and below", () => {
      const caps = mockCapabilities([
        { action: "edit", resource: "report", scope: "organisation" },
      ]);

      expect(evaluatePolicy(caps, "edit", "report", "organisation").decision).toBe(
        "allowed",
      );
      expect(evaluatePolicy(caps, "edit", "report", "all").decision).toBe("allowed");
      expect(evaluatePolicy(caps, "edit", "report", "own").decision).toBe("denied");
    });

    it("should respect scope: 'team' allows team and below", () => {
      const caps = mockCapabilities([
        { action: "delete", resource: "evidence", scope: "team" },
      ]);

      expect(evaluatePolicy(caps, "delete", "evidence", "team").decision).toBe("allowed");
      expect(evaluatePolicy(caps, "delete", "evidence", "organisation").decision).toBe(
        "allowed",
      );
      expect(evaluatePolicy(caps, "delete", "evidence", "own").decision).toBe("denied");
    });

    it("should respect scope: 'own' only allows own scope", () => {
      const caps = mockCapabilities([
        { action: "edit", resource: "datapoint", scope: "own" },
      ]);

      expect(evaluatePolicy(caps, "edit", "datapoint", "own").decision).toBe("allowed");
      expect(evaluatePolicy(caps, "edit", "datapoint", "team").decision).toBe("denied");
      expect(evaluatePolicy(caps, "edit", "datapoint", "organisation").decision).toBe(
        "denied",
      );
    });
  });

  describe("mergeCapabilities", () => {
    it("should start with role defaults", () => {
      const defaults: Capability[] = [
        { action: "view", resource: "datapoint", scope: "organisation" },
        { action: "create", resource: "datapoint", scope: "organisation" },
      ];

      const merged = mergeCapabilities(defaults, []);

      expect(merged.size).toBe(2);
      expect(merged.get("view:datapoint")).toBeDefined();
      expect(merged.get("create:datapoint")).toBeDefined();
    });

    it("should override with custom capabilities", () => {
      const defaults: Capability[] = [
        { action: "view", resource: "datapoint", scope: "organisation" },
      ];

      const custom: Capability[] = [
        { action: "view", resource: "datapoint", scope: "all", isGrant: true },
      ];

      const merged = mergeCapabilities(defaults, custom);

      expect(merged.size).toBe(1);
      const cap = merged.get("view:datapoint");
      expect(cap?.scope).toBe("all");
    });

    it("should add new capabilities from custom", () => {
      const defaults: Capability[] = [
        { action: "view", resource: "datapoint", scope: "organisation" },
      ];

      const custom: Capability[] = [
        { action: "manage-policies", resource: "policy", scope: "organisation" },
      ];

      const merged = mergeCapabilities(defaults, custom);

      expect(merged.size).toBe(2);
      expect(merged.get("manage-policies:policy")).toBeDefined();
    });

    it("should remove capabilities marked with isGrant=false", () => {
      const defaults: Capability[] = [
        { action: "view", resource: "datapoint", scope: "organisation" },
        { action: "edit", resource: "datapoint", scope: "organisation" },
      ];

      const custom: Capability[] = [
        { action: "edit", resource: "datapoint", scope: "all", isGrant: false },
      ];

      const merged = mergeCapabilities(defaults, custom);

      expect(merged.size).toBe(1);
      expect(merged.get("view:datapoint")).toBeDefined();
      expect(merged.get("edit:datapoint")).toBeUndefined();
    });

    it("should handle complex override scenarios", () => {
      const defaults: Capability[] = [
        { action: "view", resource: "datapoint", scope: "organisation" },
        { action: "create", resource: "datapoint", scope: "organisation" },
        { action: "edit", resource: "datapoint", scope: "own" },
        { action: "delete", resource: "datapoint", scope: "organisation" },
      ];

      const custom: Capability[] = [
        {
          action: "edit",
          resource: "datapoint",
          scope: "organisation",
          isGrant: true,
        },
        {
          action: "delete",
          resource: "datapoint",
          scope: "all",
          isGrant: false,
        },
        {
          action: "approve",
          resource: "datapoint",
          scope: "organisation",
          isGrant: true,
        },
      ];

      const merged = mergeCapabilities(defaults, custom);

      expect(merged.size).toBe(4); // view, create, edit, approve
      expect(merged.get("edit:datapoint")?.scope).toBe("organisation");
      expect(merged.get("delete:datapoint")).toBeUndefined();
      expect(merged.get("approve:datapoint")).toBeDefined();
    });
  });
});
