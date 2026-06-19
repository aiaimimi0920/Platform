export function safeLocalLoomUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  try {
    const url = new URL(value);
    const isLoopback =
      url.hostname === "127.0.0.1" ||
      url.hostname === "localhost" ||
      url.hostname === "[::1]" ||
      url.hostname === "::1";
    return url.protocol === "http:" && isLoopback && url.pathname.startsWith("/settings")
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

export function displayConfigurationSource(value: unknown): string {
  switch (value) {
    case "loom-managed":
      return "Loom 托管";
    case "fallback":
      return "保底快照";
    case "local":
      return "本地配置";
    default:
      return "未声明";
  }
}
