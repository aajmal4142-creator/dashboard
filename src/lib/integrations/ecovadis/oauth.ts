import { getPayload } from "payload";
import config from "@/payload.config";

const OAUTH_ENDPOINT = "https://api.ecovadis.com/oauth/v2/token";
const API_ENDPOINT = "https://api.ecovadis.com/api/v2";

export interface EcoVadisOAuthToken {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

export class EcoVadisOAuthManager {
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;

  constructor(clientId: string, clientSecret: string, redirectUri: string) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.redirectUri = redirectUri;
  }

  async exchangeAuthCode(code: string): Promise<EcoVadisOAuthToken> {
    const res = await fetch(OAUTH_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: this.redirectUri,
      }).toString(),
    });

    if (!res.ok) {
      const error = await res.text();
      throw new Error(`EcoVadis OAuth exchange failed: ${error}`);
    }

    const data = (await res.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<EcoVadisOAuthToken> {
    const res = await fetch(OAUTH_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: this.clientId,
        client_secret: this.clientSecret,
      }).toString(),
    });

    if (!res.ok) {
      const error = await res.text();
      throw new Error(`EcoVadis refresh failed: ${error}`);
    }

    const data = (await res.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    };
  }

  async fetchSuppliers(
    accessToken: string,
    skip = 0,
    limit = 100,
  ): Promise<{ suppliers: EcoVadisSupplier[]; total: number; page: number }> {
    const params = new URLSearchParams({
      skip: skip.toString(),
      limit: limit.toString(),
    });

    const res = await fetch(`${API_ENDPOINT}/suppliers?${params}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      throw new Error(`EcoVadis API error: ${res.status} ${await res.text()}`);
    }

    return res.json() as Promise<{
      suppliers: EcoVadisSupplier[];
      total: number;
      page: number;
    }>;
  }

  async fetchSupplierScores(
    accessToken: string,
    supplierId: string,
  ): Promise<EcoVadisSupplierScore> {
    const res = await fetch(`${API_ENDPOINT}/suppliers/${supplierId}/scores`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      throw new Error(`EcoVadis API error: ${res.status} ${await res.text()}`);
    }

    return res.json() as Promise<EcoVadisSupplierScore>;
  }

  getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: "code",
      state,
    });
    return `https://api.ecovadis.com/oauth/v2/auth?${params}`;
  }
}

export interface EcoVadisSupplier {
  id: string;
  businessName: string;
  email: string;
  externalId?: string;
  assessmentDate?: string;
}

export interface EcoVadisSupplierScore {
  supplierId: string;
  score: number;
  assessmentDate: string;
  trend: string;
  categories: {
    environment: number;
    labor: number;
    ethics: number;
    procurement: number;
  };
}

export async function getOAuthManager(): Promise<EcoVadisOAuthManager> {
  const clientId = process.env.ECOVADIS_CLIENT_ID?.trim();
  const clientSecret = process.env.ECOVADIS_CLIENT_SECRET?.trim();
  const redirectUri = process.env.ECOVADIS_REDIRECT_URI?.trim();

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("EcoVadis OAuth credentials not configured");
  }

  return new EcoVadisOAuthManager(clientId, clientSecret, redirectUri);
}

export async function getOrRefreshToken(orgId: string): Promise<EcoVadisOAuthToken> {
  const payload = await getPayload({ config });

  const connection = await payload.find({
    collection: "ecovadis-connections",
    where: { organisation: { equals: orgId } },
    limit: 1,
    overrideAccess: true,
  });

  if (!connection.docs[0]) {
    throw new Error("EcoVadis not connected for this organization");
  }

  const doc = connection.docs[0];
  const expiresAt = doc.expiresAt ? new Date(doc.expiresAt) : null;

  // Refresh if expired or expiring soon (5 min buffer)
  if (!expiresAt || expiresAt.getTime() - Date.now() < 5 * 60 * 1000) {
    if (!doc.refreshToken) {
      throw new Error("No refresh token available");
    }

    const manager = await getOAuthManager();
    const newToken = await manager.refreshAccessToken(doc.refreshToken);

    await payload.update({
      collection: "ecovadis-connections",
      id: doc.id,
      data: {
        accessToken: newToken.accessToken,
        refreshToken: newToken.refreshToken,
        expiresAt: newToken.expiresAt.toISOString(),
        status: "connected",
      },
      overrideAccess: true,
    });

    return newToken;
  }

  return {
    accessToken: doc.accessToken || "",
    refreshToken: doc.refreshToken || "",
    expiresAt: expiresAt || new Date(),
  };
}
