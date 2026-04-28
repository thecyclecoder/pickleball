import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";
import { formatTournamentDate, formatTime } from "@/lib/format";
import { getLocale, pick } from "@/lib/i18n";
import { PublicHeader } from "@/components/public-header";
import { PublicFooter } from "@/components/public-footer";

export const dynamic = "force-dynamic";

export default async function ClinicRegisteredPage({
  params,
}: {
  params: Promise<{ id: string; regId: string }>;
}) {
  const { regId } = await params;
  const locale = await getLocale();
  const admin = createAdminClient();

  const { data: reg } = await admin
    .from("clinic_registrations")
    .select(
      `id, first_name, last_name, status, rating_self, age,
       clinic:clinics!inner (
         id, slug, title, title_es, start_date, end_date, start_time, timezone,
         location, location_es, payment_qr_url, payment_instructions, payment_instructions_es
       )`
    )
    .eq("id", regId)
    .limit(1)
    .single();
  if (!reg) notFound();

  const clinic = reg.clinic as unknown as {
    id: string;
    slug: string;
    title: string;
    title_es: string | null;
    start_date: string;
    end_date: string | null;
    start_time: string;
    timezone: string;
    location: string;
    location_es: string | null;
    payment_qr_url: string | null;
    payment_instructions: string | null;
    payment_instructions_es: string | null;
  };

  const user = await getCurrentUser();
  const title = pick<string>(clinic.title, clinic.title_es ?? "", locale);
  const location = pick<string>(clinic.location, clinic.location_es ?? "", locale);
  const instructions = pick<string>(
    clinic.payment_instructions ?? "",
    clinic.payment_instructions_es ?? "",
    locale
  );
  const isWaitlisted = reg.status === "waitlisted";

  const L =
    locale === "es"
      ? {
          headlineWaitlist: "¡Estás en la lista de espera!",
          headlineRegistered: "¡Estás inscrito!",
          descWaitlist:
            "La clínica está al máximo, así que estás en la lista de espera. Te avisaremos si se abre un cupo.",
          descRegistered:
            "Te enviamos un correo de confirmación con tu enlace de inicio de sesión. Completa el pago abajo para confirmar tu cupo.",
          checkInbox: "Revisa tu correo",
          checkInboxBody:
            "Te enviamos un enlace de confirmación. Haz clic en \"Confirma tu cupo\" en tu correo para iniciar sesión y guardar tu inscripción.",
          viewProfile: "Ver mi perfil →",
          payment: "Información de pago",
          back: "Volver a la clínica",
          tag: "Inscrito",
          tagWaitlist: "En lista de espera",
        }
      : {
          headlineWaitlist: "You're on the waitlist!",
          headlineRegistered: "You're signed up!",
          descWaitlist:
            "The clinic is full, so you're on the waitlist. We'll email you if a spot opens.",
          descRegistered:
            "We just emailed you a confirmation with a sign-in link. Complete payment below to lock in your spot.",
          checkInbox: "Check your email",
          checkInboxBody:
            "We sent a confirmation link. Click \"Confirm your spot\" in your inbox to sign in and save your registration.",
          viewProfile: "View my profile →",
          payment: "Payment info",
          back: "Back to clinic",
          tag: "Registered",
          tagWaitlist: "Waitlisted",
        };

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950">
      <PublicHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6 sm:px-6 sm:py-10">
        <div className="rounded-2xl border border-emerald-700/50 bg-emerald-950/20 p-6 sm:p-8">
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.2em] text-emerald-400">
            {isWaitlisted ? L.tagWaitlist : L.tag}
          </p>
          <h1 className="mb-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            {isWaitlisted ? L.headlineWaitlist : L.headlineRegistered}
          </h1>
          <p className="mb-6 text-sm text-emerald-100/80 sm:text-base">
            {isWaitlisted ? L.descWaitlist : L.descRegistered}
          </p>

          <div className="rounded-xl border border-emerald-800/50 bg-emerald-950/30 p-4 text-sm text-emerald-50">
            <p className="text-xs uppercase tracking-wider text-emerald-400">{title}</p>
            <p className="mt-1 text-sm text-emerald-100">
              {formatTournamentDate(clinic.start_date, clinic.end_date, clinic.timezone)} ·{" "}
              {formatTime(clinic.start_time, clinic.timezone)} · {location}
            </p>
            <p className="mt-2 text-sm">
              <strong>
                {reg.first_name} {reg.last_name}
              </strong>{" "}
              ·{" "}
              {reg.rating_self === "beginner"
                ? locale === "es" ? "Principiante" : "Beginner"
                : reg.rating_self}
              {" · "}
              {locale === "es" ? "edad" : "age"} {reg.age}
            </p>
          </div>
        </div>

        {(clinic.payment_qr_url || instructions) && !isWaitlisted && (
          <section className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-400">
              {L.payment}
            </h2>
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
              {clinic.payment_qr_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={clinic.payment_qr_url}
                  alt="Payment QR"
                  className="h-40 w-40 flex-shrink-0 rounded bg-white object-contain p-2"
                />
              )}
              {instructions && (
                <div className="min-w-0 flex-1 whitespace-pre-wrap text-sm leading-relaxed text-zinc-300">
                  {instructions}
                </div>
              )}
            </div>
          </section>
        )}

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
          <Link href={`/clinics/${clinic.slug}`} className="text-xs text-zinc-500 hover:text-zinc-300">
            ← {L.back}
          </Link>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
