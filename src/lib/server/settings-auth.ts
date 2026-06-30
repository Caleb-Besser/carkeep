import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "xenith_finance_settings";

function digest(value: string) {
  return createHash("sha256").update(value).digest();
}

function normalizeCopiedEnvValue(value: string) {
  const trimmed = value.trim();
  const first = trimmed[0];
  const last = trimmed.at(-1);
  if (trimmed.length >= 2 && first === last && (first === `"` || first === "'")) return trimmed.slice(1, -1);
  return trimmed;
}

function passwordMatches(input: string, expected: string) {
  if (timingSafeEqual(digest(input), digest(expected))) return true;
  const normalizedInput = normalizeCopiedEnvValue(input);
  return normalizedInput !== input && timingSafeEqual(digest(normalizedInput), digest(expected));
}

export function settingsProtectionConfigured() {
  return Boolean(process.env.FINANCE_SETTINGS_PASSWORD);
}

export async function isSettingsAuthorized() {
  const password = process.env.FINANCE_SETTINGS_PASSWORD;
  if (!password) return process.env.NODE_ENV !== "production";

  const value = (await cookies()).get(COOKIE_NAME)?.value;
  if (!value) return false;
  return timingSafeEqual(digest(value), digest(password));
}

export async function requireSettingsAuthorization() {
  if (!(await isSettingsAuthorized())) throw new Error("Settings access is locked.");
}

export async function unlockSettings(password: string) {
  const expected = process.env.FINANCE_SETTINGS_PASSWORD;
  if (!expected || !passwordMatches(password, expected)) return false;

  (await cookies()).set(COOKIE_NAME, expected, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 8,
    path: "/finance",
  });
  return true;
}
