import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireMember } from "@/lib/api";
import { LESSON_STATUSES, LESSON_TYPES } from "@/lib/types";
import { sendLessonScheduledEmail } from "@/lib/email";
import { googleCalendarUrl } from "@/lib/ics";
import { formatDuration, formatLessonWhen } from "@/lib/format";
import { relayConfigured, replyAddressFor } from "@/lib/lesson-reply-token";

const ALLOWED = [
  "starts_at",
  "duration_minutes",
  "timezone",
  "location",
  "google_maps_url",
  "lesson_type",
  "price_cents",
  "status",
  "notes",
  "player_first_name",
  "player_last_name",
  "player_email",
  "player_phone",
] as const;

async function load(
  admin: ReturnType<typeof createAdminClient>,
  id: string,
  workspaceId: string
) {
  const { data } = await admin
    .from("lessons")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  return data;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireMember();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const admin = createAdminClient();
  const lesson = await load(admin, id, auth.ctx.member.workspace_id);
  if (!lesson) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ lesson });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireMember();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const admin = createAdminClient();
  const existing = await load(admin, id, auth.ctx.member.workspace_id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const updates: Record<string, unknown> = {};
  for (const key of ALLOWED) {
    if (key in body) {
      const v = body[key];
      updates[key] = v === "" ? null : v;
    }
  }
  // Validation
  if ("status" in updates) {
    const s = updates.status as string;
    if (!(LESSON_STATUSES as readonly string[]).includes(s)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
  }
  if ("lesson_type" in updates && updates.lesson_type !== null) {
    const t = updates.lesson_type as string;
    if (!(LESSON_TYPES as readonly string[]).includes(t)) {
      return NextResponse.json({ error: "Invalid lesson type" }, { status: 400 });
    }
  }
  if ("starts_at" in updates && updates.starts_at) {
    const d = new Date(updates.starts_at as string);
    if (isNaN(d.getTime())) {
      return NextResponse.json({ error: "Invalid start time" }, { status: 400 });
    }
    updates.starts_at = d.toISOString();
  }
  if ("duration_minutes" in updates) {
    const d = Number(updates.duration_minutes);
    if (!Number.isFinite(d) || d <= 0 || d > 1440) {
      return NextResponse.json({ error: "Invalid duration" }, { status: 400 });
    }
    updates.duration_minutes = d;
  }
  if ("price_cents" in updates && updates.price_cents !== null) {
    const p = Number(updates.price_cents);
    if (!Number.isFinite(p) || p < 0) {
      return NextResponse.json({ error: "Invalid price" }, { status: 400 });
    }
    updates.price_cents = p;
  }
  // Paid is its own field, toggled separately
  if (body.paid !== undefined) {
    updates.paid_at = body.paid ? new Date().toISOString() : null;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No updates" }, { status: 400 });
  }

  const { data, error } = await admin
    .from("lessons")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // If reschedule or cancel, send a follow-up email so the player updates
  // their calendar. Reschedule = starts_at changed; cancel = status='cancelled'.
  const startChanged =
    "starts_at" in updates &&
    new Date(existing.starts_at).getTime() !== new Date(data.starts_at).getTime();
  const cancelled = data.status === "cancelled" && existing.status !== "cancelled";
  if ((startChanged || cancelled) && body.send_invite !== false) {
    const { data: profile } = await admin
      .from("coach_profiles")
      .select("id, display_name")
      .eq("workspace_id", auth.ctx.member.workspace_id)
      .maybeSingle();
    const coachName = profile?.display_name ?? auth.ctx.member.email ?? "your coach";
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://buentiro.app";
    const calEvent = {
      uid: `lesson-${data.id}@buentiro.app`,
      startsAt: data.starts_at,
      durationMinutes: data.duration_minutes,
      summary: `Pickleball lesson with ${coachName}`,
      description: data.notes ?? "",
      location: data.location ?? undefined,
    };
    const replyTo = data.lesson_request_id && relayConfigured()
      ? replyAddressFor(data.lesson_request_id)
      : undefined;
    await sendLessonScheduledEmail({
      toEmail: data.player_email,
      toFirstName: data.player_first_name,
      coachName,
      whenLabel: formatLessonWhen(data.starts_at, data.timezone),
      durationLabel: formatDuration(data.duration_minutes),
      location: data.location,
      googleMapsUrl: data.google_maps_url,
      notes: data.notes,
      icsUrl: `${siteUrl}/api/lessons/${data.id}/ics`,
      googleCalendarUrl: googleCalendarUrl(calEvent),
      replyToAddress: replyTo,
      cancelled,
    }).catch((e) => console.error("Lesson update email failed:", e));
  }

  return NextResponse.json({ lesson: data });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireMember();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const admin = createAdminClient();
  const existing = await load(admin, id, auth.ctx.member.workspace_id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { error } = await admin.from("lessons").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
