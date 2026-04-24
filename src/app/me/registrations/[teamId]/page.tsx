import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";
import { formatTournamentDate, formatTime } from "@/lib/format";
import { categoryLabelI18n, getLocale, pick, t } from "@/lib/i18n";
import { PublicHeader } from "@/components/public-header";
import { PublicFooter } from "@/components/public-footer";
import { ImageCarousel } from "@/app/tournaments/[id]/image-carousel";
import type { Tournament, TournamentCategory, TournamentImage, Player, PaymentStatus, TeamStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

type LoadedTeam = {
  id: string;
  status: TeamStatus;
  payment_status: PaymentStatus;
  registered_at: string;
  players: Player[];
  category: TournamentCategory;
  tournament: Tournament;
};

export default async function RegistrationDetailPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/me/registrations/${teamId}`);

  const locale = await getLocale();
  const d = t(locale);

  const admin = createAdminClient();
  const { data: team } = await admin
    .from("teams")
    .select(
      `id, status, payment_status, registered_at,
       players (*),
       category:tournament_categories!inner (*),
       tournament:tournaments!inner (*)`
    )
    .eq("id", teamId)
    .limit(1)
    .single();

  if (!team) notFound();
  const row = team as unknown as LoadedTeam;

  // Access control: the current user must be one of the players on this team
  const me = row.players.find((p) => p.user_id === user.id);
  if (!me) {
    // They might be the person by email but not yet linked; allow lookup by email too
    const byEmail = row.players.find(
      (p) => (p.email || "").toLowerCase() === (user.email || "").toLowerCase()
    );
    if (!byEmail) notFound();
  }

  const tour = row.tournament;
  const title = pick<string>(tour.title, tour.title_es ?? "", locale);
  const description = pick<string>(tour.description ?? "", tour.description_es ?? "", locale);
  const details = pick<string>(tour.details ?? "", tour.details_es ?? "", locale);
  const location = pick<string>(tour.location, tour.location_es ?? "", locale);
  const address = pick<string>(tour.address ?? "", tour.address_es ?? "", locale);
  const instructions = pick<string>(
    tour.payment_instructions ?? "",
    tour.payment_instructions_es ?? "",
    locale
  );
  const catLabel = categoryLabelI18n(row.category, locale);

  const images: TournamentImage[] = (tour.images && tour.images.length > 0)
    ? tour.images
    : tour.flyer_image_url
      ? [{ srcset: [{ w: 1200, url: tour.flyer_image_url }] }]
      : [];

  const players = [...row.players].sort(
    (a, b) => Number(b.is_captain) - Number(a.is_captain)
  );
  const myEmail = (user.email || "").toLowerCase();
  const partner = players.find((p) => p.email.toLowerCase() !== myEmail) ?? players[1];
  const myPlayer = players.find((p) => p.email.toLowerCase() === myEmail) ?? players[0];

  const isWaitlisted = row.status === "waitlisted";

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950">
      <PublicHeader active="me" />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-4 sm:px-6 sm:py-8">
        <Link href="/me" className="mb-3 inline-block text-xs text-zinc-400 hover:text-white sm:text-sm">
          ← {locale === "es" ? "Mi perfil" : "My profile"}
        </Link>

        <div className="mb-4 lg:hidden">
          {tour.workspace_id && tour.title && (
            <p className="mb-1.5 text-xs font-medium uppercase tracking-[0.15em] text-emerald-500">
              {isWaitlisted
                ? locale === "es" ? "En lista de espera" : "Waitlisted"
                : locale === "es" ? "Inscrito" : "Registered"}
            </p>
          )}
          <h1 className="text-2xl font-bold leading-tight tracking-tight text-white">
            {title}
          </h1>
        </div>

        <div className="lg:grid lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] lg:gap-10">
          <div className="mb-6 -mx-4 sm:-mx-6 lg:sticky lg:top-6 lg:mx-0 lg:mb-0 lg:self-start">
            <ImageCarousel images={images} alt={title} />
          </div>

          <div className="min-w-0">
            <div className="hidden lg:block">
              <p className="mb-2 text-xs font-medium uppercase tracking-[0.15em] text-emerald-500">
                {isWaitlisted
                  ? locale === "es" ? "En lista de espera" : "Waitlisted"
                  : locale === "es" ? "Inscrito" : "Registered"}
              </p>
              <h1 className="mb-2 text-4xl font-bold leading-tight tracking-tight text-white">
                {title}
              </h1>
            </div>
            {description && (
              <p className="mb-6 text-sm text-zinc-400 sm:text-base">{description}</p>
            )}

            {/* Your team */}
            <section className="mb-8 rounded-2xl border border-emerald-700/50 bg-emerald-950/20 p-5 sm:p-6">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-emerald-400">
                {locale === "es" ? "Tu equipo" : "Your team"}
              </h2>
              <div className="mb-4 flex items-center justify-between gap-2 text-xs">
                <span className="rounded-md border border-emerald-800 bg-emerald-950/40 px-2 py-0.5 font-medium uppercase tracking-wider text-emerald-300">
                  {catLabel}
                </span>
                <div className="flex gap-2">
                  <StatusBadge status={row.status} locale={locale} />
                  <PaymentBadge status={row.payment_status} locale={locale} />
                </div>
              </div>
              <ul className="space-y-2 text-sm">
                <PlayerRow player={myPlayer} isMe locale={locale} />
                {partner && <PlayerRow player={partner} isMe={false} locale={locale} />}
              </ul>
            </section>

            {/* Tournament info (same as public detail) */}
            <dl className="mb-8 grid gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-sm sm:grid-cols-2 sm:p-5">
              <div>
                <dt className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">{d.label_date}</dt>
                <dd className="mt-0.5 text-white">
                  {formatTournamentDate(tour.start_date, tour.end_date, tour.timezone)}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">{d.label_start_time}</dt>
                <dd className="mt-0.5 text-white">{formatTime(tour.start_time, tour.timezone)}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">{d.label_location}</dt>
                <dd className="mt-0.5 text-white">
                  {location}
                  {address && <div className="text-xs text-zinc-500">{address}</div>}
                  {tour.google_maps_url && (
                    <a
                      href={tour.google_maps_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-block text-xs text-emerald-500 hover:text-emerald-400"
                    >
                      {d.directions}
                    </a>
                  )}
                </dd>
              </div>
            </dl>

            {details && (
              <section className="mb-8">
                <h2 className="mb-2 text-lg font-semibold text-white sm:text-xl">{d.section_details}</h2>
                <div className="whitespace-pre-wrap rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-sm leading-relaxed text-zinc-300 sm:p-5">
                  {details}
                </div>
              </section>
            )}

            {(tour.payment_qr_url || instructions) && !isWaitlisted && (
              <section className="mb-8">
                <h2 className="mb-2 text-lg font-semibold text-white sm:text-xl">{d.payment_info}</h2>
                <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 sm:p-5">
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
                </div>
              </section>
            )}

            <section className="mb-6">
              <Link
                href={`/tournaments/${tour.slug}`}
                className="inline-block text-sm text-emerald-400 hover:text-emerald-300"
              >
                {locale === "es"
                  ? "Ver la página pública del torneo →"
                  : "View the public tournament page →"}
              </Link>
            </section>
          </div>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}

function PlayerRow({
  player,
  isMe,
  locale,
}: {
  player: Player;
  isMe: boolean;
  locale: "en" | "es";
}) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2">
      <div className="min-w-0">
        <p className="flex items-center gap-2">
          <span className="font-medium text-white">
            {player.first_name} {player.last_name}
          </span>
          {player.is_captain && (
            <span className="rounded border border-amber-700 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-amber-400">
              {locale === "es" ? "Capitán" : "Captain"}
            </span>
          )}
          {isMe && (
            <span className="rounded border border-emerald-700 bg-emerald-950/40 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-emerald-300">
              {locale === "es" ? "Tú" : "You"}
            </span>
          )}
        </p>
        <p className="truncate text-xs text-zinc-500">{player.email}</p>
      </div>
      <span className="text-xs text-zinc-400">{Number(player.rating).toFixed(1)}</span>
    </li>
  );
}

function StatusBadge({ status, locale }: { status: TeamStatus; locale: "en" | "es" }) {
  const labels: Record<TeamStatus, { en: string; es: string; cls: string }> = {
    registered: { en: "Registered", es: "Inscrito", cls: "border-emerald-800 text-emerald-300" },
    confirmed: { en: "Confirmed", es: "Confirmado", cls: "border-emerald-800 text-emerald-300" },
    waitlisted: { en: "Waitlisted", es: "Lista de espera", cls: "border-amber-800 text-amber-300" },
    cancelled: { en: "Cancelled", es: "Cancelado", cls: "border-red-900 text-red-300" },
  };
  const { [locale]: label, cls } = { ...labels[status], [locale]: labels[status][locale] };
  return (
    <span className={`rounded-md border px-2 py-0.5 font-medium uppercase tracking-wider ${cls}`}>
      {label}
    </span>
  );
}

function PaymentBadge({ status, locale }: { status: PaymentStatus; locale: "en" | "es" }) {
  const labels: Record<PaymentStatus, { en: string; es: string; cls: string }> = {
    unpaid: { en: "Unpaid", es: "Sin pagar", cls: "border-zinc-700 text-zinc-400" },
    paid: { en: "Paid", es: "Pagado", cls: "border-emerald-700 text-emerald-300" },
    refunded: { en: "Refunded", es: "Reembolsado", cls: "border-zinc-700 text-zinc-500" },
  };
  const { [locale]: label, cls } = { ...labels[status], [locale]: labels[status][locale] };
  return (
    <span className={`rounded-md border px-2 py-0.5 font-medium uppercase tracking-wider ${cls}`}>
      {label}
    </span>
  );
}
