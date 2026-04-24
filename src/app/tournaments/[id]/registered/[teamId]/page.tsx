import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";
import { formatTournamentDate, formatTime } from "@/lib/format";
import { categoryLabelI18n, getLocale, pick, t } from "@/lib/i18n";
import { PublicHeader } from "@/components/public-header";
import { PublicFooter } from "@/components/public-footer";
import { AccountCta } from "./account-cta";

export const dynamic = "force-dynamic";

export default async function RegisteredPage({
  params,
}: {
  params: Promise<{ id: string; teamId: string }>;
}) {
  const { id, teamId } = await params;
  const locale = await getLocale();
  const d = t(locale);

  const admin = createAdminClient();
  const isUuid = /^[0-9a-f-]{36}$/i.test(id);

  const { data: team } = await admin
    .from("teams")
    .select(
      `id, status, payment_status,
       tournament:tournaments!inner (
         id, slug, title, title_es, start_date, end_date, start_time, timezone,
         location, location_es, payment_qr_url, payment_instructions, payment_instructions_es,
         status
       ),
       category:tournament_categories!inner (id, type, rating, label, label_es),
       players (id, first_name, last_name, email, is_captain)`
    )
    .eq("id", teamId)
    .limit(1)
    .single();

  if (!team) notFound();
  const tour = team.tournament as unknown as {
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
    status: string;
  };
  // If the URL id doesn't match the tournament's slug/id, redirect-worthy but
  // also fine to just render (team is source of truth).
  if (isUuid ? tour.id !== id : tour.slug !== id) {
    // URL slug is stale; just continue, team is trusted
  }
  const cat = team.category as unknown as {
    id: string;
    type: "MD" | "WD" | "MXD";
    rating: string;
    label: string | null;
    label_es: string | null;
  };
  const players = team.players as unknown as {
    first_name: string;
    last_name: string;
    email: string;
    is_captain: boolean;
  }[];

  const user = await getCurrentUser();
  const title = pick<string>(tour.title, tour.title_es ?? "", locale);
  const location = pick<string>(tour.location, tour.location_es ?? "", locale);
  const instructions = pick<string>(
    tour.payment_instructions ?? "",
    tour.payment_instructions_es ?? "",
    locale
  );
  const catLabel = categoryLabelI18n(cat, locale);

  const isWaitlisted = team.status === "waitlisted";

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950">
      <PublicHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6 sm:px-6 sm:py-10">
        <div className="rounded-2xl border border-emerald-700/50 bg-emerald-950/20 p-6 sm:p-8">
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.2em] text-emerald-400">
            {isWaitlisted
              ? locale === "es" ? "En lista de espera" : "Waitlisted"
              : locale === "es" ? "Inscrito" : "Registered"}
          </p>
          <h1 className="mb-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            {isWaitlisted ? d.success_waitlisted_title : d.success_registered_title}
          </h1>
          <p className="mb-6 text-sm text-emerald-100/80 sm:text-base">
            {isWaitlisted ? d.success_waitlisted_desc : d.success_registered_desc}
          </p>

          <div className="rounded-xl border border-emerald-800/50 bg-emerald-950/30 p-4 text-sm text-emerald-50">
            <p className="text-xs uppercase tracking-wider text-emerald-400">{title}</p>
            <p className="mt-1 text-sm text-emerald-100">
              {formatTournamentDate(tour.start_date, tour.end_date, tour.timezone)} ·{" "}
              {formatTime(tour.start_time, tour.timezone)} · {location}
            </p>
            <p className="mt-2 text-sm">
              <strong>{catLabel}</strong> — {players.map((p) => `${p.first_name} ${p.last_name}`).join(" / ")}
            </p>
          </div>
        </div>

        {(tour.payment_qr_url || instructions) && !isWaitlisted && (
          <section className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-400">
              {d.payment_info}
            </h2>
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
              {tour.payment_qr_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={tour.payment_qr_url}
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
          <AccountCta
            nextPath={`/tournaments/${tour.slug}/registered/${team.id}`}
            prefillEmail={players.find((p) => p.is_captain)?.email ?? players[0]?.email ?? ""}
            prefillFirstName={players.find((p) => p.is_captain)?.first_name ?? ""}
            prefillLastName={players.find((p) => p.is_captain)?.last_name ?? ""}
            locale={locale}
          />
        ) : (
          <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-5 text-center sm:p-6">
            <p className="mb-3 text-sm text-zinc-300">
              {locale === "es"
                ? "Tu inscripción está guardada en tu perfil."
                : "Your registration is saved to your profile."}
            </p>
            <Link
              href="/me"
              className="inline-block rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
            >
              {locale === "es" ? "Ver mi perfil →" : "View my profile →"}
            </Link>
          </div>
        )}

        <div className="mt-6 text-center">
          <Link href={`/tournaments/${tour.slug}`} className="text-xs text-zinc-500 hover:text-zinc-300">
            ← {locale === "es" ? "Volver al torneo" : "Back to tournament"}
          </Link>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
