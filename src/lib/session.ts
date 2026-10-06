import { signValue, unsignValue } from "@/lib/crypto";

export const SESSION_COOKIE = "dm_session";
export const SESSION_DAYS = 30;

export function createSessionValue(secret: string, now = Date.now()): string {
  const expiresAt = now + SESSION_DAYS * 24 * 60 * 60_000;
  return signValue(String(expiresAt), secret);
}

export function isValidSession(value: string | undefined, secret: string, now = Date.now()): boolean {
  if (!value) return false;
  const payload = unsignValue(value, secret);
  if (!payload) return false;
  const expiresAt = Number(payload);
  return Number.isFinite(expiresAt) && expiresAt > now;
}
