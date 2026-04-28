import crypto from "crypto";

/**
 * Per-lesson-request relay address scheme.
 *
 *   lr-<idShort>-<hmac>@<RELAY_DOMAIN>
 *
 * idShort: first 12 hex chars of the lesson_request UUID (no dashes).
 *          12 hex chars = 48 bits of entropy = ~2.8e14 — collision risk
 *          is negligible for our scale, and DB lookup uses a like-prefix.
 * hmac:    first 8 hex chars of HMAC-SHA256(LESSON_REPLY_TOKEN_SECRET, fullId).
 *          Prevents random spam to lr-<random>@... from polluting threads —
 *          the inbound webhook only accepts addresses whose hmac verifies
 *          against the matched request id.
 *
 * The address shape is fixed so it slots into common email parsers, and
 * the local part stays under 32 chars (well within RFC).
 */

const ID_SHORT_LEN = 12;
const HMAC_LEN = 8;

function relayDomain(): string | null {
  return process.env.LESSON_REPLY_RELAY_DOMAIN?.trim() || null;
}

function tokenSecret(): string | null {
  return process.env.LESSON_REPLY_TOKEN_SECRET?.trim() || null;
}

/** True only when both env vars are configured — flips the outbound
 *  Reply-To behavior. Without this, callers fall back to the previous
 *  direct-reply pattern (Reply-To = the other party's email). */
export function relayConfigured(): boolean {
  return !!relayDomain() && !!tokenSecret();
}

function normalizeId(requestId: string): string {
  return requestId.replace(/-/g, "").toLowerCase();
}

function hmacFor(requestId: string): string {
  const secret = tokenSecret();
  if (!secret) throw new Error("LESSON_REPLY_TOKEN_SECRET is not set");
  return crypto
    .createHmac("sha256", secret)
    .update(normalizeId(requestId))
    .digest("hex")
    .slice(0, HMAC_LEN);
}

/** Returns the relay address for this lesson request. Throws if env is
 *  not configured — callers should gate with relayConfigured(). */
export function replyAddressFor(requestId: string): string {
  const domain = relayDomain();
  if (!domain) throw new Error("LESSON_REPLY_RELAY_DOMAIN is not set");
  const idShort = normalizeId(requestId).slice(0, ID_SHORT_LEN);
  const tag = hmacFor(requestId);
  return `lr-${idShort}-${tag}@${domain}`;
}

/** Parse a relay address and return the candidate idShort + tag. The
 *  caller still needs to look up the full UUID by prefix and verify the
 *  tag with verifyToken(). Returns null if the address isn't ours. */
export function parseReplyAddress(addr: string): { idShort: string; tag: string } | null {
  const domain = relayDomain();
  if (!domain) return null;
  const lower = addr.toLowerCase().trim();
  // Allow plus-addressing in case someone forwards through a system that
  // attaches +foo.
  const match = lower.match(/^lr-([0-9a-f]+)-([0-9a-f]+)(?:\+[^@]+)?@(.+)$/);
  if (!match) return null;
  const [, idShort, tag, host] = match;
  if (host !== domain.toLowerCase()) return null;
  if (idShort.length !== ID_SHORT_LEN || tag.length !== HMAC_LEN) return null;
  return { idShort, tag };
}

/** Verify that `tag` is the HMAC we'd produce for `fullRequestId`. Uses
 *  constant-time comparison. */
export function verifyToken(fullRequestId: string, tag: string): boolean {
  try {
    const expected = hmacFor(fullRequestId);
    if (expected.length !== tag.length) return false;
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(tag));
  } catch {
    return false;
  }
}
