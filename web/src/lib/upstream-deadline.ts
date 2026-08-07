export function parseUpstreamTimeoutMs(value: string | undefined, fallback: number, minimum = 250) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < minimum) {
    return fallback;
  }
  return Math.floor(parsed);
}

export function createUpstreamDeadlineSignal(parentSignal: AbortSignal, timeoutMs: number) {
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1) {
    throw new TypeError("Upstream timeout must be a positive number");
  }
  return AbortSignal.any([parentSignal, AbortSignal.timeout(Math.floor(timeoutMs))]);
}
