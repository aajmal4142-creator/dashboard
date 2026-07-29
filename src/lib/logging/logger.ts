import * as Sentry from "@sentry/nextjs";

export type LogLevel = "debug" | "info" | "warn" | "error";
export type LogContext = {
  requestId?: string;
  userId?: string;
  organisationId?: string;
  endpoint?: string;
  method?: string;
  statusCode?: number;
  duration?: number;
  [key: string]: unknown;
};

const isDev = process.env.NODE_ENV === "development";
const logLevelPriority: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const minLogLevel = isDev ? logLevelPriority.debug : logLevelPriority.info;

function shouldLog(level: LogLevel): boolean {
  return logLevelPriority[level] >= minLogLevel;
}

function formatLog(
  level: LogLevel,
  message: string,
  context?: LogContext,
  error?: Error,
) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    message,
    ...(context && Object.keys(context).length > 0 && { context }),
    ...(error && {
      error: {
        name: error.name,
        message: error.message,
        stack: isDev ? error.stack : undefined,
      },
    }),
  };

  return JSON.stringify(logEntry);
}

export const logger = {
  debug(message: string, context?: LogContext) {
    if (!shouldLog("debug")) return;
    console.log(formatLog("debug", message, context));
  },

  info(message: string, context?: LogContext) {
    if (!shouldLog("info")) return;
    console.log(formatLog("info", message, context));
  },

  warn(message: string, context?: LogContext, error?: Error) {
    if (!shouldLog("warn")) return;
    console.warn(formatLog("warn", message, context, error));
  },

  error(message: string, error?: Error | unknown, context?: LogContext) {
    if (!shouldLog("error")) return;
    const err = error instanceof Error ? error : new Error(String(error));
    console.error(formatLog("error", message, context, err));

    // Always send errors to Sentry in production
    if (!isDev && error instanceof Error) {
      Sentry.captureException(error, {
        contexts: {
          custom: context,
        },
      });
    }
  },

  /**
   * Log API request/response with performance metrics
   */
  api(
    method: string,
    endpoint: string,
    statusCode: number,
    duration: number,
    context?: LogContext,
  ) {
    const level = statusCode >= 500 ? "error" : statusCode >= 400 ? "warn" : "info";
    if (!shouldLog(level)) return;

    const logContext: LogContext = {
      ...context,
      endpoint,
      method,
      statusCode,
      duration,
    };

    const message =
      statusCode >= 500
        ? "API request failed"
        : statusCode >= 400
          ? "API request error"
          : "API request";

    console.log(formatLog(level, message, logContext));
  },
};

/**
 * Middleware to extract request ID from headers or generate one
 */
export function getRequestId(request?: Request): string {
  if (!request) return generateRequestId();
  const id = request.headers.get("x-request-id");
  return id || generateRequestId();
}

/**
 * Generate a unique request ID
 */
export function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(7)}`;
}
