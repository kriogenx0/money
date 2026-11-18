// Runs in both the Edge middleware and Node route handlers, so only use Web APIs here.
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "money_session";
const MAX_AGE_DAYS = 30;

function secretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET || process.env.APP_PASSWORD;
  if (!secret) throw new Error("Set APP_PASSWORD (and ideally SESSION_SECRET)");
  return new TextEncoder().encode(secret);
}

export function authEnabled(): boolean {
  return Boolean(process.env.APP_PASSWORD);
}

export async function createSessionToken(): Promise<string> {
  return new SignJWT({ sub: "owner" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_DAYS}d`)
    .sign(secretKey());
}

export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    return true;
  } catch {
    return false;
  }
}

export const SESSION_MAX_AGE_SECONDS = MAX_AGE_DAYS * 24 * 60 * 60;
