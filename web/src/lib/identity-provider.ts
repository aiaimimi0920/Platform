type Environment = Record<string, string | undefined>;

export function getIdentityProvider(env: Environment = process.env): "linuxdo" | "rauthy" {
  const provider = env.AUTH_PROVIDER || "linuxdo";
  if (provider !== "linuxdo" && provider !== "rauthy") {
    throw new Error("AUTH_PROVIDER must be linuxdo or rauthy");
  }
  return provider;
}

export type RauthyConfiguration = {
  issuer: string;
  clientId: string;
  clientSecret: string;
  jwksUrl: URL;
};

export function getRauthyConfiguration(env: Environment = process.env): RauthyConfiguration | null {
  if (getIdentityProvider(env) !== "rauthy") return null;
  const required = (name: string) => {
    const value = env[name]?.trim();
    if (!value) throw new Error(`Missing required environment variable: ${name}`);
    return value;
  };
  const issuer = required("RAUTHY_ISSUER_URL");
  if (issuer !== env.RAUTHY_ISSUER_URL || issuer.length > 2048 || /[\s\\]/.test(issuer)
      || issuer.includes("?") || issuer.includes("#")) {
    throw new Error("RAUTHY_ISSUER_URL must be an exact issuer without whitespace, query or fragment");
  }
  const url = new URL(issuer);
  const localHttp = ["development", "test"].includes(env.NODE_ENV ?? "")
    && env.RAUTHY_ALLOW_INSECURE_LOOPBACK === "true" && url.protocol === "http:"
    && ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
  if ((url.protocol !== "https:" && !localHttp) || url.username || url.password
      || url.search || url.hash) {
    throw new Error("RAUTHY_ISSUER_URL requires HTTPS and an exact issuer without query or fragment");
  }
  if (required("NEXTAUTH_SECRET").length < 32) {
    throw new Error("Rauthy requires an independent NEXTAUTH_SECRET of at least 32 characters");
  }
  return {
    issuer,
    clientId: required("RAUTHY_CLIENT_ID"),
    clientSecret: required("RAUTHY_CLIENT_SECRET"),
    // Rauthy's stable /auth/v1 issuer advertises /oidc/certs in discovery.
    jwksUrl: new URL(`${issuer.replace(/\/$/, "")}/oidc/certs`),
  };
}
