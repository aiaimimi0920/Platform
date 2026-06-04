// ---------------------------------------------------------------------------
// Proxy Manager — credential-level proxy configuration with HTTP client pooling
// ---------------------------------------------------------------------------

/**
 * Proxy protocol type
 */
export type ProxyProtocol = "http" | "https" | "socks5";

/**
 * Proxy configuration
 */
export type ProxyConfig = {
  url: string; // Proxy URL (e.g., "http://proxy:8080", "socks5://proxy:1080")
  protocol: ProxyProtocol;
  host: string;
  port: number;
  username?: string;
  password?: string;
};

/**
 * Special proxy configuration value indicating no proxy should be used
 */
export const DIRECT_PROXY = "direct";

/**
 * Parse a proxy URL into a ProxyConfig
 *
 * @param proxyUrl - Proxy URL string (e.g., "http://user:pass@proxy:8080")
 * @returns Parsed proxy configuration or null if invalid
 */
export function parseProxyUrl(proxyUrl: string): ProxyConfig | null {
  if (!proxyUrl || proxyUrl.trim() === "") {
    return null;
  }

  try {
    const url = new URL(proxyUrl);

    // Extract protocol
    const protocol = url.protocol.replace(":", "") as ProxyProtocol;
    if (!["http", "https", "socks5"].includes(protocol)) {
      return null;
    }

    // Extract host and port
    const host = url.hostname;
    const port = url.port ? parseInt(url.port, 10) : protocol === "socks5" ? 1080 : 8080;

    // Extract credentials
    const username = url.username || undefined;
    const password = url.password || undefined;

    return {
      url: proxyUrl,
      protocol,
      host,
      port,
      username,
      password,
    };
  } catch {
    return null;
  }
}

/**
 * Resolve effective proxy configuration for a credential
 *
 * Priority: credential proxy > global proxy > no proxy
 *
 * @param credentialProxyUrl - Credential-level proxy URL (can be "direct" to disable proxy)
 * @param globalProxyUrl - Global proxy URL
 * @returns Resolved proxy configuration or null if no proxy
 */
export function resolveEffectiveProxy(
  credentialProxyUrl: string | null | undefined,
  globalProxyUrl: string | null | undefined,
): ProxyConfig | null {
  // Credential-level proxy takes precedence
  if (credentialProxyUrl) {
    // Special value "direct" means explicitly no proxy
    if (credentialProxyUrl === DIRECT_PROXY) {
      return null;
    }

    // Parse credential proxy
    const credentialProxy = parseProxyUrl(credentialProxyUrl);
    if (credentialProxy) {
      return credentialProxy;
    }
  }

  // Fall back to global proxy
  if (globalProxyUrl) {
    return parseProxyUrl(globalProxyUrl);
  }

  // No proxy
  return null;
}

/**
 * Generate a cache key for a proxy configuration
 *
 * Used to cache HTTP clients by proxy configuration.
 *
 * @param proxy - Proxy configuration or null for no proxy
 * @returns Cache key string
 */
export function getProxyCacheKey(proxy: ProxyConfig | null): string {
  if (!proxy) {
    return "no-proxy";
  }

  // Include protocol, host, port, and username (but not password for security)
  const parts = [proxy.protocol, proxy.host, proxy.port.toString()];
  if (proxy.username) {
    parts.push(proxy.username);
  }

  return parts.join(":");
}

/**
 * HTTP Client pool entry
 */
type HttpClientPoolEntry<T> = {
  client: T;
  proxyConfig: ProxyConfig | null;
  createdAt: Date;
  lastUsedAt: Date;
  useCount: number;
};

/**
 * HTTP Client pool manager
 *
 * Caches HTTP clients by proxy configuration to avoid creating
 * new clients for every request.
 */
export class HttpClientPool<T> {
  private pool = new Map<string, HttpClientPoolEntry<T>>();
  private clientFactory: (proxy: ProxyConfig | null) => T;
  private maxIdleTimeMs: number;

  constructor(
    clientFactory: (proxy: ProxyConfig | null) => T,
    maxIdleTimeMs: number = 5 * 60 * 1000, // 5 minutes default
  ) {
    this.clientFactory = clientFactory;
    this.maxIdleTimeMs = maxIdleTimeMs;
  }

  /**
   * Get or create an HTTP client for a proxy configuration
   *
   * @param proxy - Proxy configuration or null for no proxy
   * @returns HTTP client instance
   */
  getClient(proxy: ProxyConfig | null): T {
    const cacheKey = getProxyCacheKey(proxy);
    const existing = this.pool.get(cacheKey);

    if (existing) {
      // Update last used time and use count
      existing.lastUsedAt = new Date();
      existing.useCount += 1;
      return existing.client;
    }

    // Create new client
    const client = this.clientFactory(proxy);
    const entry: HttpClientPoolEntry<T> = {
      client,
      proxyConfig: proxy,
      createdAt: new Date(),
      lastUsedAt: new Date(),
      useCount: 1,
    };

    this.pool.set(cacheKey, entry);
    return client;
  }

  /**
   * Clean up idle clients that haven't been used recently
   *
   * @returns Number of clients removed
   */
  cleanupIdleClients(): number {
    const now = new Date();
    let removedCount = 0;

    for (const [key, entry] of this.pool.entries()) {
      const idleTimeMs = now.getTime() - entry.lastUsedAt.getTime();
      if (idleTimeMs > this.maxIdleTimeMs) {
        this.pool.delete(key);
        removedCount += 1;
      }
    }

    return removedCount;
  }

  /**
   * Get pool statistics
   */
  getStatistics(): {
    totalClients: number;
    clientsByProxy: Array<{
      proxyKey: string;
      useCount: number;
      idleTimeMs: number;
    }>;
  } {
    const now = new Date();
    const clientsByProxy = Array.from(this.pool.entries()).map(([key, entry]) => ({
      proxyKey: key,
      useCount: entry.useCount,
      idleTimeMs: now.getTime() - entry.lastUsedAt.getTime(),
    }));

    return {
      totalClients: this.pool.size,
      clientsByProxy,
    };
  }

  /**
   * Clear all clients from the pool
   */
  clear(): void {
    this.pool.clear();
  }
}
