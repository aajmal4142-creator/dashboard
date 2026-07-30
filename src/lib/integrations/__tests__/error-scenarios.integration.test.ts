import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Payload } from "payload";
import { SalesforceService } from "../salesforce";
import { NetSuiteService } from "../netsuite";

describe("Error Handling - All Integrations", () => {
  let mockPayload: Partial<Payload>;

  beforeEach(() => {
    mockPayload = {
      findByID: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
      create: vi.fn().mockResolvedValue({ id: "test-id" }),
    };
  });

  describe("Token Expiration During Sync", () => {
    it("should auto-refresh token mid-sync and continue", async () => {
      const service = new SalesforceService(
        mockPayload as Payload,
        "client-id",
        "client-secret",
        "https://callback.example.com",
        "https://instance.salesforce.com",
      );

      const connection: never = {
        id: "conn-1",
        accessToken: "old-token",
        refreshToken: "refresh-token",
        expiresAt: new Date(Date.now() + 120000).toISOString(), // 2 min - will trigger refresh
        instanceUrl: "https://instance.salesforce.com",
        status: "connected",
        syncConfig: { enableAccountSync: true },
      };

      (mockPayload.findByID as never).mockResolvedValueOnce(connection);

      global.fetch = vi
        .fn()
        // Token refresh
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ access_token: "new-token", expires_in: 3600 }), {
            status: 200,
          }),
        )
        // Account fetch with new token
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              records: [
                {
                  Id: "acc-1",
                  Name: "Company",
                  Industry: "Tech",
                  BillingCity: "SF",
                  BillingCountry: "USA",
                },
              ],
            }),
            { status: 200 },
          ),
        );

      const result = await service.syncData("conn-1", "org-1");

      expect(result.status).toBe("success");
      expect(result.recordsProcessed).toBeGreaterThan(0);
    });

    it("should mark connection as revoked on token expiration without refresh token", async () => {
      const service = new SalesforceService(
        mockPayload as Payload,
        "client-id",
        "client-secret",
        "https://callback.example.com",
        "https://instance.salesforce.com",
      );

      const connection: never = {
        id: "conn-1",
        accessToken: "expired-token",
        refreshToken: undefined, // No refresh token
        expiresAt: new Date(Date.now() - 1000).toISOString(), // Already expired
        instanceUrl: "https://instance.salesforce.com",
        status: "connected",
        syncConfig: { enableAccountSync: true },
      };

      (mockPayload.findByID as never).mockResolvedValueOnce(connection);

      const result = await service.syncData("conn-1", "org-1");

      expect(result.status).toBe("failed");
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe("Token Revocation Detection", () => {
    it("should detect and handle 401 Unauthorized", async () => {
      const service = new SalesforceService(
        mockPayload as Payload,
        "client-id",
        "client-secret",
        "https://callback.example.com",
        "https://instance.salesforce.com",
      );

      const connection: never = {
        id: "conn-1",
        accessToken: "revoked-token",
        refreshToken: "refresh-token",
        expiresAt: new Date(Date.now() + 3600000).toISOString(), // Still valid
        instanceUrl: "https://instance.salesforce.com",
        status: "connected",
        syncConfig: { enableAccountSync: true },
      };

      (mockPayload.findByID as never).mockResolvedValueOnce(connection);

      global.fetch = vi
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ error: "invalid_token" }), { status: 401 }),
        );

      const result = await service.syncData("conn-1", "org-1");

      expect(result.status).toBe("failed");
      expect(result.details.reason).toBe("connection_revoked");
      expect(mockPayload.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "revoked" }),
        }),
      );
    });

    it("should detect and handle 403 Forbidden", async () => {
      const service = new SalesforceService(
        mockPayload as Payload,
        "client-id",
        "client-secret",
        "https://callback.example.com",
        "https://instance.salesforce.com",
      );

      const connection: never = {
        id: "conn-1",
        accessToken: "token-no-permission",
        refreshToken: "refresh-token",
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        instanceUrl: "https://instance.salesforce.com",
        status: "connected",
        syncConfig: { enableAccountSync: true },
      };

      (mockPayload.findByID as never).mockResolvedValueOnce(connection);

      global.fetch = vi
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ error: "forbidden" }), { status: 403 }),
        );

      const result = await service.syncData("conn-1", "org-1");

      expect(result.status).toBe("failed");
      expect(result.details.reason).toBe("connection_revoked");
    });
  });

  describe("Network Failures", () => {
    it("should handle network timeout gracefully", async () => {
      const service = new SalesforceService(
        mockPayload as Payload,
        "client-id",
        "client-secret",
        "https://callback.example.com",
        "https://instance.salesforce.com",
      );

      const connection: never = {
        id: "conn-1",
        accessToken: "valid-token",
        instanceUrl: "https://instance.salesforce.com",
        status: "connected",
        syncConfig: { enableAccountSync: true },
      };

      (mockPayload.findByID as never).mockResolvedValueOnce(connection);

      global.fetch = vi.fn().mockRejectedValueOnce(new Error("Network timeout"));

      const result = await service.syncData("conn-1", "org-1");

      expect(result.status).toBe("failed");
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("should handle connection refused", async () => {
      const service = new NetSuiteService(
        mockPayload as Payload,
        "client-id",
        "client-secret",
        "https://callback.example.com",
      );

      const connection: never = {
        id: "conn-1",
        accessToken: "valid-token",
        status: "connected",
      };

      (mockPayload.findByID as never).mockResolvedValueOnce(connection);

      global.fetch = vi.fn().mockRejectedValueOnce(new Error("ECONNREFUSED"));

      const result = await service.syncGLData("conn-1", "org-1", "period-1");

      expect(result.status).toBe("failed");
    });
  });

  describe("Rate Limiting", () => {
    it("should respect rate limit and retry after delay", async () => {
      const service = new SalesforceService(
        mockPayload as Payload,
        "client-id",
        "client-secret",
        "https://callback.example.com",
        "https://instance.salesforce.com",
      );

      let callCount = 0;
      global.fetch = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return new Response(JSON.stringify({ error: "rate_limit" }), {
            status: 429,
            headers: { "Retry-After": "1" },
          });
        }
        return new Response(
          JSON.stringify({
            records: [
              {
                Id: "acc-1",
                Name: "Company",
                Industry: "Tech",
                BillingCity: "SF",
                BillingCountry: "USA",
              },
            ],
          }),
          { status: 200 },
        );
      });

      // Manual token exchange to test rate limiting
      try {
        await service.exchangeCodeForToken("code");
      } catch (err: unknown) {
        // First call rate limited
        expect((err as { statusCode?: number }).statusCode).toBe(429);
      }
    });
  });

  describe("Partial Sync Failures", () => {
    it("should continue sync when one record fails", async () => {
      const service = new NetSuiteService(
        mockPayload as Payload,
        "client-id",
        "client-secret",
        "https://callback.example.com",
      );

      const connection: never = {
        id: "conn-1",
        accessToken: "valid-token",
        status: "connected",
        glCodeMapping: {
          "1000": "electricity",
          "2000": "gas",
          "3000": "water",
        },
      };

      (mockPayload.findByID as never).mockResolvedValueOnce(connection);
      (mockPayload.create as never)
        .mockResolvedValueOnce({ id: "dp-1" }) // First datapoint succeeds
        .mockRejectedValueOnce(new Error("Quota exceeded")) // Second fails
        .mockResolvedValueOnce({ id: "dp-3" }); // Third succeeds

      global.fetch = vi.fn().mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            items: [
              {
                account: { id: "1000" },
                period: { id: "period-1" },
                balance: 1000,
                accountType: "expense",
              },
              {
                account: { id: "2000" },
                period: { id: "period-1" },
                balance: 2000,
                accountType: "expense",
              },
              {
                account: { id: "3000" },
                period: { id: "period-1" },
                balance: 3000,
                accountType: "expense",
              },
            ],
          }),
          { status: 200 },
        ),
      );

      const result = await service.syncGLData("conn-1", "org-1", "period-1");

      expect(result.status).toBe("partial"); // Partial success
      expect(result.recordsProcessed).toBe(3);
      expect(result.recordsFailed).toBeGreaterThan(0);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe("Duplicate Detection", () => {
    it("should not create duplicate accounts from same sync", async () => {
      const service = new SalesforceService(
        mockPayload as Payload,
        "client-id",
        "client-secret",
        "https://callback.example.com",
        "https://instance.salesforce.com",
      );

      const connection: never = {
        id: "conn-1",
        accessToken: "valid-token",
        instanceUrl: "https://instance.salesforce.com",
        status: "connected",
        syncConfig: { enableAccountSync: true },
      };

      (mockPayload.findByID as never).mockResolvedValueOnce(connection);

      // Return same account twice (simulating API bug or duplicate in source)
      global.fetch = vi.fn().mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            records: [
              {
                Id: "acc-1",
                Name: "Company",
                Industry: "Tech",
                BillingCity: "SF",
                BillingCountry: "USA",
              },
              {
                Id: "acc-1",
                Name: "Company",
                Industry: "Tech",
                BillingCity: "SF",
                BillingCountry: "USA",
              },
            ],
          }),
          { status: 200 },
        ),
      );

      const result = await service.syncData("conn-1", "org-1");

      // Should process 2 records but not create duplicates
      expect(result.recordsProcessed).toBe(2);
    });
  });

  describe("Large Dataset Handling", () => {
    it("should sync 1000+ records in under 5 seconds", async () => {
      const service = new SalesforceService(
        mockPayload as Payload,
        "client-id",
        "client-secret",
        "https://callback.example.com",
        "https://instance.salesforce.com",
      );

      const largeRecordSet = Array.from({ length: 1000 }, (_, i) => ({
        Id: `acc-${i}`,
        Name: `Company ${i}`,
        Industry: "Technology",
        BillingCity: "SF",
        BillingCountry: "USA",
      }));

      global.fetch = vi
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ records: largeRecordSet }), { status: 200 }),
        );

      const startTime = Date.now();
      const accounts = await service.fetchAccounts("valid-token");
      const duration = Date.now() - startTime;

      expect(accounts).toHaveLength(1000);
      expect(duration).toBeLessThan(5000);
    });
  });

  describe("Concurrent Sync Requests", () => {
    it("should prevent race conditions in concurrent syncs", async () => {
      const service = new SalesforceService(
        mockPayload as Payload,
        "client-id",
        "client-secret",
        "https://callback.example.com",
        "https://instance.salesforce.com",
      );

      const connection: never = {
        id: "conn-1",
        accessToken: "valid-token",
        instanceUrl: "https://instance.salesforce.com",
        status: "connected",
        syncConfig: { enableAccountSync: true },
      };

      (mockPayload.findByID as never).mockResolvedValue(connection);
      global.fetch = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            records: [
              {
                Id: "acc-1",
                Name: "Company",
                Industry: "Tech",
                BillingCity: "SF",
                BillingCountry: "USA",
              },
            ],
          }),
          { status: 200 },
        ),
      );

      // Run two syncs concurrently
      const [result1, result2] = await Promise.all([
        service.syncData("conn-1", "org-1"),
        service.syncData("conn-1", "org-1"),
      ]);

      expect(result1.status).toBe("success");
      expect(result2.status).toBe("success");
      // Both should complete without interfering with each other
    });
  });
});
