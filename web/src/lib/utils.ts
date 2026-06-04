import crypto from "node:crypto";

export function nowIso(): string {
  return new Date().toISOString();
}

export function generateUserId(): string {
  return `usr_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

export function safeUsername(input: string | null | undefined, fallback: string): string {
  const value = String(input || "").trim();
  return value || fallback;
}
