import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentMembership } from "@/lib/auth";
import { formatDuration, formatLessonWhen } from "@/lib/format";
import { googleCalendarUrl, outlookCalendarUrl } from "@/lib/ics";
import { whatsappUrl } from "@/lib/phone";
import { LessonActions } from "./lesson-actions";
import type { Lesson } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminLessonDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const res = await getCurrentMembership();
  if (res.status !== "ok") return null;
  if (res.workspaceKind !== "coach") redirect("/admin");
  const { id } = await params;

  const admin = createAdminClient();
  const { data } = await admin
    .from("lessons")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", res.member.workspace_id)
    .maybeSingle();
  if (!data) notFound();
  const lesson = data as Lesson;

  const { data: profile } = await admin
    .from("coach_profiles")
    .select("display_name")
    .eq("workspace_id", res.member.workspace_id)
    .maybeSingle();
  const coachName = profile?.display_name ?? "your coach";

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://buentiro.app";
  const calEvent = {
    uid: `lesson-${lesson.id}@buentiro.app`,
    startsAt: lesson.starts_at,
    durationMinutes: lesson.duration_minutes,
    summary: `Lesson with ${lesson.player_first_name} ${lesson.player_last_name}`,
    description: lesson.notes ?? undefined,
    location: lesson.location ?? undefined,
    status: lesson.status as "scheduled" | "cancelled" | "completed" | "no_show",
  };
  const gcalCoach = googleCalendarUrl(calEvent);
  const outlookCoach = outlookCalendarUrl(calEvent);
  const icsUrl = `${siteUrl}/api/lessons/${lesson.id}/ics`;

  const greeting = `Hi ${lesson.player_first_name}, this is ${coachName} — looking forward to our lesson on ${formatLessonWhen(lesson.starts_at, lesson.timezone)}.`;
  const wa = lesson.player_phone ? whatsappUrl(lesson.player_phone, greeting) : null;

  return (
    <div>
      <div className="mb-6">
        <Link href="/admin/lessons" className="text-xs text-zinc-500 hover:text-white">
          ← All lessons
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-white">
          {lesson.player_first_name} {lesson.player_last_name}
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          {formatLessonWhen(lesson.starts_at, lesson.timezone)} ·{" "}
          {formatDuration(lesson.duration_minutes)}
          {lesson.location && <> · {lesson.location}</>}
        </p>
      </div>

      <div className="space-y-6">
        <LessonActions lesson={lesson} />

        <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="mb-3 text-sm font-semibold text-white">Add to your calendar</h2>
          <div className="flex flex-wrap gap-2">
            <a
              href={gcalCoach}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md border border-emerald-700 bg-emerald-950/40 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-950/60"
            >
              Add to Google Calendar
            </a>
            <a
              href={icsUrl}
              className="rounded-md border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:border-zinc-700"
            >
              Apple / Outlook (.ics)
            </a>
            <a
              href={outlookCoach}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:border-zinc-700"
            >
              Outlook web
            </a>
          </div>
          <p className="mt-3 text-xs text-zinc-500">
            The player has already been emailed an invite with the same options. Use these to drop the lesson onto your phone calendar.
          </p>
        </section>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="mb-3 text-sm font-semibold text-white">Player contact</h2>
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={`mailto:${lesson.player_email}`}
              className="rounded-md border border-zinc-800 bg-zinc-950 px-2.5 py-1 text-xs text-zinc-200 hover:border-emerald-700 hover:text-emerald-400"
            >
              ✉ {lesson.player_email}
            </a>
            {wa && (
              <a
                href={wa}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md border border-emerald-700 bg-emerald-950/40 px-2.5 py-1 text-xs font-medium text-emerald-300 hover:bg-emerald-950/60"
              >
                WhatsApp
              </a>
            )}
            {lesson.player_phone && (
              <a
                href={`tel:${lesson.player_phone}`}
                className="rounded-md border border-zinc-800 bg-zinc-950 px-2.5 py-1 text-xs text-zinc-200 hover:border-emerald-700 hover:text-emerald-400"
              >
                ☎ {lesson.player_phone}
              </a>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="mb-3 text-sm font-semibold text-white">Details</h2>
          <dl className="grid gap-4 sm:grid-cols-2">
            <Detail label="Type" value={lesson.lesson_type ?? "Not specified"} />
            <Detail
              label="Price"
              value={lesson.price_cents != null ? `$${(lesson.price_cents / 100).toFixed(2)}` : "Not set"}
            />
            {lesson.location && <Detail label="Where" value={lesson.location} />}
            {lesson.google_maps_url && (
              <div>
                <dt className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Directions</dt>
                <dd className="mt-0.5">
                  <a
                    href={lesson.google_maps_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-400 hover:text-emerald-300"
                  >
                    Open in Google Maps →
                  </a>
                </dd>
              </div>
            )}
            {lesson.notes && <Detail label="Notes (private)" value={lesson.notes} fullWidth />}
            {lesson.lesson_request_id && (
              <div className="sm:col-span-2">
                <dt className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Source</dt>
                <dd className="mt-0.5">
                  <Link
                    href={`/admin/lesson-requests/${lesson.lesson_request_id}`}
                    className="text-emerald-400 hover:text-emerald-300"
                  >
                    Original lesson request →
                  </Link>
                </dd>
              </div>
            )}
          </dl>
        </section>

        <div>
          <Link
            href={`/admin/lessons/${lesson.id}/edit`}
            className="inline-block rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm text-zinc-200 hover:border-zinc-700 hover:text-white"
          >
            Edit lesson
          </Link>
        </div>
      </div>
    </div>
  );
}

function Detail({
  label,
  value,
  fullWidth,
}: {
  label: string;
  value: string;
  fullWidth?: boolean;
}) {
  return (
    <div className={fullWidth ? "sm:col-span-2" : ""}>
      <dt className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">{label}</dt>
      <dd className="mt-0.5 whitespace-pre-wrap text-sm text-zinc-100">{value}</dd>
    </div>
  );
}

