import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  parseProxyUrl,
  resolveEffectiveProxy,
  getProxyCacheKey,
  HttpClientPool,
  DIRECT_PROXY,
  type ProxyConfig,
} from "./proxy-manager";

describe("parseProxyUrl", () => {
  it("should parse HTTP proxy URL", () => {
    const result = parseProxyUrl("http://proxy.example.com:8080");

    expect(result).toEqual({
      url: "http://proxy.example.com:8080",
      protocol: "http",
      host: "proxy.example.com",
      port: 8080,
      username: undefined,
      password: undefined,
    });
  });

  it("should parse HTTPS proxy URL", () => {
    const result = parseProxyUrl("https://proxy.example.com:8443");

    expect(result).toEqual({
      url: "https://proxy.example.com:8443",
      protocol: "https",
      host: "proxy.example.com",
      port: 8443,
      username: undefined,
      password: undefined,
    });
  });

  it("should parse SOCKS5 proxy URL", () => {
    const result = parseProxyUrl("socks5://proxy.example.com:1080");

    expect(result).toEqual({
      url: "socks5://proxy.example.com:1080",
      protocol: "socks5",
      host: "proxy.example.com",
      port: 1080,
      username: undefined,
      password: undefined,
    });
  });

  it("should parse proxy URL with credentials", () => {
    const result = parseProxyUrl("http://user:pass@proxy.example.com:8080");

    expect(result).toEqual({
      url: "http://user:pass@proxy.example.com:8080",
      protocol: "http",
      host: "proxy.example.com",
      port: 8080,
      username: "user",
      password: "pass",
    });
  });

  it("should use default port for HTTP (8080)", () => {
    const result = parseProxyUrl("http://proxy.example.com");

    expect(result?.port).toBe(8080);
  });

  it("should use default port for SOCKS5 (1080)", () => {
    const result = parseProxyUrl("socks5://proxy.example.com");

    expect(result?.port).toBe(1080);
  });

  it("should return null for invalid URL", () => {
    expect(parseProxyUrl("not-a-url")).toBeNull();
    expect(parseProxyUrl("")).toBeNull();
    expect(parseProxyUrl("   ")).toBeNull();
  });

  it("should return null for unsupported protocol", () => {
    expect(parseProxyUrl("ftp://proxy.example.com:21")).toBeNull();
  });
});

describe("resolveEffectiveProxy", () => {
  it("should use credential proxy when provided", () => {
    const credentialProxy = "http://cred-proxy:8080";
    const globalProxy = "http://global-proxy:8080";

    const result = resolveEffectiveProxy(credentialProxy, globalProxy);

    expect(result?.host).toBe("cred-proxy");
  });

  it("should fall back to global proxy when credential proxy is not provided", () => {
    const globalProxy = "http://global-proxy:8080";

    const result = resolveEffectiveProxy(null, globalProxy);

    expect(result?.host).toBe("global-proxy");
  });

  it("should return null when credential proxy is DIRECT", () => {
    const globalProxy = "http://global-proxy:8080";

    const result = resolveEffectiveProxy(DIRECT_PROXY, globalProxy);

    expect(result).toBeNull();
  });

  it("should return null when no proxy is configured", () => {
    const result = resolveEffectiveProxy(null, null);

    expect(result).toBeNull();
  });

  it("should fall back to global proxy when credential proxy is invalid", () => {
    const credentialProxy = "invalid-url";
    const globalProxy = "http://global-proxy:8080";

    const result = resolveEffectiveProxy(credentialProxy, globalProxy);

    expect(result?.host).toBe("global-proxy");
  });
});

describe("getProxyCacheKey", () => {
  it("should generate cache key for no proxy", () => {
    const key = getProxyCacheKey(null);

    expect(key).toBe("no-proxy");
  });

  it("should generate cache key for proxy without credentials", () => {
    const proxy: ProxyConfig = {
      url: "http://proxy:8080",
      protocol: "http",
      host: "proxy.example.com",
      port: 8080,
    };

    const key = getProxyCacheKey(proxy);

    expect(key).toBe("http:proxy.example.com:8080");
  });

  it("should generate cache key for proxy with username", () => {
    const proxy: ProxyConfig = {
      url: "http://user@proxy:8080",
      protocol: "http",
      host: "proxy.example.com",
      port: 8080,
      username: "user",
    };

    const key = getProxyCacheKey(proxy);

    expect(key).toBe("http:proxy.example.com:8080:user");
  });

  it("should not include password in cache key", () => {
    const proxy: ProxyConfig = {
      url: "http://user:pass@proxy:8080",
      protocol: "http",
      host: "proxy.example.com",
      port: 8080,
      username: "user",
      password: "pass",
    };

    const key = getProxyCacheKey(proxy);

    expect(key).not.toContain("pass");
  });

  it("should generate different keys for different proxies", () => {
    const proxy1: ProxyConfig = {
      url: "http://proxy1:8080",
      protocol: "http",
      host: "proxy1.example.com",
      port: 8080,
    };

    const proxy2: ProxyConfig = {
      url: "http://proxy2:8080",
      protocol: "http",
      host: "proxy2.example.com",
      port: 8080,
    };

    const key1 = getProxyCacheKey(proxy1);
    const key2 = getProxyCacheKey(proxy2);

    expect(key1).not.toBe(key2);
  });
});

describe("HttpClientPool", () => {
  let pool: HttpClientPool<string>;
  let clientFactory: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    clientFactory = vi.fn((proxy: ProxyConfig | null) => {
      return proxy ? `client-${proxy.host}` : "client-no-proxy";
    });

    pool = new HttpClientPool(clientFactory, 1000); // 1 second idle time for tests
  });

  describe("getClient", () => {
    it("should create new client on first call", () => {
      const proxy: ProxyConfig = {
        url: "http://proxy:8080",
        protocol: "http",
        host: "proxy.example.com",
        port: 8080,
      };

      const client = pool.getClient(proxy);

      expect(client).toBe("client-proxy.example.com");
      expect(clientFactory).toHaveBeenCalledWith(proxy);
      expect(clientFactory).toHaveBeenCalledTimes(1);
    });

    it("should reuse existing client for same proxy", () => {
      const proxy: ProxyConfig = {
        url: "http://proxy:8080",
        protocol: "http",
        host: "proxy.example.com",
        port: 8080,
      };

      const client1 = pool.getClient(proxy);
      const client2 = pool.getClient(proxy);

      expect(client1).toBe(client2);
      expect(clientFactory).toHaveBeenCalledTimes(1);
    });

    it("should create different clients for different proxies", () => {
      const proxy1: ProxyConfig = {
        url: "http://proxy1:8080",
        protocol: "http",
        host: "proxy1.example.com",
        port: 8080,
      };

      const proxy2: ProxyConfig = {
        url: "http://proxy2:8080",
        protocol: "http",
        host: "proxy2.example.com",
        port: 8080,
      };

      const client1 = pool.getClient(proxy1);
      const client2 = pool.getClient(proxy2);

      expect(client1).not.toBe(client2);
      expect(clientFactory).toHaveBeenCalledTimes(2);
    });

    it("should handle no-proxy case", () => {
      const client = pool.getClient(null);

      expect(client).toBe("client-no-proxy");
      expect(clientFactory).toHaveBeenCalledWith(null);
    });

    it("should track use count", () => {
      const proxy: ProxyConfig = {
        url: "http://proxy:8080",
        protocol: "http",
        host: "proxy.example.com",
        port: 8080,
      };

      pool.getClient(proxy);
      pool.getClient(proxy);
      pool.getClient(proxy);

      const stats = pool.getStatistics();
      const entry = stats.clientsByProxy.find((e) => e.proxyKey.includes("proxy.example.com"));

      expect(entry?.useCount).toBe(3);
    });
  });

  describe("cleanupIdleClients", () => {
    it("should remove idle clients", async () => {
      const proxy: ProxyConfig = {
        url: "http://proxy:8080",
        protocol: "http",
        host: "proxy.example.com",
        port: 8080,
      };

      pool.getClient(proxy);

      // Wait for idle timeout
      await new Promise((resolve) => setTimeout(resolve, 1100));

      const removed = pool.cleanupIdleClients();

      expect(removed).toBe(1);
      expect(pool.getStatistics().totalClients).toBe(0);
    });

    it("should not remove recently used clients", () => {
      const proxy: ProxyConfig = {
        url: "http://proxy:8080",
        protocol: "http",
        host: "proxy.example.com",
        port: 8080,
      };

      pool.getClient(proxy);

      const removed = pool.cleanupIdleClients();

      expect(removed).toBe(0);
      expect(pool.getStatistics().totalClients).toBe(1);
    });
  });

  describe("getStatistics", () => {
    it("should return correct statistics", () => {
      const proxy1: ProxyConfig = {
        url: "http://proxy1:8080",
        protocol: "http",
        host: "proxy1.example.com",
        port: 8080,
      };

      const proxy2: ProxyConfig = {
        url: "http://proxy2:8080",
        protocol: "http",
        host: "proxy2.example.com",
        port: 8080,
      };

      pool.getClient(proxy1);
      pool.getClient(proxy2);
      pool.getClient(proxy1); // Use proxy1 again

      const stats = pool.getStatistics();

      expect(stats.totalClients).toBe(2);
      expect(stats.clientsByProxy).toHaveLength(2);

      const proxy1Stats = stats.clientsByProxy.find((e) => e.proxyKey.includes("proxy1"));
      expect(proxy1Stats?.useCount).toBe(2);
    });
  });

  describe("clear", () => {
    it("should remove all clients", () => {
      const proxy: ProxyConfig = {
        url: "http://proxy:8080",
        protocol: "http",
        host: "proxy.example.com",
        port: 8080,
      };

      pool.getClient(proxy);
      pool.getClient(null);

      pool.clear();

      expect(pool.getStatistics().totalClients).toBe(0);
    });
  });
});
