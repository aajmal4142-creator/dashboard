import { logger } from "@/lib/logging/logger";

export interface ApiMetric {
  endpoint: string;
  method: string;
  statusCode: number;
  duration: number;
  timestamp: Date;
  userId?: string;
  organisationId?: string;
  error?: string;
}

export interface SystemMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: Date;
  threshold?: number;
  alert?: boolean;
}

class MetricsCollector {
  private metrics: ApiMetric[] = [];
  private maxMetrics = 1000;
  private flushInterval = 60000; // 1 minute
  private alertThresholds = {
    responseTimeMs: 2000,
    errorRate: 0.05, // 5%
    cpuUsage: 0.8, // 80%
  };

  constructor() {
    // Periodically flush metrics
    setInterval(() => this.flush(), this.flushInterval);
  }

  recordApiRequest(metric: ApiMetric): void {
    this.metrics.push(metric);

    // Keep metrics under control
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }

    // Check for alerts
    this.checkAlerts(metric);
  }

  private checkAlerts(metric: ApiMetric): void {
    // Alert on slow responses
    if (metric.duration > this.alertThresholds.responseTimeMs) {
      logger.warn("Slow API response detected", {
        endpoint: metric.endpoint,
        duration: metric.duration,
        threshold: this.alertThresholds.responseTimeMs,
      });
    }

    // Alert on server errors
    if (metric.statusCode >= 500) {
      logger.error("Server error in API request", new Error(`${metric.statusCode}`), {
        endpoint: metric.endpoint,
        method: metric.method,
        statusCode: metric.statusCode,
        duration: metric.duration,
        userId: metric.userId,
        organisationId: metric.organisationId,
        error: metric.error,
      });
    }
  }

  private flush(): void {
    if (this.metrics.length === 0) return;

    const recentMetrics = this.metrics.slice(-100);
    const avgDuration =
      recentMetrics.reduce((sum, m) => sum + m.duration, 0) / recentMetrics.length;
    const errorCount = recentMetrics.filter((m) => m.statusCode >= 400).length;
    const errorRate = errorCount / recentMetrics.length;

    const healthReport = {
      timestamp: new Date().toISOString(),
      totalRequests: this.metrics.length,
      recentRequests: recentMetrics.length,
      avgResponseTime: Math.round(avgDuration),
      errorRate: Math.round(errorRate * 10000) / 100,
      endpointsSeen: new Set(this.metrics.map((m) => m.endpoint)).size,
    };

    logger.info("Metrics flush", healthReport);

    // Send to monitoring service if needed
    if (errorRate > this.alertThresholds.errorRate) {
      logger.warn("High error rate detected", {
        errorRate,
        threshold: this.alertThresholds.errorRate,
      });
    }
  }

  getMetrics(): ApiMetric[] {
    return [...this.metrics];
  }

  clear(): void {
    this.metrics = [];
  }
}

export const metricsCollector = new MetricsCollector();

/**
 * Middleware wrapper to measure API response time
 */
export async function measureApiResponse<T>(
  fn: () => Promise<T>,
  endpoint: string,
  method: string,
  context?: { userId?: string; organisationId?: string },
): Promise<{ result: T; duration: number; statusCode?: number }> {
  const startTime = Date.now();

  try {
    const result = await fn();
    const duration = Date.now() - startTime;

    metricsCollector.recordApiRequest({
      endpoint,
      method,
      statusCode: 200,
      duration,
      timestamp: new Date(),
      ...context,
    });

    return { result, duration, statusCode: 200 };
  } catch (error) {
    const duration = Date.now() - startTime;
    const statusCode = error instanceof Error ? 500 : 400;

    metricsCollector.recordApiRequest({
      endpoint,
      method,
      statusCode,
      duration,
      timestamp: new Date(),
      error: error instanceof Error ? error.message : String(error),
      ...context,
    });

    throw error;
  }
}

/**
 * Health check endpoint data
 */
export interface HealthCheckResult {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: Date;
  uptime: number;
  metrics: {
    apiErrorRate: number;
    avgResponseTime: number;
    requestsPerMinute: number;
  };
  services: {
    stripe: "healthy" | "degraded" | "unavailable";
    database: "healthy" | "degraded" | "unavailable";
  };
}

export function getHealthCheck(): HealthCheckResult {
  const metrics = metricsCollector.getMetrics();
  const now = Date.now();
  const oneMinuteAgo = now - 60000;

  const recentMetrics = metrics.filter((m) => m.timestamp.getTime() > oneMinuteAgo);
  const errorCount = recentMetrics.filter((m) => m.statusCode >= 400).length;
  const errorRate = recentMetrics.length > 0 ? errorCount / recentMetrics.length : 0;
  const avgDuration =
    recentMetrics.length > 0
      ? recentMetrics.reduce((sum, m) => sum + m.duration, 0) / recentMetrics.length
      : 0;

  return {
    status: errorRate > 0.05 ? "degraded" : "healthy",
    timestamp: new Date(),
    uptime: process.uptime(),
    metrics: {
      apiErrorRate: errorRate,
      avgResponseTime: Math.round(avgDuration),
      requestsPerMinute: recentMetrics.length,
    },
    services: {
      stripe: "healthy", // Would check circuit breaker state in real implementation
      database: "healthy",
    },
  };
}
