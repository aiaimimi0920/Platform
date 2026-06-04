import { describe, it, expect } from "vitest";
import {
  resolveAuthRegion,
  resolveApiRegion,
  resolveRegionConfig,
  buildAuthEndpoint,
  buildApiEndpoint,
  parseRegionFromEndpoint,
  isValidRegion,
  DEFAULT_REGION,
  DEFAULT_AUTH_REGION,
  DEFAULT_API_REGION,
  type RegionConfig,
} from "./region-resolver";

describe("resolveAuthRegion", () => {
  it("should use credential authRegion when provided", () => {
    const credentialConfig: RegionConfig = {
      authRegion: "us-west-2",
      region: "us-east-1",
    };
    const globalConfig: RegionConfig = {
      authRegion: "eu-west-1",
      region: "ap-southeast-1",
    };

    const result = resolveAuthRegion(credentialConfig, globalConfig);

    expect(result).toBe("us-west-2");
  });

  it("should fall back to credential region when authRegion not provided", () => {
    const credentialConfig: RegionConfig = {
      region: "us-east-1",
    };
    const globalConfig: RegionConfig = {
      authRegion: "eu-west-1",
    };

    const result = resolveAuthRegion(credentialConfig, globalConfig);

    expect(result).toBe("us-east-1");
  });

  it("should fall back to global authRegion when credential config not provided", () => {
    const globalConfig: RegionConfig = {
      authRegion: "eu-west-1",
      region: "ap-southeast-1",
    };

    const result = resolveAuthRegion(null, globalConfig);

    expect(result).toBe("eu-west-1");
  });

  it("should fall back to global region when authRegion not provided", () => {
    const globalConfig: RegionConfig = {
      region: "ap-southeast-1",
    };

    const result = resolveAuthRegion(null, globalConfig);

    expect(result).toBe("ap-southeast-1");
  });

  it("should use default when no config provided", () => {
    const result = resolveAuthRegion(null, null);

    expect(result).toBe(DEFAULT_AUTH_REGION);
  });
});

describe("resolveApiRegion", () => {
  it("should use credential apiRegion when provided", () => {
    const credentialConfig: RegionConfig = {
      apiRegion: "us-west-2",
      region: "us-east-1",
    };
    const globalConfig: RegionConfig = {
      apiRegion: "eu-west-1",
      region: "ap-southeast-1",
    };

    const result = resolveApiRegion(credentialConfig, globalConfig);

    expect(result).toBe("us-west-2");
  });

  it("should NOT fall back to credential region (only for auth)", () => {
    const credentialConfig: RegionConfig = {
      region: "us-east-1",
    };
    const globalConfig: RegionConfig = {
      apiRegion: "eu-west-1",
    };

    const result = resolveApiRegion(credentialConfig, globalConfig);

    expect(result).toBe("eu-west-1");
  });

  it("should fall back to global apiRegion", () => {
    const globalConfig: RegionConfig = {
      apiRegion: "eu-west-1",
      region: "ap-southeast-1",
    };

    const result = resolveApiRegion(null, globalConfig);

    expect(result).toBe("eu-west-1");
  });

  it("should fall back to global region when apiRegion not provided", () => {
    const globalConfig: RegionConfig = {
      region: "ap-southeast-1",
    };

    const result = resolveApiRegion(null, globalConfig);

    expect(result).toBe("ap-southeast-1");
  });

  it("should use default when no config provided", () => {
    const result = resolveApiRegion(null, null);

    expect(result).toBe(DEFAULT_API_REGION);
  });
});

describe("resolveRegionConfig", () => {
  it("should resolve all regions correctly", () => {
    const credentialConfig: RegionConfig = {
      region: "us-east-1",
      authRegion: "us-west-2",
      apiRegion: "eu-west-1",
    };
    const globalConfig: RegionConfig = {
      region: "ap-southeast-1",
    };

    const result = resolveRegionConfig(credentialConfig, globalConfig);

    expect(result).toEqual({
      authRegion: "us-west-2",
      apiRegion: "eu-west-1",
      defaultRegion: "us-east-1",
    });
  });

  it("should handle mixed credential and global config", () => {
    const credentialConfig: RegionConfig = {
      authRegion: "us-west-2",
    };
    const globalConfig: RegionConfig = {
      region: "ap-southeast-1",
      apiRegion: "eu-west-1",
    };

    const result = resolveRegionConfig(credentialConfig, globalConfig);

    expect(result).toEqual({
      authRegion: "us-west-2",
      apiRegion: "eu-west-1",
      defaultRegion: "ap-southeast-1",
    });
  });

  it("should use defaults when no config provided", () => {
    const result = resolveRegionConfig(null, null);

    expect(result).toEqual({
      authRegion: DEFAULT_AUTH_REGION,
      apiRegion: DEFAULT_API_REGION,
      defaultRegion: DEFAULT_REGION,
    });
  });
});

describe("buildAuthEndpoint", () => {
  it("should build auth endpoint with default service", () => {
    const result = buildAuthEndpoint("us-east-1");

    expect(result).toBe("https://codewhisperer.us-east-1.amazonaws.com");
  });

  it("should build auth endpoint with custom service", () => {
    const result = buildAuthEndpoint("us-east-1", "custom-service");

    expect(result).toBe("https://custom-service.us-east-1.amazonaws.com");
  });
});

describe("buildApiEndpoint", () => {
  it("should build API endpoint with default service", () => {
    const result = buildApiEndpoint("us-east-1");

    expect(result).toBe("https://q.us-east-1.amazonaws.com");
  });

  it("should build API endpoint with custom service", () => {
    const result = buildApiEndpoint("us-east-1", "custom-service");

    expect(result).toBe("https://custom-service.us-east-1.amazonaws.com");
  });
});

describe("parseRegionFromEndpoint", () => {
  it("should parse region from AWS endpoint", () => {
    const result = parseRegionFromEndpoint("https://q.us-east-1.amazonaws.com");

    expect(result).toBe("us-east-1");
  });

  it("should parse region from different service endpoint", () => {
    const result = parseRegionFromEndpoint("https://codewhisperer.eu-west-1.amazonaws.com");

    expect(result).toBe("eu-west-1");
  });

  it("should return null for non-AWS endpoint", () => {
    const result = parseRegionFromEndpoint("https://example.com");

    expect(result).toBeNull();
  });

  it("should return null for invalid URL", () => {
    const result = parseRegionFromEndpoint("not-a-url");

    expect(result).toBeNull();
  });
});

describe("isValidRegion", () => {
  it("should validate correct region format", () => {
    expect(isValidRegion("us-east-1")).toBe(true);
    expect(isValidRegion("eu-west-2")).toBe(true);
    expect(isValidRegion("ap-southeast-1")).toBe(true);
  });

  it("should reject invalid region format", () => {
    expect(isValidRegion("US-EAST-1")).toBe(false); // uppercase
    expect(isValidRegion("us_east_1")).toBe(false); // underscore
    expect(isValidRegion("us east 1")).toBe(false); // spaces
    expect(isValidRegion("")).toBe(false); // empty
  });
});

describe("Real-world scenarios", () => {
  it("should handle Kiro-style multi-region setup", () => {
    // Credential uses us-west-2 for auth, but API requests go to us-east-1
    const credentialConfig: RegionConfig = {
      region: "us-west-2",
      apiRegion: "us-east-1",
    };

    const result = resolveRegionConfig(credentialConfig, null);

    expect(result.authRegion).toBe("us-west-2"); // Uses credential.region for auth
    expect(result.apiRegion).toBe("us-east-1"); // Uses credential.apiRegion for API
  });

  it("should handle global config with credential override", () => {
    const credentialConfig: RegionConfig = {
      authRegion: "eu-west-1", // Override auth region only
    };
    const globalConfig: RegionConfig = {
      region: "us-east-1",
      apiRegion: "us-west-2",
    };

    const result = resolveRegionConfig(credentialConfig, globalConfig);

    expect(result.authRegion).toBe("eu-west-1"); // Credential override
    expect(result.apiRegion).toBe("us-west-2"); // Global config
  });
});
