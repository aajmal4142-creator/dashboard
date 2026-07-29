import { describe, it, expect, vi, beforeEach } from "vitest";
import { SAPService } from "./sap";
import type { Payload } from "payload";

describe("SAPService", () => {
  let sapService: SAPService;
  let mockPayload: Partial<Payload>;

  beforeEach(() => {
    mockPayload = {
      findByID: vi.fn().mockResolvedValue({
        id: "test-connection",
        accessToken: "test-token",
        refreshToken: "refresh-token",
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        syncConfig: {
          enableGlSync: true,
          enableBomSync: true,
          enableProductionSync: true,
          trackingMaterials: ["MAT001", "MAT002"],
        },
      }),
      update: vi.fn().mockResolvedValue({}),
      create: vi.fn().mockResolvedValue({ id: "datapoint-1" }),
    };

    sapService = new SAPService(
      mockPayload as Payload,
      "client-id",
      "client-secret",
      "https://redirect.uri",
    );
  });

  it("should generate OAuth authorization URL", () => {
    const url = sapService.getAuthUrl("connection-123");
    expect(url).toContain("https://oauth.sapfioritrial.com/oauth/authorize");
    expect(url).toContain("client_id=client-id");
    expect(url).toContain("state=connection-123");
  });

  it("should exchange code for token", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          access_token: "new-token",
          refresh_token: "new-refresh-token",
          expires_in: 3600,
        }),
      ),
    );

    const tokens = await sapService.exchangeCodeForToken("auth-code");

    expect(tokens.accessToken).toBe("new-token");
    expect(tokens.refreshToken).toBe("new-refresh-token");
    expect(tokens.expiresAt).toBeDefined();
  });

  it("should sync SAP data", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          orders: [
            {
              orderID: "ORD001",
              material: "MAT001",
              plannedQuantity: 100,
              orderUnit: "pieces",
              duration: 8,
              startDate: "2026-07-29",
              completionDate: "2026-07-30",
              status: "running",
            },
          ],
        }),
      ),
    );

    const result = await sapService.syncData("test-connection", "org-1", "period-1");

    expect(result.status).toBe("success");
    expect(result.recordsProcessed).toBeGreaterThan(0);
  });

  it("should handle sync errors gracefully", async () => {
    mockPayload.findByID = vi.fn().mockResolvedValueOnce({
      id: "test-connection",
      // Missing accessToken
    });

    const result = await sapService.syncData("test-connection", "org-1", "period-1");

    expect(result.status).toBe("failed");
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
