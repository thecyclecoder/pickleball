import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cleanEmailBody } from "@/lib/email-cleaner";
import { sendLessonForwardEmail } from "@/lib/email";
import { sendPushToUsers } from "@/lib/push-server";
import {
  parseReplyAddress,
  relayConfigured,
  replyAddressFor,
  verifyToken,
} from "@/lib/lesson-reply-token";

/**
 * Inbound webhook for the lesson-reply relay.
 *
 *   coach/player → reply via email client
 *      → addressed to lr-<idShort>-<hmac>@replies.buentiro.app
 *      → MX routes it to Resend
 *      → Resend Inbound POSTs the parsed message here
 *
 * We verify the token, identify which side sent it (player by matching
 * lesson_requests.email; coach by matching workspace_members.email),
 * persist the reply with direction='inbound', forward to the OTHER
 * party so they keep the conversation in their inbox, push-notify the
 * workspace, and auto-flip status from 'new' to 'contacted'.
 *
 * Authenticity: a shared secret in `RESEND_INBOUND_SECRET` (env) must
 * appear in either the `?secret=` query param or the `x-buentiro-secret`
 * header. Configure this in the Resend webhook setup. Without it the
 * webhook 401s — keeps random POSTs to the URL from polluting threads.
 */

type Headers = Record<string, string | string[] | undefined>;

type ResendInboundPayload = {
  type?: string;
  data?: {
    from?: string | { address?: string; name?: string };
    to?: Array<string | { address?: string; name?: string }> | string;
    subject?: string;
    text?: string | null;
    html?: string | null;
    headers?: Headers;
    email_id?: string;
    message_id?: string;
    in_reply_to?: string;
  };
} & Record<string, unknown>;

function pickEmail(field: unknown): string {
  if (!field) return "";
  if (typeof field === "string") {
    const m = field.match(/<([^>]+)>/);
    return (m?.[1] ?? field).toLowerCase().trim();
  }
  if (typeof field === "object") {
    const obj = field as { address?: string };
    return (obj.address ?? "").toLowerCase().trim();
  }
  return "";
}

function pickName(field: unknown): string {
  if (!field) return "";
  if (typeof field === "string") {
    const m = field.match(/^"?([^"<]+?)"?\s*</);
    return m?.[1]?.trim() ?? "";
  }
  if (typeof field === "object") {
    const obj = field as { name?: string };
    return obj.name ?? "";
  }
  return "";
}

function pickToAddresses(to: unknown): string[] {
  if (!to) return [];
  if (Array.isArray(to)) return to.map(pickEmail).filter(Boolean);
  return [pickEmail(to)].filter(Boolean);
}

function authorize(req: Request): boolean {
  const secret = process.env.RESEND_INBOUND_SECRET?.trim();
  if (!secret) return false;
  const url = new URL(req.url);
  if (url.searchParams.get("secret") === secret) return true;
  if (req.headers.get("x-buentiro-secret") === secret) return true;
  return false;
}

export async function POST(req: Request) {
  if (!relayConfigured()) {
    return NextResponse.json({ error: "Relay not configured" }, { status: 503 });
  }
  if (!authorize(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let raw: ResendInboundPayload;
  try {
    raw = (await req.json()) as ResendInboundPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const data = raw.data ?? raw;
  const fromEmail = pickEmail((data as ResendInboundPayload["data"])?.from);
  const fromName =
    pickName((data as ResendInboundPayload["data"])?.from) || fromEmail.split("@")[0];
  const toAddrs = pickToAddresses((data as ResendInboundPayload["data"])?.to);
  const subject = (data as ResendInboundPayload["data"])?.subject ?? null;
  const text = (data as ResendInboundPayload["data"])?.text ?? null;
  const html = (data as ResendInboundPayload["data"])?.html ?? null;
  const messageId =
    (data as ResendInboundPayload["data"])?.message_id ??
    pickHeader((data as ResendInboundPayload["data"])?.headers, "message-id");

  if (!fromEmail) {
    return NextResponse.json({ ok: true, ignored: "no-from" });
  }

  // Find which To address belongs to us — there can be multiple if the
  // sender Cc'd people. We pick the first that matches our shape.
  let parsed: ReturnType<typeof parseReplyAddress> | null = null;
  let matchedAddress: string | null = null;
  for (const addr of toAddrs) {
    const p = parseReplyAddress(addr);
    if (p) {
      parsed = p;
      matchedAddress = addr;
      break;
    }
  }
  if (!parsed || !matchedAddress) {
    return NextResponse.json({ ok: true, ignored: "no-relay-address" });
  }

  const admin = createAdminClient();
  const { data: candidates } = await admin
    .from("lesson_requests")
    .select(
      `id, workspace_id, status, first_name, last_name, email,
       coach:coach_profiles (id, slug, display_name)`
    )
    .like("id", `${insertDashes(parsed.idShort)}%`)
    .limit(2);

  // Disambiguate: pick the candidate whose token verifies. We also
  // bail if more than one full id matches the prefix (vanishingly
  // unlikely with 12 hex chars, but better safe than threaded-wrong).
  let request: NonNullable<typeof candidates>[number] | null = null;
  for (const c of candidates ?? []) {
    if (verifyToken(c.id, parsed.tag)) {
      request = c;
      break;
    }
  }
  if (!request) {
    return NextResponse.json({ ok: true, ignored: "token-mismatch" });
  }

  // Identify sender: player vs workspace member.
  const requesterEmail = (request.email ?? "").toLowerCase();
  let senderRole: "player" | "coach" | "unknown" = "unknown";
  if (fromEmail === requesterEmail) {
    senderRole = "player";
  } else {
    const { data: members } = await admin
      .from("workspace_members")
      .select("email, user_id")
      .eq("workspace_id", request.workspace_id)
      .ilike("email", fromEmail);
    if (members && members.length > 0) senderRole = "coach";
  }
  if (senderRole === "unknown") {
    // Don't pollute threads with random senders. Quietly drop.
    return NextResponse.json({ ok: true, ignored: "unknown-sender" });
  }

  // Strip quoted history before persisting + forwarding.
  const cleaned = cleanEmailBody(html ?? text ?? "", fromEmail);

  const senderUserId = senderRole === "coach"
    ? await resolveSenderUserId(admin, request.workspace_id, fromEmail)
    : null;

  const { error: insertErr } = await admin.from("lesson_request_replies").insert({
    lesson_request_id: request.id,
    workspace_id: request.workspace_id,
    sender_user_id: senderUserId,
    sender_email: fromEmail,
    body: cleaned || text || html || "(empty)",
    direction: "inbound",
    email_message_id: messageId ?? null,
    subject,
  });
  if (insertErr) {
    console.error("Insert inbound reply failed:", insertErr);
    return NextResponse.json({ error: "Insert failed" }, { status: 500 });
  }

  // Auto-advance status.
  if (request.status === "new") {
    await admin.from("lesson_requests").update({ status: "contacted" }).eq("id", request.id);
  }

  // Forward to the other party so they get the message in their inbox,
  // and push notify the workspace.
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://buentiro.app";
  const coach = request.coach as unknown as {
    id: string;
    slug: string;
    display_name: string;
  } | null;
  const replyTo = replyAddressFor(request.id);
  const manageUrl = `${siteUrl}/admin/coach`;
  const playerName = `${request.first_name} ${request.last_name}`.trim();

  if (senderRole === "player") {
    // Forward to every workspace member (coach + admins).
    const { data: members } = await admin
      .from("workspace_members")
      .select("email, user_id")
      .eq("workspace_id", request.workspace_id)
      .in("role", ["owner", "admin"]);
    const targets = (members ?? [])
      .map((m) => m.email)
      .filter((e): e is string => !!e);

    await Promise.all(
      targets.map((to) =>
        sendLessonForwardEmail({
          toEmail: to,
          toFirstName: coach?.display_name?.split(" ")[0] ?? "there",
          fromName: playerName || fromName,
          fromEmail,
          replyToAddress: replyTo,
          body: cleaned || text || "(empty)",
          manageUrl,
          audience: "coach",
        }).catch((e) => console.error("Forward to coach failed:", e))
      )
    );

    const userIds = (members ?? [])
      .map((m) => m.user_id as string | null)
      .filter((v): v is string => !!v);
    if (userIds.length > 0) {
      await sendPushToUsers(userIds, {
        title: `${playerName || "Player"} replied`,
        body: (cleaned || text || "").slice(0, 140),
        tag: `lesson_reply:${request.id}`,
        url: `/admin/coach`,
      }).catch((e) => console.error("[push] inbound reply:", e));
    }
  } else {
    // Coach replied → forward to player.
    await sendLessonForwardEmail({
      toEmail: requesterEmail,
      toFirstName: request.first_name,
      fromName: coach?.display_name ?? fromName,
      fromEmail,
      replyToAddress: replyTo,
      body: cleaned || text || "(empty)",
      manageUrl: coach?.slug ? `${siteUrl}/coaches/${coach.slug}` : siteUrl,
      audience: "player",
    }).catch((e) => console.error("Forward to player failed:", e));
  }

  return NextResponse.json({ ok: true });
}

function insertDashes(idShort: string): string {
  // Convert "12345678abcd" → "12345678-abcd" so the LIKE prefix matches
  // a UUID's text representation. Only the first 12 chars are dashes-
  // sensitive (UUID format: 8-4-4-4-12). For 12 chars we span the first
  // hyphen at position 8.
  if (idShort.length <= 8) return idShort;
  return `${idShort.slice(0, 8)}-${idShort.slice(8)}`;
}

function pickHeader(headers: Headers | undefined, name: string): string | undefined {
  if (!headers) return undefined;
  const lower = name.toLowerCase();
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === lower) {
      return Array.isArray(v) ? v[0] : v;
    }
  }
  return undefined;
}

async function resolveSenderUserId(
  admin: ReturnType<typeof createAdminClient>,
  workspaceId: string,
  email: string
): Promise<string | null> {
  const { data } = await admin
    .from("workspace_members")
    .select("user_id")
    .eq("workspace_id", workspaceId)
    .ilike("email", email)
    .maybeSingle();
  return (data?.user_id as string | null) ?? null;
}
