export class ApiError extends Error {
  constructor(
    public code: string,
    public statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const ErrorCodes = {
  INVALID_SIGNATURE: "API-001",
  WEBHOOK_NOT_FOUND: "API-002",
  RATE_LIMIT_EXCEEDED: "API-003",
  INVALID_SCHEMA: "API-004",
  ORG_QUOTA_EXCEEDED: "API-005",
  UNAUTHORIZED: "API-006",
  PERIOD_CLOSED: "API-007",
  ORG_NOT_FOUND: "API-008",
  INVALID_REQUEST: "API-009",
  WEBHOOK_DELIVERY_FAILED: "API-010",
  INTERNAL_ERROR: "API-011",
} as const;

export function createErrorResponse(error: ApiError | Error): {
  error: string;
  code?: string;
  details?: string;
} {
  if (error instanceof ApiError) {
    return {
      error: error.message,
      code: error.code,
    };
  }
  return {
    error: error instanceof Error ? error.message : "Unknown error",
  };
}
