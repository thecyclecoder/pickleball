import crypto from "crypto";
import { NextResponse } from "next/server";

/**
 * WhatsApp Cloud API webhook.
 *
 * GET — Meta's one-time verification handshake. They hit our URL with
 *   ?hub.mode=subscribe&hub.verify_token=<our token>&hub.challenge=<random>
 * and we echo `hub.challenge` back as plain text iff the verify token
 * matches META_WHATSAPP_WEBHOOK_VERIFY_TOKEN.
 *
 * POST — every inbound message + status update arrives here. We verify
 * Meta's HMAC signature against META_WHATSAPP_APP_SECRET (the
 * x-hub-signature-256 header is "sha256=<hex>"). Bodies are logged for
 * now; routing into lesson_request_replies + push notifications lands
 * in the next pass once we can actually send templates and exchange
 * messages end-to-end.
 */

export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  const expected = process.env.META_WHATSAPP_WEBHOOK_VERIFY_TOKEN?.trim();
  if (!expected) {
    console.error("[whatsapp webhook] missing META_WHATSAPP_WEBHOOK_VERIFY_TOKEN");
    return new NextResponse("Misconfigured", { status: 500 });
  }

  if (mode === "subscribe" && token === expected && challenge) {
    return new NextResponse(challenge, {
      status: 200,
      headers: { "content-type": "text/plain" },
    });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-hub-signature-256");

  if (!verifySignature(rawBody, signature)) {
    return new NextResponse("Invalid signature", { status: 403 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new NextResponse("Invalid JSON", { status: 400 });
  }

  // TODO (next pass, once a real phone number is wired):
  //   - Route incoming messages into lesson_request_replies with
  //     channel='whatsapp' (mirrors the email inbound path)
  //   - Push-notify the workspace
  //   - Update message statuses (delivered, read, failed) on outbound
  //     messages we sent so the panel can show them
  // For now we ACK so Meta doesn't retry, and log for visibility.
  console.log("[whatsapp webhook] inbound:", JSON.stringify(payload));

  return new NextResponse("OK", { status: 200 });
}

function verifySignature(rawBody: string, signature: string | null): boolean {
  if (!signature) return false;
  const secret = process.env.META_WHATSAPP_APP_SECRET?.trim();
  if (!secret) return false;
  try {
    const expected =
      "sha256=" +
      crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
    if (expected.length !== signature.length) return false;
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch (e) {
    console.error("[whatsapp webhook] signature verify failed:", e);
    return false;
  }
}
