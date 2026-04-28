import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";
import {
  CLINIC_RATING_OPTIONS,
  LESSON_TYPES,
  lessonTypeLabel,
  type ClinicRating,
  type LessonType,
} from "@/lib/types";
import {
  generateMagicLink,
  sendLessonRequestCoachEmail,
  sendLessonRequestRequesterEmail,
} from "@/lib/email";
import { sendPushToUsers } from "@/lib/push-server";
import { relayConfigured, replyAddressFor } from "@/lib/lesson-reply-token";

type Body = {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  skill_level?: string;
  lesson_type?: string;
  goals?: string;
  schedule_notes?: string;
};

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const admin = createAdminClient();
  const body = (await req.json().catch(() => ({}))) as Body;

  const first = (body.first_name ?? "").trim();
  const last = (body.last_name ?? "").trim();
  const email = (body.email ?? "").trim().toLowerCase();
  const phone = (body.phone ?? "").trim() || null;
  const skill = (body.skill_level ?? "").toString().trim();
  const lessonTypeRaw = (body.lesson_type ?? "").toString().trim();
  const goals = (body.goals ?? "").trim() || null;
  const scheduleNotes = (body.schedule_notes ?? "").trim() || null;

  if (!first) return NextResponse.json({ error: "First name is required" }, { status: 400 });
  if (!last) return NextResponse.json({ error: "Last name is required" }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
  }
  if (!(CLINIC_RATING_OPTIONS as readonly string[]).includes(skill)) {
    return NextResponse.json({ error: "Pick a skill level" }, { status: 400 });
  }
  let lessonType: LessonType | null = null;
  if (lessonTypeRaw) {
    if (!(LESSON_TYPES as readonly string[]).includes(lessonTypeRaw)) {
      return NextResponse.json({ error: "Invalid lesson type" }, { status: 400 });
    }
    lessonType = lessonTypeRaw as LessonType;
  }

  const { data: coach } = await admin
    .from("coach_profiles")
    .select("id, slug, workspace_id, display_name, status, accepting_requests")
    .eq("slug", slug)
    .maybeSingle();
  if (!coach || coach.status !== "published") {
    return NextResponse.json({ error: "Coach not found" }, { status: 404 });
  }
  if (!coach.accepting_requests) {
    return NextResponse.json({ error: "This coach is not accepting requests right now" }, { status: 400 });
  }

  const currentUser = await getCurrentUser();
  const matchedSelfId =
    currentUser && currentUser.email && currentUser.email.toLowerCase() === email
      ? currentUser.id
      : null;

  const { data: reqRow, error: insertErr } = await admin
    .from("lesson_requests")
    .insert({
      coach_profile_id: coach.id,
      first_name: first,
      last_name: last,
      email,
      phone,
      skill_level: skill as ClinicRating,
      lesson_type: lessonType,
      goals,
      schedule_notes: scheduleNotes,
      user_id: matchedSelfId,
    })
    .select()
    .single();
  if (insertErr || !reqRow) {
    return NextResponse.json(
      { error: insertErr?.message ?? "Failed to submit request" },
      { status: 500 }
    );
  }

  // Reply-To routing: when the relay is configured, both the requester
  // confirmation and the coach notification use the per-request relay
  // address so any reply lands in the inbound webhook and gets captured.
  const replyTo = relayConfigured() ? replyAddressFor(reqRow.id) : null;

  await Promise.all([
    sendRequesterConfirmation({
      coachName: coach.display_name,
      coachSlug: coach.slug,
      first,
      last,
      email,
      phone,
      skill,
      lessonType,
      goals,
      scheduleNotes,
    }).catch((e) => console.error("Lesson req requester email failed:", e)),
    notifyCoachWorkspace({
      coachId: coach.id,
      coachName: coach.display_name,
      workspaceId: coach.workspace_id,
      requesterName: `${first} ${last}`,
      replyToAddress: replyTo ?? email,
    }).catch((e) => console.error("Lesson req coach notify failed:", e)),
  ]);

  return NextResponse.json({ request_id: reqRow.id });
}

async function sendRequesterConfirmation(args: {
  coachName: string;
  coachSlug: string;
  first: string;
  last: string;
  email: string;
  phone: string | null;
  skill: string;
  lessonType: LessonType | null;
  goals: string | null;
  scheduleNotes: string | null;
}) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://buentiro.app";
  const link = await generateMagicLink(args.email).catch((e) => {
    console.error("magic link lesson req failed:", e);
    return `${siteUrl}/login`;
  });
  await sendLessonRequestRequesterEmail({
    toEmail: args.email,
    toFirstName: args.first,
    toLastName: args.last,
    toPhone: args.phone,
    coachName: args.coachName,
    coachUrl: `${siteUrl}/coaches/${args.coachSlug}`,
    confirmLink: link,
    skillLevel: args.skill === "beginner" ? "Beginner" : args.skill,
    lessonType: args.lessonType ? lessonTypeLabel(args.lessonType, "en") : null,
    goals: args.goals,
    scheduleNotes: args.scheduleNotes,
  });
}

async function notifyCoachWorkspace(args: {
  coachId: string;
  coachName: string;
  workspaceId: string;
  requesterName: string;
  replyToAddress: string;
}) {
  const admin = createAdminClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://buentiro.app";

  const { data: members } = await admin
    .from("workspace_members")
    .select("user_id, email, role")
    .eq("workspace_id", args.workspaceId)
    .in("role", ["owner", "admin"]);

  const userIds = (members ?? [])
    .map((m) => m.user_id as string | null)
    .filter((v): v is string => !!v);
  const memberEmails = (members ?? [])
    .map((m) => m.email)
    .filter((e): e is string => !!e);

  if (userIds.length > 0) {
    await sendPushToUsers(userIds, {
      title: `New lesson request: ${args.coachName}`,
      body: `${args.requesterName} requested a lesson — tap to reply`,
      tag: `lesson_request:${args.coachId}`,
      url: `/admin/coach`,
    }).catch((e) => console.error("[push] lesson req:", e));
  }

  await Promise.all(
    memberEmails.map((to) =>
      sendLessonRequestCoachEmail({
        toEmail: to,
        coachName: args.coachName,
        requesterName: args.requesterName,
        manageUrl: `${siteUrl}/admin/coach`,
        replyToAddress: args.replyToAddress,
      }).catch((e) => console.error("Resend lesson req coach email failed:", e))
    )
  );
}
