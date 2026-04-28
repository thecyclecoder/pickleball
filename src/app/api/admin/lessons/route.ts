import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireMember } from "@/lib/api";
import { LESSON_TYPES, type LessonType } from "@/lib/types";
import { sendLessonScheduledEmail } from "@/lib/email";
import { googleCalendarUrl } from "@/lib/ics";
import { formatDuration, formatLessonWhen } from "@/lib/format";
import { relayConfigured, replyAddressFor } from "@/lib/lesson-reply-token";

export async function GET() {
  const auth = await requireMember();
  if (!auth.ok) return auth.response;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("lessons")
    .select("*")
    .eq("workspace_id", auth.ctx.member.workspace_id)
    .order("starts_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ lessons: data ?? [] });
}

export async function POST(req: Request) {
  const auth = await requireMember();
  if (!auth.ok) return auth.response;
  const body = await req.json().catch(() => ({}));

  const firstName = (body.player_first_name ?? "").toString().trim();
  const lastName = (body.player_last_name ?? "").toString().trim();
  const email = (body.player_email ?? "").toString().trim().toLowerCase();
  const phone = (body.player_phone ?? "").toString().trim() || null;
  const startsAt = (body.starts_at ?? "").toString().trim();
  const duration = Number(body.duration_minutes ?? 60);
  const timezone = (body.timezone ?? "America/Puerto_Rico").toString();
  const location = (body.location ?? "").toString().trim() || null;
  const googleMapsUrl = (body.google_maps_url ?? "").toString().trim() || null;
  const lessonTypeRaw = (body.lesson_type ?? "").toString().trim();
  const priceCents = body.price_cents == null || body.price_cents === ""
    ? null
    : Number(body.price_cents);
  const notes = (body.notes ?? "").toString().trim() || null;
  const lessonRequestId = body.lesson_request_id ?? null;
  const sendInvite = body.send_invite === false ? false : true;

  if (!firstName) return NextResponse.json({ error: "First name is required" }, { status: 400 });
  if (!lastName) return NextResponse.json({ error: "Last name is required" }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
  }
  if (!startsAt || isNaN(new Date(startsAt).getTime())) {
    return NextResponse.json({ error: "Start time is required" }, { status: 400 });
  }
  if (!Number.isFinite(duration) || duration <= 0 || duration > 1440) {
    return NextResponse.json({ error: "Invalid duration" }, { status: 400 });
  }
  let lessonType: LessonType | null = null;
  if (lessonTypeRaw) {
    if (!(LESSON_TYPES as readonly string[]).includes(lessonTypeRaw)) {
      return NextResponse.json({ error: "Invalid lesson type" }, { status: 400 });
    }
    lessonType = lessonTypeRaw as LessonType;
  }
  if (priceCents != null && (!Number.isFinite(priceCents) || priceCents < 0)) {
    return NextResponse.json({ error: "Invalid price" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Resolve the workspace's coach profile so we can attribute the
  // lesson and use the coach's display name in the calendar event.
  const { data: profile } = await admin
    .from("coach_profiles")
    .select("id, display_name")
    .eq("workspace_id", auth.ctx.member.workspace_id)
    .maybeSingle();
  const coachName = profile?.display_name ?? auth.ctx.member.email ?? "your coach";

  const { data: lesson, error } = await admin
    .from("lessons")
    .insert({
      workspace_id: auth.ctx.member.workspace_id,
      coach_profile_id: profile?.id ?? null,
      lesson_request_id: lessonRequestId,
      player_first_name: firstName,
      player_last_name: lastName,
      player_email: email,
      player_phone: phone,
      starts_at: new Date(startsAt).toISOString(),
      duration_minutes: duration,
      timezone,
      location,
      google_maps_url: googleMapsUrl,
      lesson_type: lessonType,
      price_cents: priceCents,
      notes,
    })
    .select()
    .single();
  if (error || !lesson) {
    return NextResponse.json({ error: error?.message ?? "Failed to create" }, { status: 500 });
  }

  // If converted from a lesson request, advance that request to scheduled.
  if (lessonRequestId) {
    await admin
      .from("lesson_requests")
      .update({ status: "scheduled" })
      .eq("id", lessonRequestId)
      .eq("workspace_id", auth.ctx.member.workspace_id);
  }

  if (sendInvite) {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://buentiro.app";
    const summary = `Pickleball lesson with ${coachName}`;
    const description = notes ?? "";
    const calEvent = {
      uid: `lesson-${lesson.id}@buentiro.app`,
      startsAt: lesson.starts_at,
      durationMinutes: lesson.duration_minutes,
      summary,
      description,
      location: location ?? undefined,
    };
    const replyTo = lessonRequestId && relayConfigured()
      ? replyAddressFor(lessonRequestId)
      : undefined;
    await sendLessonScheduledEmail({
      toEmail: email,
      toFirstName: firstName,
      coachName,
      whenLabel: formatLessonWhen(lesson.starts_at, lesson.timezone),
      durationLabel: formatDuration(lesson.duration_minutes),
      location,
      googleMapsUrl,
      notes,
      icsUrl: `${siteUrl}/api/lessons/${lesson.id}/ics`,
      googleCalendarUrl: googleCalendarUrl(calEvent),
      replyToAddress: replyTo,
    }).catch((e) => console.error("Lesson scheduled email failed:", e));
  }

  return NextResponse.json({ lesson });
}
