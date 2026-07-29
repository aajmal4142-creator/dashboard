import { describe, it, expect, beforeEach, vi } from "vitest";
import { EcoVadisOAuthManager } from "./oauth";

// Mock fetch globally
global.fetch = vi.fn();

const mockFetch = vi.mocked(global.fetch);

describe("EcoVadisOAuthManager", () => {
  let manager: EcoVadisOAuthManager;

  beforeEach(() => {
    manager = new EcoVadisOAuthManager(
      "test-client-id",
      "test-client-secret",
      "http://localhost:3000/callback",
    );
    vi.clearAllMocks();
  });

  describe("exchangeAuthCode", () => {
    it("exchanges authorization code for token", async () => {
      const mockResponse = {
        access_token: "test-access-token",
        refresh_token: "test-refresh-token",
        expires_in: 3600,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await manager.exchangeAuthCode("test-code");

      expect(result.accessToken).toBe("test-access-token");
      expect(result.refreshToken).toBe("test-refresh-token");
      expect(result.expiresAt).toBeInstanceOf(Date);
      expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it("throws on failed exchange", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: async () => "Invalid code",
      } as Response);

      await expect(manager.exchangeAuthCode("invalid-code")).rejects.toThrow(
        "EcoVadis OAuth exchange failed",
      );
    });
  });

  describe("refreshAccessToken", () => {
    it("refreshes expired access token", async () => {
      const mockResponse = {
        access_token: "new-access-token",
        refresh_token: "new-refresh-token",
        expires_in: 3600,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await manager.refreshAccessToken("old-refresh-token");

      expect(result.accessToken).toBe("new-access-token");
      expect(result.refreshToken).toBe("new-refresh-token");
    });

    it("throws on refresh failure", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: async () => "Invalid refresh token",
      } as Response);

      await expect(manager.refreshAccessToken("bad-token")).rejects.toThrow(
        "EcoVadis refresh failed",
      );
    });
  });

  describe("fetchSuppliers", () => {
    it("fetches suppliers with pagination", async () => {
      const mockResponse = {
        suppliers: [
          { id: "1", businessName: "Acme Corp", email: "acme@example.com" },
          { id: "2", businessName: "Beta Inc", email: "beta@example.com" },
        ],
        total: 2,
        page: 0,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await manager.fetchSuppliers("test-token", 0, 100);

      expect(result.suppliers).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(0);
    });

    it("throws on API error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => "Unauthorized",
      } as Response);

      await expect(manager.fetchSuppliers("invalid-token", 0, 100)).rejects.toThrow(
        "EcoVadis API error",
      );
    });
  });

  describe("fetchSupplierScores", () => {
    it("fetches supplier scores", async () => {
      const mockResponse = {
        supplierId: "1",
        score: 75,
        assessmentDate: "2024-01-15",
        trend: "improving",
        categories: {
          environment: 80,
          labor: 70,
          ethics: 75,
          procurement: 70,
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await manager.fetchSupplierScores("test-token", "1");

      expect(result.score).toBe(75);
      expect(result.categories.environment).toBe(80);
    });
  });

  describe("getAuthorizationUrl", () => {
    it("generates correct OAuth authorization URL", () => {
      const url = manager.getAuthorizationUrl("test-state");

      expect(url).toContain("https://api.ecovadis.com/oauth/v2/auth");
      expect(url).toContain("client_id=test-client-id");
      expect(url).toContain("redirect_uri=http://localhost:3000/callback");
      expect(url).toContain("state=test-state");
      expect(url).toContain("response_type=code");
    });
  });
});
