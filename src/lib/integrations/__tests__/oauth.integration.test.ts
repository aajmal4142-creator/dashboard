import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Payload } from "payload";
import { OAuthBase, type OAuthConfig, type OAuthConnection } from "../oauth.base";

describe("OAuthBase - Core OAuth Flows", () => {
  let oauthService: OAuthBase;
  let mockPayload: Partial<Payload>;

  const mockConfig: OAuthConfig = {
    authUrl: "https://oauth.example.com/authorize",
    tokenUrl: "https://oauth.example.com/token",
    clientId: "test-client-id",
    clientSecret: "test-client-secret",
    redirectUri: "https://app.example.com/callback",
    scope: "api read write",
  };

  beforeEach(() => {
    mockPayload = {
      findByID: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
      create: vi.fn().mockResolvedValue({ id: "test-id" }),
    };

    oauthService = new (class extends OAuthBase {
      constructor(payload: Payload, config: OAuthConfig) {
        super(payload, config, "test-connections");
      }
    })(mockPayload as Payload, mockConfig);
  });

  describe("Authorization URL Generation", () => {
    it("should generate authorization URL with correct parameters", () => {
      const authUrl = oauthService.getAuthUrl("connection-123");

      expect(authUrl).toContain("https://oauth.example.com/authorize?");
      expect(authUrl).toContain("client_id=test-client-id");
      expect(authUrl).toContain("redirect_uri=https%3A%2F%2Fapp.example.com%2Fcallback");
      expect(authUrl).toContain("response_type=code");
      expect(authUrl).toContain("scope=api+read+write");
      expect(authUrl).toContain("state=connection-123");
    });

    it("should use connection ID as state parameter for CSRF prevention", () => {
      const authUrl = oauthService.getAuthUrl("unique-connection-id");
      expect(authUrl).toContain("state=unique-connection-id");
    });
  });

  describe("Token Exchange", () => {
    it("should exchange authorization code for access token", async () => {
      global.fetch = vi.fn().mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: "new-access-token",
            refresh_token: "new-refresh-token",
            expires_in: 3600,
          }),
          { status: 200 },
        ),
      );

      const tokens = await oauthService.exchangeCodeForToken("auth-code-123");

      expect(tokens.accessToken).toBe("new-access-token");
      expect(tokens.refreshToken).toBe("new-refresh-token");
      expect(tokens.expiresAt).toBeDefined();
      expect(new Date(tokens.expiresAt!).getTime()).toBeGreaterThan(Date.now());
    });

    it("should throw error on failed token exchange", async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              error: "invalid_grant",
              error_description: "Invalid authorization code",
            }),
            { status: 400 },
          ),
        );

      await expect(oauthService.exchangeCodeForToken("invalid-code")).rejects.toThrow();
    });

    it("should handle network errors during token exchange", async () => {
      global.fetch = vi.fn().mockRejectedValueOnce(new Error("Network error"));

      await expect(oauthService.exchangeCodeForToken("auth-code")).rejects.toThrow(
        "Network error",
      );
    });
  });

  describe("Token Refresh", () => {
    it("should refresh expired access token", async () => {
      global.fetch = vi.fn().mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: "refreshed-access-token",
            expires_in: 3600,
          }),
          { status: 200 },
        ),
      );

      const tokens = await oauthService.refreshAccessToken("old-refresh-token");

      expect(tokens.accessToken).toBe("refreshed-access-token");
      expect(tokens.refreshToken).toBe("old-refresh-token");
      expect(tokens.expiresAt).toBeDefined();
    });

    it("should detect revoked token (401 response)", async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ error: "invalid_grant" }), { status: 401 }),
        );

      try {
        await oauthService.refreshAccessToken("revoked-token");
        expect.fail("Should have thrown error");
      } catch (err: never) {
        expect(err.type).toBe("token_revoked");
        expect(err.message).toContain("revoked");
      }
    });

    it("should detect revoked token (403 response)", async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ error: "access_denied" }), { status: 403 }),
        );

      try {
        await oauthService.refreshAccessToken("denied-token");
        expect.fail("Should have thrown error");
      } catch (err: never) {
        expect(err.type).toBe("token_revoked");
      }
    });

    it("should retry on 5xx errors with exponential backoff", async () => {
      let callCount = 0;
      global.fetch = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1 || callCount === 2) {
          return new Response(JSON.stringify({ error: "server_error" }), { status: 500 });
        }
        return new Response(JSON.stringify({ access_token: "token", expires_in: 3600 }), {
          status: 200,
        });
      });

      const tokens = await oauthService.refreshAccessToken("refresh-token");
      expect(tokens.accessToken).toBe("token");
      expect(callCount).toBeGreaterThan(1);
    });

    it("should throw after max retry attempts", async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ error: "server_error" }), { status: 500 }),
        );

      try {
        await oauthService.refreshAccessToken("token", "connection-1");
        await oauthService.refreshAccessToken("token", "connection-1");
        await oauthService.refreshAccessToken("token", "connection-1");
        await oauthService.refreshAccessToken("token", "connection-1");
        expect.fail("Should have thrown error");
      } catch (err: never) {
        expect(err.message).toContain("Max token refresh attempts exceeded");
      }
    });
  });

  describe("Token Expiry Detection", () => {
    it("should detect expired token", () => {
      const expiredToken = new Date(Date.now() - 1000).toISOString();
      expect(oauthService.isTokenExpired(expiredToken)).toBe(true);
    });

    it("should detect valid token", () => {
      const validToken = new Date(Date.now() + 3600000).toISOString();
      expect(oauthService.isTokenExpired(validToken)).toBe(false);
    });

    it("should detect token expiring soon", () => {
      const expiringToken = new Date(Date.now() + 60000).toISOString(); // 1 minute
      expect(oauthService.isTokenExpiringSoon(expiringToken)).toBe(true);
    });

    it("should not flag token expiring in far future", () => {
      const futureToken = new Date(Date.now() + 7200000).toISOString(); // 2 hours
      expect(oauthService.isTokenExpiringSoon(futureToken)).toBe(false);
    });
  });

  describe("Automatic Token Refresh", () => {
    it("should refresh token before API call if expiring soon", async () => {
      const connection: OAuthConnection = {
        id: "conn-1",
        accessToken: "old-token",
        refreshToken: "refresh-token",
        expiresAt: new Date(Date.now() + 120000).toISOString(), // 2 minutes
        status: "connected",
      };

      (mockPayload.findByID as never).mockResolvedValueOnce(connection);
      (mockPayload.update as never).mockResolvedValueOnce({});

      global.fetch = vi
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ access_token: "new-token", expires_in: 3600 }), {
            status: 200,
          }),
        );

      const token = await oauthService.ensureValidToken(connection);

      expect(token).toBe("new-token");
      expect(mockPayload.update).toHaveBeenCalledWith(
        expect.objectContaining({
          collection: "test-connections",
          id: "conn-1",
          data: expect.objectContaining({
            accessToken: "new-token",
            status: "connected",
          }),
        }),
      );
    });

    it("should return existing token if still valid", async () => {
      const connection: OAuthConnection = {
        id: "conn-1",
        accessToken: "valid-token",
        refreshToken: "refresh-token",
        expiresAt: new Date(Date.now() + 7200000).toISOString(), // 2 hours
        status: "connected",
      };

      const token = await oauthService.ensureValidToken(connection);

      expect(token).toBe("valid-token");
      expect(mockPayload.update).not.toHaveBeenCalled();
    });

    it("should mark connection as revoked on token refresh failure", async () => {
      const connection: OAuthConnection = {
        id: "conn-1",
        accessToken: "old-token",
        refreshToken: "revoked-token",
        expiresAt: new Date(Date.now() + 60000).toISOString(),
        status: "connected",
      };

      global.fetch = vi
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ error: "invalid_grant" }), { status: 401 }),
        );

      try {
        await oauthService.ensureValidToken(connection);
        expect.fail("Should have thrown error");
      } catch {
        expect(mockPayload.update).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              status: "revoked",
            }),
          }),
        );
      }
    });
  });

  describe("Error Handling", () => {
    it("should identify OAuth errors correctly", () => {
      const error = {
        type: "invalid_grant" as const,
        message: "Invalid authorization code",
        retryable: false,
      };

      expect(oauthService.isOAuthError(error)).toBe(true);
    });

    it("should not identify non-OAuth errors", () => {
      const error = new Error("Some other error");
      expect(oauthService.isOAuthError(error)).toBe(false);
    });
  });
});

describe("OAuth Rate Limiting", () => {
  it("should handle rate limit error with Retry-After header", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "rate_limit" }), {
        status: 429,
        headers: { "Retry-After": "60" },
      }),
    );

    const mockPayload = { findByID: vi.fn(), update: vi.fn() } as never;
    const config: OAuthConfig = {
      authUrl: "https://oauth.example.com/authorize",
      tokenUrl: "https://oauth.example.com/token",
      clientId: "test",
      clientSecret: "secret",
      redirectUri: "https://app.example.com/callback",
      scope: "api",
    };

    const oauth = new (class extends OAuthBase {
      constructor(payload: Payload, config: OAuthConfig) {
        super(payload, config, "test-connections");
      }
    })(mockPayload, config);

    try {
      await oauth.exchangeCodeForToken("code");
      expect.fail("Should have thrown");
    } catch (err: never) {
      expect(err.type).toBe("rate_limit");
    }
  });
});
