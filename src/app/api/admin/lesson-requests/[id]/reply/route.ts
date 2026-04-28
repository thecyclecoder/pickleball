import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireMember } from "@/lib/api";
import { getCurrentMembership, isSuperAdmin } from "@/lib/auth";
import { sendLessonReplyEmail } from "@/lib/email";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireMember();
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const body = await req.json().catch(() => ({}));
  const message = (body.message ?? "").toString().trim();
  if (!message) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }
  if (message.length > 5000) {
    return NextResponse.json({ error: "Message is too long (max 5000 chars)" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: reqRow } = await admin
    .from("lesson_requests")
    .select(
      `id, workspace_id, status, first_name, email,
       coach:coach_profiles (id, slug, display_name)`
    )
    .eq("id", id)
    .maybeSingle();
  if (!reqRow) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Authz — workspace member of the request's workspace, or super-admin.
  const membership = await getCurrentMembership();
  if (membership.status !== "ok") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (
    !isSuperAdmin(membership.user) &&
    reqRow.workspace_id !== membership.member.workspace_id
  ) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const senderEmail = membership.user.email ?? null;
  if (!senderEmail) {
    return NextResponse.json({ error: "Sender has no email on file" }, { status: 400 });
  }

  // Persist reply, then flip status to 'contacted' if it was 'new', then
  // send the branded email. Keep the email send inside the request so
  // the coach sees a clear error if it fails.
  const { error: insertErr } = await admin.from("lesson_request_replies").insert({
    lesson_request_id: reqRow.id,
    workspace_id: reqRow.workspace_id,
    sender_user_id: membership.user.id,
    sender_email: senderEmail,
    body: message,
  });
  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  if (reqRow.status === "new") {
    await admin.from("lesson_requests").update({ status: "contacted" }).eq("id", reqRow.id);
  }

  const coach = reqRow.coach as unknown as {
    id: string;
    slug: string;
    display_name: string;
  } | null;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://buentiro.app";

  try {
    await sendLessonReplyEmail({
      toEmail: reqRow.email,
      toFirstName: reqRow.first_name,
      coachName: coach?.display_name ?? "Your coach",
      coachReplyToEmail: senderEmail,
      body: message,
      coachUrl: coach?.slug ? `${siteUrl}/coaches/${coach.slug}` : siteUrl,
    });
  } catch (e) {
    console.error("Lesson reply email failed:", e);
    return NextResponse.json(
      { error: "Reply saved, but email delivery failed. Try again." },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true });
}
