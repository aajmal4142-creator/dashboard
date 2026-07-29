import { logger } from "@/lib/logging/logger";

export type CircuitBreakerState = "closed" | "open" | "half-open";

export interface CircuitBreakerConfig {
  failureThreshold: number; // Number of failures before opening
  successThreshold: number; // Number of successes to close from half-open
  timeout: number; // Milliseconds before attempting recovery
  resetTimeout: number; // Milliseconds to wait before auto-closing
}

const defaultConfig: CircuitBreakerConfig = {
  failureThreshold: 5,
  successThreshold: 2,
  timeout: 5000,
  resetTimeout: 60000,
};

export class CircuitBreaker {
  private state: CircuitBreakerState = "closed";
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime: number | null = null;
  private lastStateChangeTime = Date.now();
  private config: CircuitBreakerConfig;
  private name: string;

  constructor(name: string, config: Partial<CircuitBreakerConfig> = {}) {
    this.name = name;
    this.config = { ...defaultConfig, ...config };
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === "open") {
      if (this.shouldAttemptRecovery()) {
        this.state = "half-open";
        logger.info(`Circuit breaker ${this.name} entering half-open state`, {
          failureCount: this.failureCount,
        });
      } else {
        throw new Error(
          `Circuit breaker ${this.name} is OPEN. Service temporarily unavailable.`,
        );
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private shouldAttemptRecovery(): boolean {
    return (
      this.lastFailureTime !== null &&
      Date.now() - this.lastFailureTime >= this.config.resetTimeout
    );
  }

  private onSuccess(): void {
    this.failureCount = 0;
    this.lastFailureTime = null;

    if (this.state === "half-open") {
      this.successCount++;
      if (this.successCount >= this.config.successThreshold) {
        this.state = "closed";
        this.successCount = 0;
        this.lastStateChangeTime = Date.now();
        logger.info(`Circuit breaker ${this.name} CLOSED - service recovered`, {
          duration: Date.now() - this.lastStateChangeTime,
        });
      }
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    this.successCount = 0;

    logger.warn(`Circuit breaker ${this.name} failure`, {
      failureCount: this.failureCount,
      threshold: this.config.failureThreshold,
    });

    if (this.failureCount >= this.config.failureThreshold && this.state !== "open") {
      this.state = "open";
      this.lastStateChangeTime = Date.now();
      logger.error(
        `Circuit breaker ${this.name} OPEN - too many failures`,
        new Error(
          `Failed ${this.failureCount} times (threshold: ${this.config.failureThreshold})`,
        ),
        {
          failureCount: this.failureCount,
        },
      );
    }
  }

  getState(): CircuitBreakerState {
    return this.state;
  }

  reset(): void {
    this.state = "closed";
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    logger.info(`Circuit breaker ${this.name} manually reset`);
  }
}

// Global circuit breakers
export const stripeCircuitBreaker = new CircuitBreaker("stripe", {
  failureThreshold: 3,
  successThreshold: 2,
  resetTimeout: 30000,
});

export const payloadCircuitBreaker = new CircuitBreaker("payload", {
  failureThreshold: 5,
  successThreshold: 3,
  resetTimeout: 20000,
});
