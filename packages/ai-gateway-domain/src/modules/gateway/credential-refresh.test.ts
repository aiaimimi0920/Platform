import { describe, it, expect, beforeEach } from "vitest";
import {
  BaseCredentialRefresher,
  CredentialRefresherRegistry,
  checkCredentialExpiration,
  refreshCredential,
  type CredentialExpirationStatus,
  type CredentialRefreshResult,
} from "./credential-refresh";

// Mock credential refresher for testing
class MockCredentialRefresher extends BaseCredentialRefresher {
  readonly providerType = "mock";

  checkExpiration(credential: unknown): CredentialExpirationStatus {
    const cred = credential as { expiresAt?: string | Date };
    const expiresAt = cred.expiresAt ? new Date(cred.expiresAt) : null;

    return {
      isExpired: this.isExpiringWithin(expiresAt, 5),
      isExpiringSoon: this.isExpiringWithin(expiresAt, 10),
      expiresAt,
      minutesUntilExpiration: this.minutesUntilExpiration(expiresAt),
    };
  }

  async refresh(credential: unknown): Promise<CredentialRefreshResult> {
    const cred = credential as { refreshToken?: string };

    if (cred.refreshToken === "invalid") {
      return {
        success: false,
        error: "Invalid refresh token",
        isPermanentFailure: true,
      };
    }

    if (cred.refreshToken === "expired") {
      return {
        success: false,
        error: "Refresh token expired",
        isPermanentFailure: true,
      };
    }

    return {
      success: true,
      accessToken: "new-access-token",
      expiresAt: new Date(Date.now() + 3600 * 1000),
      refreshToken: "new-refresh-token",
    };
  }

  validate(credential: unknown): { valid: boolean; error?: string } {
    const cred = credential as { refreshToken?: string };

    if (!cred.refreshToken) {
      return { valid: false, error: "Missing refresh token" };
    }

    if (cred.refreshToken.length < 10) {
      return { valid: false, error: "Refresh token too short" };
    }

    return { valid: true };
  }
}

describe("BaseCredentialRefresher", () => {
  let refresher: MockCredentialRefresher;

  beforeEach(() => {
    refresher = new MockCredentialRefresher();
  });

  describe("checkExpiration", () => {
    it("should detect expired credentials (within 5 minutes)", () => {
      const credential = {
        expiresAt: new Date(Date.now() + 4 * 60 * 1000), // 4 minutes from now
      };

      const status = refresher.checkExpiration(credential);

      expect(status.isExpired).toBe(true);
      expect(status.isExpiringSoon).toBe(true);
    });

    it("should detect expiring soon credentials (within 10 minutes)", () => {
      const credential = {
        expiresAt: new Date(Date.now() + 8 * 60 * 1000), // 8 minutes from now
      };

      const status = refresher.checkExpiration(credential);

      expect(status.isExpired).toBe(false);
      expect(status.isExpiringSoon).toBe(true);
    });

    it("should detect valid credentials (not expiring soon)", () => {
      const credential = {
        expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes from now
      };

      const status = refresher.checkExpiration(credential);

      expect(status.isExpired).toBe(false);
      expect(status.isExpiringSoon).toBe(false);
    });

    it("should treat missing expiresAt as expired", () => {
      const credential = {};

      const status = refresher.checkExpiration(credential);

      expect(status.isExpired).toBe(true);
      expect(status.expiresAt).toBeNull();
      expect(status.minutesUntilExpiration).toBeNull();
    });
  });

  describe("refresh", () => {
    it("should successfully refresh valid credentials", async () => {
      const credential = {
        refreshToken: "valid-refresh-token",
      };

      const result = await refresher.refresh(credential);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.accessToken).toBe("new-access-token");
        expect(result.refreshToken).toBe("new-refresh-token");
        expect(result.expiresAt).toBeInstanceOf(Date);
      }
    });

    it("should fail with permanent error for invalid refresh token", async () => {
      const credential = {
        refreshToken: "invalid",
      };

      const result = await refresher.refresh(credential);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.isPermanentFailure).toBe(true);
        expect(result.error).toBe("Invalid refresh token");
      }
    });

    it("should fail with permanent error for expired refresh token", async () => {
      const credential = {
        refreshToken: "expired",
      };

      const result = await refresher.refresh(credential);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.isPermanentFailure).toBe(true);
        expect(result.error).toBe("Refresh token expired");
      }
    });
  });

  describe("validate", () => {
    it("should validate correct credentials", () => {
      const credential = {
        refreshToken: "valid-refresh-token-12345",
      };

      const result = refresher.validate(credential);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should reject credentials without refresh token", () => {
      const credential = {};

      const result = refresher.validate(credential);

      expect(result.valid).toBe(false);
      expect(result.error).toBe("Missing refresh token");
    });

    it("should reject credentials with short refresh token", () => {
      const credential = {
        refreshToken: "short",
      };

      const result = refresher.validate(credential);

      expect(result.valid).toBe(false);
      expect(result.error).toBe("Refresh token too short");
    });
  });
});

describe("CredentialRefresherRegistry", () => {
  let registry: CredentialRefresherRegistry;
  let mockRefresher: MockCredentialRefresher;

  beforeEach(() => {
    registry = new CredentialRefresherRegistry();
    mockRefresher = new MockCredentialRefresher();
  });

  it("should register and retrieve refreshers", () => {
    registry.register(mockRefresher);

    const retrieved = registry.get("mock");

    expect(retrieved).toBe(mockRefresher);
  });

  it("should return null for unregistered provider types", () => {
    const retrieved = registry.get("unknown");

    expect(retrieved).toBeNull();
  });

  it("should check if provider type is registered", () => {
    registry.register(mockRefresher);

    expect(registry.has("mock")).toBe(true);
    expect(registry.has("unknown")).toBe(false);
  });

  it("should list all registered provider types", () => {
    registry.register(mockRefresher);

    const types = registry.listProviderTypes();

    expect(types).toEqual(["mock"]);
  });
});

describe("Helper functions", () => {
  let registry: CredentialRefresherRegistry;
  let mockRefresher: MockCredentialRefresher;

  beforeEach(() => {
    registry = new CredentialRefresherRegistry();
    mockRefresher = new MockCredentialRefresher();
    registry.register(mockRefresher);
  });

  describe("checkCredentialExpiration", () => {
    it("should check expiration using registered refresher", () => {
      const credential = {
        expiresAt: new Date(Date.now() + 4 * 60 * 1000),
      };

      const status = checkCredentialExpiration("mock", credential, registry);

      expect(status).not.toBeNull();
      expect(status?.isExpired).toBe(true);
    });

    it("should return null for unregistered provider type", () => {
      const credential = {
        expiresAt: new Date(Date.now() + 4 * 60 * 1000),
      };

      const status = checkCredentialExpiration("unknown", credential, registry);

      expect(status).toBeNull();
    });
  });

  describe("refreshCredential", () => {
    it("should refresh using registered refresher", async () => {
      const credential = {
        refreshToken: "valid-refresh-token",
      };

      const result = await refreshCredential("mock", credential, registry);

      expect(result.success).toBe(true);
    });

    it("should validate before refreshing", async () => {
      const credential = {
        refreshToken: "short",
      };

      const result = await refreshCredential("mock", credential, registry);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.isPermanentFailure).toBe(true);
        expect(result.error).toBe("Refresh token too short");
      }
    });

    it("should return error for unregistered provider type", async () => {
      const credential = {
        refreshToken: "valid-refresh-token",
      };

      const result = await refreshCredential("unknown", credential, registry);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("No credential refresher registered");
        expect(result.isPermanentFailure).toBe(false);
      }
    });
  });
});
