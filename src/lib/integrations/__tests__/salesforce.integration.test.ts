import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Payload } from "payload";
import { SalesforceService } from "../salesforce";

describe("SalesforceService - OAuth & Sync", () => {
  let service: SalesforceService;
  let mockPayload: Partial<Payload>;

  beforeEach(() => {
    mockPayload = {
      findByID: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
      create: vi.fn().mockResolvedValue({ id: "datapoint-1" }),
    };

    service = new SalesforceService(
      mockPayload as Payload,
      "salesforce-client-id",
      "salesforce-client-secret",
      "https://app.example.com/integrations/salesforce/callback",
      "https://myinstance.salesforce.com",
    );
  });

  describe("OAuth Flow", () => {
    it("should generate Salesforce OAuth URL", () => {
      const authUrl = service.getAuthUrl("connection-123");

      expect(authUrl).toContain(
        "https://login.salesforce.com/services/oauth2/authorize?",
      );
      expect(authUrl).toContain("client_id=salesforce-client-id");
      expect(authUrl).toContain("scope=api+refresh_token");
      expect(authUrl).toContain("state=connection-123");
    });

    it("should exchange code for Salesforce tokens", async () => {
      global.fetch = vi.fn().mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: "sf-access-token",
            refresh_token: "sf-refresh-token",
            expires_in: 3600,
            instance_url: "https://myinstance.salesforce.com",
          }),
          { status: 200 },
        ),
      );

      const tokens = await service.exchangeCodeForToken("sf-auth-code");

      expect(tokens.accessToken).toBe("sf-access-token");
      expect(tokens.refreshToken).toBe("sf-refresh-token");
      expect(tokens.expiresAt).toBeDefined();
    });

    it("should refresh Salesforce access token", async () => {
      global.fetch = vi.fn().mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: "sf-new-access-token",
            expires_in: 3600,
            instance_url: "https://myinstance.salesforce.com",
          }),
          { status: 200 },
        ),
      );

      const tokens = await service.refreshAccessToken("sf-refresh-token");

      expect(tokens.accessToken).toBe("sf-new-access-token");
      expect(tokens.expiresAt).toBeDefined();
    });
  });

  describe("Account Sync", () => {
    it("should fetch Salesforce accounts", async () => {
      global.fetch = vi.fn().mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            records: [
              {
                Id: "acc-1",
                Name: "Acme Corp",
                Industry: "Technology",
                BillingCity: "San Francisco",
                BillingCountry: "USA",
              },
              {
                Id: "acc-2",
                Name: "Beta Inc",
                Industry: "Finance",
                BillingCity: "New York",
                BillingCountry: "USA",
              },
            ],
          }),
          { status: 200 },
        ),
      );

      const accounts = await service.fetchAccounts("valid-token");

      expect(accounts).toHaveLength(2);
      expect(accounts[0]).toEqual({
        id: "acc-1",
        name: "Acme Corp",
        industry: "Technology",
        billingCity: "San Francisco",
        billingCountry: "USA",
      });
    });

    it("should handle 401 error as token revocation", async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ error: "invalid_token" }), { status: 401 }),
        );

      try {
        await service.fetchAccounts("revoked-token");
        expect.fail("Should have thrown");
      } catch (err: never) {
        expect(err.type).toBe("token_revoked");
      }
    });

    it("should handle 403 error as permission denied", async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ error: "forbidden" }), { status: 403 }),
        );

      try {
        await service.fetchAccounts("token-no-permission");
        expect.fail("Should have thrown");
      } catch (err: never) {
        expect(err.type).toBe("token_revoked");
      }
    });

    it("should fetch 100+ accounts for performance testing", async () => {
      const records = Array.from({ length: 150 }, (_, i) => ({
        Id: `acc-${i}`,
        Name: `Company ${i}`,
        Industry: "Technology",
        BillingCity: "SF",
        BillingCountry: "USA",
      }));

      global.fetch = vi
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ records }), { status: 200 }),
        );

      const startTime = Date.now();
      const accounts = await service.fetchAccounts("token");
      const duration = Date.now() - startTime;

      expect(accounts).toHaveLength(150);
      expect(duration).toBeLessThan(5000); // Should complete in <5s
    });
  });

  describe("Contact Sync", () => {
    it("should fetch Salesforce contacts", async () => {
      global.fetch = vi.fn().mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            records: [
              {
                Id: "con-1",
                AccountId: "acc-1",
                FirstName: "John",
                LastName: "Doe",
                Email: "john@acme.com",
                Phone: "+1-555-0100",
                Title: "CTO",
              },
            ],
          }),
          { status: 200 },
        ),
      );

      const contacts = await service.fetchContacts("valid-token");

      expect(contacts).toHaveLength(1);
      expect(contacts[0].email).toBe("john@acme.com");
    });
  });

  describe("Full Sync Flow", () => {
    it("should sync data with token refresh if needed", async () => {
      const connection: never = {
        id: "conn-1",
        accessToken: "old-token",
        refreshToken: "refresh-token",
        expiresAt: new Date(Date.now() + 120000).toISOString(), // 2 minutes
        instanceUrl: "https://myinstance.salesforce.com",
        status: "connected",
        syncConfig: {
          enableAccountSync: true,
          enableContactSync: false,
        },
      };

      (mockPayload.findByID as never).mockResolvedValueOnce(connection);

      // Mock token refresh
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ access_token: "new-token", expires_in: 3600 }), {
            status: 200,
          }),
        )
        // Mock account fetch
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
      expect(result.recordsProcessed).toBe(1);
      expect(result.recordsFailed).toBe(0);
      expect(mockPayload.update).toHaveBeenCalled();
    });

    it("should return revoked status when token refresh fails", async () => {
      const connection: never = {
        id: "conn-1",
        accessToken: "old-token",
        refreshToken: "revoked-token",
        expiresAt: new Date(Date.now() + 60000).toISOString(),
        instanceUrl: "https://myinstance.salesforce.com",
        status: "connected",
        syncConfig: { enableAccountSync: true },
      };

      (mockPayload.findByID as never).mockResolvedValueOnce(connection);

      // Mock failed token refresh
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ error: "invalid_grant" }), { status: 401 }),
        );

      const result = await service.syncData("conn-1", "org-1");

      expect(result.status).toBe("failed");
      expect(result.details.reason).toBe("connection_revoked");
    });

    it("should handle partial sync failure gracefully", async () => {
      const connection: never = {
        id: "conn-1",
        accessToken: "valid-token",
        refreshToken: "refresh-token",
        expiresAt: new Date(Date.now() + 7200000).toISOString(),
        instanceUrl: "https://myinstance.salesforce.com",
        status: "connected",
        syncConfig: {
          enableAccountSync: true,
          enableContactSync: true,
        },
      };

      (mockPayload.findByID as never).mockResolvedValueOnce(connection);

      // Mock account fetch success
      global.fetch = vi
        .fn()
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
        )
        // Mock contact fetch failure (e.g., permission denied)
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ error: "permission_denied" }), { status: 403 }),
        );

      const result = await service.syncData("conn-1", "org-1");

      expect(result.status).toBe("failed"); // Failed due to contact sync
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe("Bi-Directional Sync", () => {
    it("should write metrics back to Salesforce", async () => {
      global.fetch = vi.fn().mockResolvedValue(new Response("", { status: 200 }));

      const metrics = [
        { accountId: "acc-1", emissions: 100.5, intensity: 2.1 },
        { accountId: "acc-2", emissions: 200.3, intensity: 3.5 },
      ];

      await service.writeMetricsToAccounts("valid-token", metrics);

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(global.fetch).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining("/sobjects/Account/acc-1"),
        expect.objectContaining({ method: "PATCH" }),
      );
    });

    it("should detect revoked token when writing metrics", async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ error: "invalid_token" }), { status: 401 }),
        );

      const metrics = [{ accountId: "acc-1", emissions: 100, intensity: 2 }];

      try {
        await service.writeMetricsToAccounts("revoked-token", metrics);
        expect.fail("Should have thrown");
      } catch (err: never) {
        expect(err.type).toBe("token_revoked");
      }
    });
  });
});
