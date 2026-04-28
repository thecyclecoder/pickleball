import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";
import { getLocale, pick } from "@/lib/i18n";
import { PublicHeader } from "@/components/public-header";
import { PublicFooter } from "@/components/public-footer";
import { clinicRatingLabel, lessonTypeLabel, type ClinicRating, type LessonType } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function CoachLessonRequestedPage({
  params,
}: {
  params: Promise<{ slug: string; reqId: string }>;
}) {
  const { reqId } = await params;
  const locale = await getLocale();
  const admin = createAdminClient();

  const { data: reqRow } = await admin
    .from("lesson_requests")
    .select(
      `id, first_name, last_name, skill_level, lesson_type,
       coach:coach_profiles!inner (
         id, slug, display_name, display_name_es
       )`
    )
    .eq("id", reqId)
    .limit(1)
    .single();
  if (!reqRow) notFound();

  const coach = reqRow.coach as unknown as {
    id: string;
    slug: string;
    display_name: string;
    display_name_es: string | null;
  };
  const user = await getCurrentUser();
  const coachName = pick<string>(coach.display_name, coach.display_name_es ?? "", locale);

  const L =
    locale === "es"
      ? {
          tag: "Solicitud enviada",
          headline: `¡Tu solicitud está en camino!`,
          desc: `Le enviamos tu solicitud a ${coachName}. Te contactarán por correo para coordinar la lección.`,
          checkInbox: "Revisa tu correo",
          checkInboxBody:
            "Te enviamos un enlace para iniciar sesión y guardar tu solicitud en tu perfil. Haz clic en \"Iniciar sesión\" en tu correo.",
          viewProfile: "Ver mi perfil →",
          back: "Volver al perfil del coach",
          summary: "Resumen",
        }
      : {
          tag: "Request sent",
          headline: `Your request is on its way!`,
          desc: `We sent your lesson request to ${coachName}. They'll reach out to you by email to schedule.`,
          checkInbox: "Check your email",
          checkInboxBody:
            "We sent a sign-in link so you can save this request to your profile. Click \"Sign in & track this\" in your inbox.",
          viewProfile: "View my profile →",
          back: "Back to coach",
          summary: "Summary",
        };

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950">
      <PublicHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6 sm:px-6 sm:py-10">
        <div className="rounded-2xl border border-emerald-700/50 bg-emerald-950/20 p-6 sm:p-8">
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.2em] text-emerald-400">{L.tag}</p>
          <h1 className="mb-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            {L.headline}
          </h1>
          <p className="mb-6 text-sm text-emerald-100/80 sm:text-base">{L.desc}</p>

          <div className="rounded-xl border border-emerald-800/50 bg-emerald-950/30 p-4 text-sm text-emerald-50">
            <p className="text-xs uppercase tracking-wider text-emerald-400">{L.summary}</p>
            <p className="mt-1 text-sm text-emerald-100">
              <strong>
                {reqRow.first_name} {reqRow.last_name}
              </strong>{" "}
              · {clinicRatingLabel(reqRow.skill_level as ClinicRating, locale)}
              {reqRow.lesson_type && (
                <>
                  {" · "}
                  {lessonTypeLabel(reqRow.lesson_type as LessonType, locale)}
                </>
              )}
            </p>
          </div>
        </div>

        {!user ? (
          <section className="mt-6 rounded-2xl border border-emerald-800/50 bg-emerald-950/10 p-5 sm:p-6">
            <h2 className="mb-2 text-lg font-semibold text-white">{L.checkInbox}</h2>
            <p className="text-sm text-zinc-300">{L.checkInboxBody}</p>
          </section>
        ) : (
          <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-5 text-center sm:p-6">
            <Link
              href="/me"
              className="inline-block rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
            >
              {L.viewProfile}
            </Link>
          </div>
        )}

        <div className="mt-6 text-center">
          <Link href={`/coaches/${coach.slug}`} className="text-xs text-zinc-500 hover:text-zinc-300">
            ← {L.back}
          </Link>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
