import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateIcs } from "@/lib/ics";

/**
 * Public ICS download for a lesson. Anyone with the lesson id can grab
 * the calendar entry — same trust model as the magic-link approach
 * we use elsewhere: knowing the UUID is the credential. Uses a `Lesson`
 * UID so when a calendar app re-fetches it (the user re-opens the
 * email later) it updates the existing entry instead of creating a
 * duplicate.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const admin = createAdminClient();

  const { data: lesson } = await admin
    .from("lessons")
    .select(
      `id, starts_at, duration_minutes, location, notes, status,
       coach:coach_profiles (display_name)`
    )
    .eq("id", id)
    .maybeSingle();

  if (!lesson) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const coach = lesson.coach as unknown as { display_name?: string } | null;
  const coachName = coach?.display_name ?? "your coach";

  const ics = generateIcs({
    uid: `lesson-${lesson.id}@buentiro.app`,
    startsAt: lesson.starts_at,
    durationMinutes: lesson.duration_minutes,
    summary: `Pickleball lesson with ${coachName}`,
    description: lesson.notes ?? undefined,
    location: lesson.location ?? undefined,
    status: lesson.status as "scheduled" | "cancelled" | "completed" | "no_show",
  });

  return new NextResponse(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="lesson-${lesson.id}.ics"`,
      "Cache-Control": "no-store",
    },
  });
}
