import { createHash, timingSafeEqual } from "node:crypto";
import { decodeProtectedHeader, importJWK, jwtVerify, type JWK } from "jose";
import { getPlaid } from "./plaid";

const keyCache = new Map<string, JWK>();

/**
 * Verifies the Plaid-Verification header: an ES256 JWT signed by a Plaid key,
 * issued within the last 5 minutes, whose claim matches the SHA-256 of the raw body.
 * https://plaid.com/docs/api/webhooks/webhook-verification/
 */
export async function verifyPlaidWebhook(rawBody: string, token: string | null): Promise<boolean> {
  if (!token) return false;
  try {
    const header = decodeProtectedHeader(token);
    if (header.alg !== "ES256" || !header.kid) return false;

    let jwk = keyCache.get(header.kid);
    if (!jwk) {
      const res = await getPlaid().webhookVerificationKeyGet({ key_id: header.kid });
      jwk = res.data.key as unknown as JWK;
      keyCache.set(header.kid, jwk);
    }
    if ((jwk as { expired_at?: number | null }).expired_at) return false;

    const key = await importJWK(jwk, "ES256");
    const { payload } = await jwtVerify(token, key, { algorithms: ["ES256"], maxTokenAge: "5m" });

    const expected = Buffer.from(String(payload.request_body_sha256 ?? ""), "utf8");
    const actual = Buffer.from(createHash("sha256").update(rawBody).digest("hex"), "utf8");
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}
