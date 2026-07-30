import type { Payload } from "payload";
import type { OAuthTokens, OAuthError, OAuthErrorType } from "./types";

const DEFAULT_REFRESH_THRESHOLD = 5 * 60 * 1000; // 5 minutes
const MAX_REFRESH_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;

export type TokenResponseBody = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  instance_url?: string;
  error?: string;
  error_description?: string;
};

export type OAuthConfig = {
  authUrl: string;
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope: string;
  tokenRefreshThreshold?: number;
};

export type OAuthConnection = {
  id: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
  status?: string;
  lastRefreshError?: string;
};

export class OAuthErrorException extends Error implements OAuthError {
  type: OAuthErrorType;
  statusCode?: number;
  retryable: boolean;

  constructor(errorData: OAuthError) {
    super(errorData.message);
    this.name = "OAuthErrorException";
    this.type = errorData.type;
    this.statusCode = errorData.statusCode;
    this.retryable = errorData.retryable;
  }
}

export abstract class OAuthBase {
  protected config: OAuthConfig;
  protected payload: Payload;
  protected collectionName: string;
  protected refreshThreshold: number;
  private refreshAttempts: Map<string, number> = new Map();

  constructor(
    payload: Payload,
    config: OAuthConfig,
    collectionName: string,
    refreshThreshold?: number,
  ) {
    this.payload = payload;
    this.config = config;
    this.collectionName = collectionName;
    this.refreshThreshold = refreshThreshold || DEFAULT_REFRESH_THRESHOLD;
  }

  getAuthUrl(connectionId: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: "code",
      scope: this.config.scope,
      state: connectionId,
    });
    return `${this.config.authUrl}?${params.toString()}`;
  }

  async exchangeCodeForToken(code: string): Promise<OAuthTokens> {
    try {
      const response = await fetch(this.config.tokenUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          redirect_uri: this.config.redirectUri,
        }).toString(),
      });

      if (!response.ok) {
        const errorData = await this.parseOAuthErrorResponse(response);
        throw this.createOAuthError(errorData, response.status);
      }

      const data = (await response.json()) as TokenResponseBody;
      return this.parseTokenResponse(data);
    } catch (error) {
      if (error instanceof OAuthErrorException || this.isOAuthError(error)) {
        throw error;
      }
      throw this.createOAuthError({
        type: "network_error",
        message: error instanceof Error ? error.message : String(error),
        retryable: true,
      });
    }
  }

  async refreshAccessToken(
    refreshToken: string,
    connectionId?: string,
  ): Promise<OAuthTokens> {
    const attemptKey = connectionId || "default";
    const attempts = this.refreshAttempts.get(attemptKey) || 0;

    if (attempts >= MAX_REFRESH_RETRIES) {
      throw this.createOAuthError({
        type: "server_error",
        message: "Max token refresh attempts exceeded",
        retryable: false,
      });
    }

    try {
      const response = await fetch(this.config.tokenUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: refreshToken,
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
        }).toString(),
      });

      if (!response.ok) {
        const errorData = await this.parseOAuthErrorResponse(response);

        // Detect revocation
        if (
          response.status === 401 ||
          response.status === 403 ||
          errorData.type === "invalid_grant"
        ) {
          this.refreshAttempts.set(attemptKey, 0);
          throw this.createOAuthError({
            type: "token_revoked",
            message: "Token has been revoked. Please re-authorize.",
            statusCode: response.status,
            retryable: false,
          });
        }

        // Exponential backoff for retryable errors
        if (errorData.retryable) {
          const backoffDelay = INITIAL_BACKOFF_MS * Math.pow(2, attempts);
          await new Promise((resolve) => setTimeout(resolve, backoffDelay));
          this.refreshAttempts.set(attemptKey, attempts + 1);
          return this.refreshAccessToken(refreshToken, connectionId);
        }

        throw this.createOAuthError(errorData, response.status);
      }

      this.refreshAttempts.set(attemptKey, 0);
      const data = (await response.json()) as TokenResponseBody;
      return this.parseTokenResponse(data, refreshToken);
    } catch (error) {
      if (error instanceof OAuthErrorException || this.isOAuthError(error)) {
        throw error;
      }
      throw this.createOAuthError({
        type: "network_error",
        message: error instanceof Error ? error.message : String(error),
        retryable: true,
      });
    }
  }

  async ensureValidToken(connection: OAuthConnection): Promise<string> {
    const now = new Date();
    const expiresAt = connection.expiresAt ? new Date(connection.expiresAt) : null;
    const timeUntilExpiry = expiresAt ? expiresAt.getTime() - now.getTime() : Infinity;

    if (timeUntilExpiry <= this.refreshThreshold && connection.refreshToken) {
      try {
        const newTokens = await this.refreshAccessToken(
          connection.refreshToken,
          connection.id,
        );

        await this.payload.update({
          collection: this.collectionName as "accounting-connections",
          id: connection.id,
          data: {
            accessToken: newTokens.accessToken,
            refreshToken: newTokens.refreshToken || connection.refreshToken,
            expiresAt: newTokens.expiresAt,
            status: "connected",
            lastSyncStatus: null,
          },
          overrideAccess: true,
        });

        return newTokens.accessToken;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        const isRevoked =
          error instanceof OAuthErrorException && error.type === "token_revoked";

        await this.payload.update({
          collection: this.collectionName as "accounting-connections",
          id: connection.id,
          data: {
            status: "failed",
            lastSyncStatus: isRevoked ? `revoked: ${errorMsg}` : errorMsg,
          },
          overrideAccess: true,
        });

        throw error;
      }
    }

    return connection.accessToken;
  }

  isTokenExpired(expiresAt?: string): boolean {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  }

  isTokenExpiringSoon(expiresAt?: string): boolean {
    if (!expiresAt) return false;
    const now = new Date();
    const expires = new Date(expiresAt);
    return expires.getTime() - now.getTime() <= this.refreshThreshold;
  }

  isOAuthError(error: unknown): error is OAuthError {
    return (
      typeof error === "object" &&
      error !== null &&
      "type" in error &&
      "message" in error &&
      "retryable" in error
    );
  }

  protected parseTokenResponse(
    data: TokenResponseBody,
    previousRefreshToken?: string,
  ): OAuthTokens {
    if (!data.access_token) {
      throw this.createOAuthError({
        type: "server_error",
        message: "Token response missing access_token",
        retryable: false,
      });
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || previousRefreshToken,
      expiresAt: data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000).toISOString()
        : undefined,
    };
  }

  protected async parseOAuthErrorResponse(response: Response): Promise<OAuthError> {
    try {
      const data = (await response.json()) as TokenResponseBody;

      // Standard OAuth error response
      if (data.error) {
        return {
          type: this.mapOAuthErrorCode(data.error),
          message: data.error_description || data.error,
          retryable: this.isRetryableErrorCode(data.error),
        };
      }
    } catch {
      // Ignore JSON parse errors, fall through to default
    }

    return {
      type: "server_error",
      message: `OAuth server error: ${response.statusText}`,
      statusCode: response.status,
      retryable: response.status >= 500,
    };
  }

  protected mapOAuthErrorCode(errorCode: string): OAuthErrorType {
    const mapping: Record<string, OAuthErrorType> = {
      invalid_grant: "invalid_grant",
      invalid_scope: "invalid_scope",
      rate_limit: "rate_limit",
      access_denied: "token_revoked",
      unauthorized_client: "server_error",
      server_error: "server_error",
      temporarily_unavailable: "server_error",
    };
    return mapping[errorCode] || "server_error";
  }

  protected isRetryableErrorCode(errorCode: string): boolean {
    const retryable = ["server_error", "temporarily_unavailable", "rate_limit"];
    return retryable.includes(errorCode);
  }

  protected createOAuthError(
    errorData: Partial<OAuthError> & { type: OAuthErrorType; message: string },
    statusCode?: number,
  ): OAuthErrorException {
    return new OAuthErrorException({
      type: errorData.type,
      message: errorData.message,
      retryable: errorData.retryable ?? false,
      statusCode: statusCode || errorData.statusCode,
    });
  }
}
