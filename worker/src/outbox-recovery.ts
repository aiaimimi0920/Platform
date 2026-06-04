const MAX_ERROR_MESSAGE_LENGTH = 1024;

function normalizeErrorMessage(message?: string): string | null {
  if (!message) return null;
  const trimmed = message.trim();
  if (!trimmed) return null;
  if (trimmed.length <= MAX_ERROR_MESSAGE_LENGTH) return trimmed;
  return `${trimmed.slice(0, MAX_ERROR_MESSAGE_LENGTH)}...`;
}

export function shouldDeadLetterRecoveredProcessingEvent(attempts: number, maxAttempts: number) {
  return attempts >= maxAttempts;
}

export function buildProcessingRecoveryErrorMessage(
  previousError: string | null | undefined,
  outcome: "requeued" | "dead_letter",
) {
  const suffix =
    outcome === "dead_letter"
      ? "processing lease expired before completion; moved to dead_letter"
      : "processing lease expired before completion; requeued for retry";
  return normalizeErrorMessage(previousError ? `${previousError} | ${suffix}` : suffix);
}
