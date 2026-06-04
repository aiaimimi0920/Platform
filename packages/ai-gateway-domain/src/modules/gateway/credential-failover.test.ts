import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  CredentialFailoverManager,
  DEFAULT_FAILOVER_CONFIG,
  type CredentialEntry,
} from "./credential-failover";

describe("CredentialFailoverManager", () => {
  let manager: CredentialFailoverManager<string>;

  beforeEach(() => {
    manager = new CredentialFailoverManager({
      maxRetriesPerCredential: 3,
      maxTotalRetries: 9,
      retryDelayMs: 10, // Short delay for tests
      backoffMultiplier: 2,
      maxRetryDelayMs: 100,
    });
  });

  describe("Credential management", () => {
    it("should add and retrieve credentials", () => {
      const entry: CredentialEntry<string> = {
        id: "cred-1",
        credential: "api-key-1",
        priority: 0,
        disabled: false,
        failureCount: 0,
        lastFailureAt: null,
        lastSuccessAt: null,
      };

      manager.addCredential(entry);
      const retrieved = manager.getCredential("cred-1");

      expect(retrieved).toEqual(entry);
    });

    it("should remove credentials", () => {
      const entry: CredentialEntry<string> = {
        id: "cred-1",
        credential: "api-key-1",
        priority: 0,
        disabled: false,
        failureCount: 0,
        lastFailureAt: null,
        lastSuccessAt: null,
      };

      manager.addCredential(entry);
      const removed = manager.removeCredential("cred-1");
      const retrieved = manager.getCredential("cred-1");

      expect(removed).toBe(true);
      expect(retrieved).toBeNull();
    });

    it("should disable and enable credentials", () => {
      const entry: CredentialEntry<string> = {
        id: "cred-1",
        credential: "api-key-1",
        priority: 0,
        disabled: false,
        failureCount: 0,
        lastFailureAt: null,
        lastSuccessAt: null,
      };

      manager.addCredential(entry);
      manager.disableCredential("cred-1");

      expect(manager.getCredential("cred-1")?.disabled).toBe(true);

      manager.enableCredential("cred-1");

      expect(manager.getCredential("cred-1")?.disabled).toBe(false);
    });

    it("should record success and reset failure count", () => {
      const entry: CredentialEntry<string> = {
        id: "cred-1",
        credential: "api-key-1",
        priority: 0,
        disabled: false,
        failureCount: 5,
        lastFailureAt: new Date(),
        lastSuccessAt: null,
      };

      manager.addCredential(entry);
      manager.recordSuccess("cred-1");

      const updated = manager.getCredential("cred-1");
      expect(updated?.failureCount).toBe(0);
      expect(updated?.lastSuccessAt).toBeInstanceOf(Date);
    });

    it("should record failure and increment failure count", () => {
      const entry: CredentialEntry<string> = {
        id: "cred-1",
        credential: "api-key-1",
        priority: 0,
        disabled: false,
        failureCount: 0,
        lastFailureAt: null,
        lastSuccessAt: null,
      };

      manager.addCredential(entry);
      manager.recordFailure("cred-1");

      const updated = manager.getCredential("cred-1");
      expect(updated?.failureCount).toBe(1);
      expect(updated?.lastFailureAt).toBeInstanceOf(Date);
    });
  });

  describe("Priority mode execution", () => {
    it("should execute with highest priority credential first", async () => {
      manager.addCredential({
        id: "cred-1",
        credential: "low-priority",
        priority: 10,
        disabled: false,
        failureCount: 0,
        lastFailureAt: null,
        lastSuccessAt: null,
      });

      manager.addCredential({
        id: "cred-2",
        credential: "high-priority",
        priority: 0,
        disabled: false,
        failureCount: 0,
        lastFailureAt: null,
        lastSuccessAt: null,
      });

      const operation = vi.fn(async (cred: string) => {
        return `result-${cred}`;
      });

      const result = await manager.executeWithFailover(operation);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.result).toBe("result-high-priority");
        expect(result.credentialId).toBe("cred-2");
      }
      expect(operation).toHaveBeenCalledWith("high-priority", "cred-2");
    });

    it("should retry with same credential on retryable error", async () => {
      manager.addCredential({
        id: "cred-1",
        credential: "api-key-1",
        priority: 0,
        disabled: false,
        failureCount: 0,
        lastFailureAt: null,
        lastSuccessAt: null,
      });

      let attemptCount = 0;
      const operation = vi.fn(async () => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error("Temporary error");
        }
        return "success";
      });

      const result = await manager.executeWithFailover(operation);

      expect(result.success).toBe(true);
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it("should failover to next credential after max retries", async () => {
      manager.addCredential({
        id: "cred-1",
        credential: "failing-key",
        priority: 0,
        disabled: false,
        failureCount: 0,
        lastFailureAt: null,
        lastSuccessAt: null,
      });

      manager.addCredential({
        id: "cred-2",
        credential: "working-key",
        priority: 1,
        disabled: false,
        failureCount: 0,
        lastFailureAt: null,
        lastSuccessAt: null,
      });

      const operation = vi.fn(async (cred: string) => {
        if (cred === "failing-key") {
          throw new Error("Always fails");
        }
        return "success";
      });

      const result = await manager.executeWithFailover(operation);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.credentialId).toBe("cred-2");
      }
      expect(operation).toHaveBeenCalledTimes(4); // 3 retries on cred-1 + 1 success on cred-2
    });

    it("should stop on non-retryable error", async () => {
      manager.addCredential({
        id: "cred-1",
        credential: "api-key-1",
        priority: 0,
        disabled: false,
        failureCount: 0,
        lastFailureAt: null,
        lastSuccessAt: null,
      });

      const operation = vi.fn(async () => {
        throw new Error("Non-retryable error");
      });

      const isRetryable = vi.fn(() => false);

      const result = await manager.executeWithFailover(operation, isRetryable);

      expect(result.success).toBe(false);
      expect(operation).toHaveBeenCalledTimes(1); // Only one attempt
    });

    it("should respect max total retries", async () => {
      // Add 5 credentials, each will fail 3 times
      for (let i = 0; i < 5; i++) {
        manager.addCredential({
          id: `cred-${i}`,
          credential: `key-${i}`,
          priority: i,
          disabled: false,
          failureCount: 0,
          lastFailureAt: null,
          lastSuccessAt: null,
        });
      }

      const operation = vi.fn(async () => {
        throw new Error("Always fails");
      });

      const result = await manager.executeWithFailover(operation);

      expect(result.success).toBe(false);
      expect(operation).toHaveBeenCalledTimes(9); // Max total retries
    });
  });

  describe("Balanced mode execution", () => {
    it("should round-robin across credentials", async () => {
      const balancedManager = new CredentialFailoverManager({
        loadBalancingMode: "balanced",
        maxRetriesPerCredential: 1,
        maxTotalRetries: 6,
        retryDelayMs: 10,
      });

      balancedManager.addCredential({
        id: "cred-1",
        credential: "key-1",
        priority: 0,
        disabled: false,
        failureCount: 0,
        lastFailureAt: null,
        lastSuccessAt: null,
      });

      balancedManager.addCredential({
        id: "cred-2",
        credential: "key-2",
        priority: 1,
        disabled: false,
        failureCount: 0,
        lastFailureAt: null,
        lastSuccessAt: null,
      });

      const callOrder: string[] = [];
      const operation = vi.fn(async (cred: string, credId: string) => {
        callOrder.push(credId);
        throw new Error("Fail");
      });

      await balancedManager.executeWithFailover(operation);

      // Should alternate between cred-1 and cred-2
      expect(callOrder).toEqual(["cred-1", "cred-2", "cred-1", "cred-2"]);
    });
  });

  describe("Statistics", () => {
    it("should return correct statistics", () => {
      manager.addCredential({
        id: "cred-1",
        credential: "key-1",
        priority: 0,
        disabled: false,
        failureCount: 0,
        lastFailureAt: null,
        lastSuccessAt: null,
      });

      manager.addCredential({
        id: "cred-2",
        credential: "key-2",
        priority: 1,
        disabled: true,
        failureCount: 0,
        lastFailureAt: null,
        lastSuccessAt: null,
      });

      manager.addCredential({
        id: "cred-3",
        credential: "key-3",
        priority: 2,
        disabled: false,
        failureCount: 5,
        lastFailureAt: new Date(),
        lastSuccessAt: null,
      });

      const stats = manager.getStatistics();

      expect(stats.total).toBe(3);
      expect(stats.enabled).toBe(2);
      expect(stats.disabled).toBe(1);
      expect(stats.healthy).toBe(1);
      expect(stats.unhealthy).toBe(1);
    });
  });

  describe("Edge cases", () => {
    it("should handle no available credentials", async () => {
      const operation = vi.fn(async () => "success");

      const result = await manager.executeWithFailover(operation);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("No available credentials");
      }
      expect(operation).not.toHaveBeenCalled();
    });

    it("should skip disabled credentials", async () => {
      manager.addCredential({
        id: "cred-1",
        credential: "disabled-key",
        priority: 0,
        disabled: true,
        failureCount: 0,
        lastFailureAt: null,
        lastSuccessAt: null,
      });

      manager.addCredential({
        id: "cred-2",
        credential: "enabled-key",
        priority: 1,
        disabled: false,
        failureCount: 0,
        lastFailureAt: null,
        lastSuccessAt: null,
      });

      const operation = vi.fn(async (cred: string) => `result-${cred}`);

      const result = await manager.executeWithFailover(operation);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.credentialId).toBe("cred-2");
      }
      expect(operation).toHaveBeenCalledWith("enabled-key", "cred-2");
    });
  });
});
