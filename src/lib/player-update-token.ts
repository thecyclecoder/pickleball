import crypto from "crypto";

/**
 * Signed token for the "update your contact info" email links.
 *
 * Format: base64url(`<player_id>.<sig>`) where sig is the first 16
 * hex chars of HMAC-SHA256(player_id, secret).
 *
 * Secret reuses LESSON_REPLY_TOKEN_SECRET — same security model
 * (long random server-side secret, deterministic per-id signature).
 * If we ever want to scope these to short expirations or rotate,
 * we add an issued-at timestamp to the payload.
 */

const SIG_LEN = 16;

function secret(): string {
  return process.env.LESSON_REPLY_TOKEN_SECRET?.trim() ?? "";
}

export function buildPlayerUpdateToken(playerId: string): string {
  const s = secret();
  if (!s) throw new Error("LESSON_REPLY_TOKEN_SECRET is not configured");
  const sig = crypto
    .createHmac("sha256", s)
    .update(playerId)
    .digest("hex")
    .slice(0, SIG_LEN);
  return Buffer.from(`${playerId}.${sig}`).toString("base64url");
}

export function parsePlayerUpdateToken(
  token: string | undefined | null
): { playerId: string } | null {
  if (!token) return null;
  const s = secret();
  if (!s) return null;
  let decoded: string;
  try {
    decoded = Buffer.from(token, "base64url").toString("utf8");
  } catch {
    return null;
  }
  const dot = decoded.lastIndexOf(".");
  if (dot < 0) return null;
  const playerId = decoded.slice(0, dot);
  const sig = decoded.slice(dot + 1);
  if (!playerId || sig.length !== SIG_LEN) return null;
  const expected = crypto
    .createHmac("sha256", s)
    .update(playerId)
    .digest("hex")
    .slice(0, SIG_LEN);
  if (expected.length !== sig.length) return null;
  try {
    if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return null;
  } catch {
    return null;
  }
  return { playerId };
}
