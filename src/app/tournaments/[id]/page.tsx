import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatTournamentDate, formatTime } from "@/lib/format";
import {
  categoryLabelI18n,
  formatSpotsLeft,
  formatTeamsOf,
  getLocale,
  pick,
  t,
} from "@/lib/i18n";
import { PublicHeader } from "@/components/public-header";
import { PublicFooter } from "@/components/public-footer";
import { ImageCarousel } from "./image-carousel";
import type { Tournament, TournamentCategory, Team, Player, Workspace, TournamentImage, TournamentCourt, TournamentPool, Game } from "@/lib/types";
import { largestSrc, type TournamentFormat } from "@/lib/types";
import { FormatTimeline } from "@/components/format-timeline";
import { RegisterForm } from "./register-form";
import { buildSportsEventJsonLd, tournamentCanonicalUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

type TournamentSeoRow = {
  slug: string;
  title: string;
  title_es: string | null;
  description: string | null;
  description_es: string | null;
  details: string | null;
  details_es: string | null;
  start_date: string;
  end_date: string | null;
  start_time: string;
  timezone: string;
  location: string;
  location_es: string | null;
  address: string | null;
  address_es: string | null;
  status: Tournament["status"];
  registration_open: boolean;
  images: TournamentImage[] | null;
  flyer_image_url: string | null;
  workspace?: { name: string } | null;
};

async function loadForSeo(id: string): Promise<TournamentSeoRow | null> {
  const admin = createAdminClient();
  const isUuid = /^[0-9a-f-]{36}$/i.test(id);
  const query = admin
    .from("tournaments")
    .select(
      `slug, title, title_es, description, description_es, details, details_es,
       start_date, end_date, start_time, timezone,
       location, location_es, address, address_es,
       status, registration_open, images, flyer_image_url,
       workspace:workspaces (name)`
    )
    .eq("status", "published")
    .limit(1);
  const { data } = isUuid ? await query.eq("id", id) : await query.eq("slug", id);
  return (data?.[0] as TournamentSeoRow | undefined) ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const row = await loadForSeo(id);
  if (!row) return { title: "Tournament not found" };

  const title = row.title;
  const description =
    row.description?.trim() ||
    row.details?.slice(0, 240)?.trim() ||
    `Register for ${title} — pickleball in ${row.location}, Puerto Rico.`;

  const cover = (row.images ?? [])[0];
  const ogImage = cover ? largestSrc(cover) : row.flyer_image_url ?? "/icon-512.png";
  const canonical = tournamentCanonicalUrl(row.slug);

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: "website",
      title,
      description,
      url: canonical,
      siteName: "Buen Tiro",
      images: [{ url: ogImage, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}

type LoadedCategory = TournamentCategory & { format: TournamentFormat | null };
type LoadedTeam = Team & { players: Player[] };

export default async function TournamentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const locale = await getLocale();
  const d = t(locale);

  const admin = createAdminClient();
  const isUuid = /^[0-9a-f-]{36}$/i.test(id);

  // Pools and games are nested under categories because their FKs point
  // at tournament_categories, not at tournaments directly.
  const query = admin
    .from("tournaments")
    .select(
      `*,
       workspace:workspaces (id, name, payment_info),
       categories:tournament_categories (
         *,
         format:tournament_formats (*),
         pools:tournament_pools (*),
         games (*)
       ),
       courts:tournament_courts (*),
       teams (
         *,
         players (*)
       )`
    )
    .limit(1);

  const { data } = isUuid ? await query.eq("id", id) : await query.eq("slug", id);
  const tour = data?.[0] as
    | (Tournament & {
        workspace: Pick<Workspace, "id" | "name" | "payment_info">;
        categories: (LoadedCategory & {
          pools: TournamentPool[];
          games: Game[];
        })[];
        courts: TournamentCourt[];
        teams: LoadedTeam[];
      })
    | undefined;
  if (!tour || tour.status !== "published") notFound();
  const courtById = new Map(tour.courts.map((c) => [c.id, c]));

  const sortedCategories = [...tour.categories].sort(
    (a, b) => a.sort_order - b.sort_order || a.type.localeCompare(b.type)
  );

  const teamsByCategory = new Map<string, LoadedTeam[]>();
  for (const team of tour.teams) {
    const list = teamsByCategory.get(team.category_id) ?? [];
    list.push(team);
    teamsByCategory.set(team.category_id, list);
  }

  const categoriesView = sortedCategories.map((c) => {
    const teams = (teamsByCategory.get(c.id) ?? []).filter((x) => x.status !== "cancelled");
    const registeredTeams = teams.filter((t) => t.status !== "waitlisted");
    const waitlistedTeams = teams.filter((t) => t.status === "waitlisted");
    const spotsRemaining = Math.max(0, c.team_limit - registeredTeams.length);
    const rosterFull = registeredTeams.length >= c.team_limit;
    const waitlistFull =
      c.waitlist_limit != null && waitlistedTeams.length >= c.waitlist_limit;
    const completelyFull = rosterFull && waitlistFull;
    const poolsForCategory = (c.pools ?? [])
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order);
    const gamesForCategory = c.games ?? [];
    return {
      ...c,
      teams,
      registered_teams: registeredTeams,
      waitlisted_teams: waitlistedTeams,
      spots_remaining: spotsRemaining,
      is_full: rosterFull,
      waitlist_full: waitlistFull,
      completely_full: completelyFull,
      display: categoryLabelI18n(c, locale),
      pools: poolsForCategory,
      games: gamesForCategory,
    };
  });
  const anyPools = categoriesView.some((c) => c.pools.length > 0);

  const openCategories = categoriesView.filter((c) => !c.completely_full);
  const allCategoriesFull = categoriesView.length > 0 && openCategories.length === 0;

  const paymentInstructions = pick<string>(
    tour.payment_instructions ?? "",
    tour.payment_instructions_es ?? "",
    locale
  );
  const title: string = pick<string>(tour.title, tour.title_es ?? "", locale);
  const description = pick<string>(tour.description ?? "", tour.description_es ?? "", locale);
  const details = pick<string>(tour.details ?? "", tour.details_es ?? "", locale);
  const location: string = pick<string>(tour.location, tour.location_es ?? "", locale);
  const address = pick<string>(tour.address ?? "", tour.address_es ?? "", locale);

  const images = (tour.images && tour.images.length > 0)
    ? tour.images
    : tour.flyer_image_url
      ? [{ srcset: [{ w: 1200, url: tour.flyer_image_url }] }]
      : [];

  const sportsEventJsonLd = buildSportsEventJsonLd({
    tournament: tour,
    workspaceName: tour.workspace?.name ?? "Buen Tiro",
    coverImageUrls: images.map((img) => largestSrc(img)).filter(Boolean),
  });

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950">
      <Script
        id="tournament-jsonld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(sportsEventJsonLd) }}
      />
      <PublicHeader />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-4 sm:px-6 sm:py-8">
        <Link href="/tournaments" className="mb-3 inline-block text-xs text-zinc-400 hover:text-white sm:text-sm">
          {d.back_to_list}
        </Link>

        {/* Mobile-only title above the carousel. Desktop repeats the title in
            the right column (next to the sticky carousel). */}
        <div className="mb-4 lg:hidden">
          {tour.workspace?.name && (
            <p className="mb-1.5 text-xs font-medium uppercase tracking-[0.15em] text-emerald-500">
              {tour.workspace.name}
            </p>
          )}
          <h1 className="text-2xl font-bold leading-tight tracking-tight text-white">
            {title}
          </h1>
        </div>

        <div className="lg:grid lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] lg:gap-10">
          {/* Left: carousel. Full-bleed on mobile; sticky on desktop. */}
          <div className="mb-6 -mx-4 sm:-mx-6 lg:sticky lg:top-6 lg:mx-0 lg:mb-0 lg:self-start">
            <ImageCarousel images={images} alt={title} />
          </div>

          {/* Right: scrollable details + signup */}
          <div className="min-w-0">
        <div className="hidden lg:block">
          {tour.workspace?.name && (
            <p className="mb-2 text-xs font-medium uppercase tracking-[0.15em] text-emerald-500">
              {tour.workspace.name}
            </p>
          )}
          <h1 className="mb-2 text-4xl font-bold leading-tight tracking-tight text-white">
            {title}
          </h1>
        </div>
        {description && (
          <p className="mb-6 text-sm text-zinc-400 sm:text-base">{description}</p>
        )}

        {/* Compact info card — stacks on mobile */}
        <dl className="mb-8 grid gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-sm sm:grid-cols-2 sm:p-5">
          <div>
            <dt className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
              {d.label_date}
            </dt>
            <dd className="mt-0.5 text-white">
              {formatTournamentDate(tour.start_date, tour.end_date, tour.timezone)}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
              {d.label_start_time}
            </dt>
            <dd className="mt-0.5 text-white">{formatTime(tour.start_time, tour.timezone)}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
              {d.label_location}
            </dt>
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
          <div>
            <dt className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
              {d.label_registration}
            </dt>
            <dd className="mt-0.5">
              {tour.registration_open ? (
                <span className="text-emerald-500">{d.registration_open}</span>
              ) : (
                <span className="text-zinc-500">{d.registration_closed}</span>
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

        <section className="mb-8">
          <h2 className="mb-2 text-lg font-semibold text-white sm:text-xl">{d.section_categories}</h2>
          <ul className="divide-y divide-zinc-800 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
            {categoriesView.map((c) => {
              const fmt = c.format;
              const labelFull = locale === "es" ? "Llena" : "Full";
              const labelWaitlist = locale === "es" ? "lista de espera" : "waitlist";
              return (
                <li key={c.id} className="px-4 py-3 text-sm sm:px-5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-white">{c.display}</span>
                    <span
                      className={`whitespace-nowrap text-xs ${
                        c.completely_full
                          ? "text-zinc-500"
                          : c.is_full
                            ? "text-amber-500"
                            : "text-zinc-400"
                      }`}
                    >
                      {formatTeamsOf(locale, c.registered_teams.length, c.team_limit)}
                      {c.waitlist_limit != null ? (
                        <>
                          {" · "}
                          {c.waitlisted_teams.length} / {c.waitlist_limit} {labelWaitlist}
                        </>
                      ) : (
                        c.is_full && <> {d.waitlist_suffix}</>
                      )}
                      {c.completely_full && <> · {labelFull}</>}
                    </span>
                  </div>
                  {fmt && (
                    <div className="mt-3">
                      <FormatTimeline
                        format={fmt}
                        advancePerPool={c.advance_per_pool}
                        locale={locale}
                      />
                    </div>
                  )}
                </li>
              );
            })}
            {categoriesView.length === 0 && (
              <li className="px-5 py-6 text-center text-sm text-zinc-500">{d.no_categories}</li>
            )}
          </ul>
        </section>

        {anyPools && (
          <section className="mb-8">
            <h2 className="mb-3 text-lg font-semibold text-white sm:text-xl">
              {locale === "es" ? "Grupos y partidos" : "Pools & schedule"}
            </h2>
            <div className="space-y-6">
              {categoriesView
                .filter((c) => c.pools.length > 0)
                .map((c) => (
                  <CategoryPoolsPublic
                    key={c.id}
                    categoryDisplay={c.display}
                    pools={c.pools}
                    teams={c.teams}
                    games={c.games}
                    courtById={courtById}
                    locale={locale}
                  />
                ))}
            </div>
          </section>
        )}

        {tour.registration_open && allCategoriesFull && (
          <section className="mb-8 rounded-xl border border-amber-800 bg-amber-950/20 p-5 text-center sm:p-6">
            <p className="text-sm font-semibold uppercase tracking-wider text-amber-400">
              {locale === "es" ? "Llena" : "Full"}
            </p>
            <p className="mt-2 text-sm text-amber-100/80">
              {locale === "es"
                ? "Todas las categorías están llenas. La inscripción está cerrada."
                : "All categories are full. Registration is closed."}
            </p>
          </section>
        )}

        {tour.registration_open && openCategories.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-3 text-lg font-semibold text-white sm:text-xl">{d.section_register}</h2>
            <RegisterForm
              tournamentSlug={tour.slug}
              categories={openCategories.map((c) => ({
                id: c.id,
                label: c.display,
                is_full: c.is_full,
                spots_label: c.is_full ? d.form_waitlist_only : formatSpotsLeft(locale, c.spots_remaining),
              }))}
              payment={{
                qr_url: tour.payment_qr_url ?? undefined,
                instructions: paymentInstructions,
              }}
              labels={{
                form_category: d.form_category,
                form_player1: d.form_player1,
                form_player2: d.form_player2,
                form_first_name: d.form_first_name,
                form_last_name: d.form_last_name,
                form_email: d.form_email,
                form_phone: d.form_phone,
                form_phone_hint: d.form_phone_hint,
                form_rating: d.form_rating,
                form_rating_placeholder: d.form_rating_placeholder,
                form_submit_register: d.form_submit_register,
                form_submit_waitlist: d.form_submit_waitlist,
                form_submitting: d.form_submitting,
                payment_info: d.payment_info,
                success_registered_title: d.success_registered_title,
                success_registered_desc: d.success_registered_desc,
                success_waitlisted_title: d.success_waitlisted_title,
                success_waitlisted_desc: d.success_waitlisted_desc,
                register_another: d.register_another,
              }}
            />
          </section>
        )}

        <section className="mb-10">
          <h2 className="mb-4 text-lg font-semibold text-white sm:text-xl">{d.section_registered_teams}</h2>
          <div className="space-y-8">
            {categoriesView.map((c) => {
              const showWaitlist =
                c.waitlisted_teams.length > 0 || c.waitlist_limit != null;
              return (
                <div key={c.id}>
                  <h3 className="mb-3 text-base font-medium text-zinc-200">{c.display}</h3>
                  <TeamList
                    title={`${locale === "es" ? "Inscritos" : "Registered"} (${c.registered_teams.length} / ${c.team_limit})`}
                    teams={c.registered_teams}
                    tone="emerald"
                    empty={d.no_teams_yet}
                    locale={locale}
                  />
                  {showWaitlist && (
                    <div className="mt-4">
                      <TeamList
                        title={`${locale === "es" ? "Lista de espera" : "Waitlist"} (${c.waitlisted_teams.length}${c.waitlist_limit != null ? ` / ${c.waitlist_limit}` : ""})`}
                        teams={c.waitlisted_teams}
                        tone="amber"
                        empty=""
                        locale={locale}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
          </div>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}

function CategoryPoolsPublic({
  categoryDisplay,
  pools,
  teams,
  games,
  courtById,
  locale,
}: {
  categoryDisplay: string;
  pools: TournamentPool[];
  teams: LoadedTeam[];
  games: Game[];
  courtById: Map<string, TournamentCourt>;
  locale: "en" | "es";
}) {
  const teamById = new Map(teams.map((t) => [t.id, t]));

  function teamLabel(t: LoadedTeam | undefined): string {
    if (!t) return "—";
    const sorted = [...t.players].sort(
      (a, b) => Number(b.is_captain) - Number(a.is_captain)
    );
    return (
      sorted
        .map((p) => `${p.first_name} ${p.last_name.slice(0, 1)}.`)
        .join(" / ") || "Team"
    );
  }

  function courtBadge(c: TournamentCourt | undefined): string | null {
    if (!c) return null;
    return c.name ? `${locale === "es" ? "Cancha" : "Court"} ${c.number} — ${c.name}` : `${locale === "es" ? "Cancha" : "Court"} ${c.number}`;
  }

  const labels =
    locale === "es"
      ? {
          pool: "Grupo",
          teamCol: "Equipo",
          seedCol: "Seed",
          round: "R",
          vs: "vs",
          roundRobin: (n: number) => `Round-robin (${n} partidos)`,
        }
      : {
          pool: "Pool",
          teamCol: "Team",
          seedCol: "Seed",
          round: "R",
          vs: "vs",
          roundRobin: (n: number) => `Round-robin (${n} games)`,
        };

  return (
    <div>
      <h3 className="mb-3 text-base font-medium text-zinc-200">{categoryDisplay}</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        {pools.map((pool) => {
          const poolTeams = teams
            .filter((t) => t.pool_id === pool.id)
            .sort((a, b) => (a.pool_seed ?? 0) - (b.pool_seed ?? 0));
          const poolGames = games
            .filter((g) => g.pool_id === pool.id)
            .sort((a, b) => a.round - b.round || a.sort_order - b.sort_order);
          const courtIds = Array.from(
            new Set(poolGames.map((g) => g.court_id).filter((v): v is string => !!v))
          );
          const courtLabel = courtIds.length === 1 ? courtBadge(courtById.get(courtIds[0])) : null;
          return (
            <div
              key={pool.id}
              className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900"
            >
              <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/60 px-4 py-2">
                <p className="text-sm font-semibold text-white">
                  {labels.pool} {pool.letter}
                </p>
                {courtLabel && <p className="text-xs text-emerald-400">{courtLabel}</p>}
              </div>
              <ul className="divide-y divide-zinc-800 text-xs">
                {poolTeams.map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center justify-between gap-2 px-4 py-2"
                  >
                    <span className="text-zinc-200">
                      <span className="mr-2 text-zinc-500">#{t.pool_seed}</span>
                      {teamLabel(t)}
                    </span>
                    <span className="text-zinc-500">
                      {labels.seedCol} {t.seed}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="border-t border-zinc-800 bg-zinc-950/40 px-4 py-3">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  {labels.roundRobin(poolGames.length)}
                </p>
                <ul className="space-y-1.5 text-xs">
                  {poolGames.map((g) => {
                    const a = teamById.get(g.team_a_id ?? "");
                    const b = teamById.get(g.team_b_id ?? "");
                    return (
                      <li key={g.id} className="flex items-center justify-between gap-2">
                        <span className="text-zinc-500">
                          {labels.round}
                          {g.round}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-zinc-200">
                          {teamLabel(a)} <span className="text-zinc-500">{labels.vs}</span>{" "}
                          {teamLabel(b)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

type TeamRow = LoadedTeam;

function TeamList({
  title,
  teams,
  tone,
  empty,
  locale,
}: {
  title: string;
  teams: TeamRow[];
  tone: "emerald" | "amber";
  empty: string;
  locale: "en" | "es";
}) {
  const titleColor = tone === "amber" ? "text-amber-400" : "text-zinc-400";
  // Empty + amber means an empty waitlist when one is configured — show
  // a friendly "no one yet" line instead of skipping. Empty + emerald
  // (no registrations) uses the shared d.no_teams_yet message via empty.
  if (teams.length === 0 && !empty) {
    return (
      <section>
        <h4 className={`mb-2 text-xs font-semibold uppercase tracking-wider ${titleColor}`}>
          {title}
        </h4>
        <p className="rounded-lg border border-dashed border-zinc-800 px-4 py-3 text-xs text-zinc-500">
          {locale === "es" ? "Aún no hay nadie en lista de espera." : "No one on the waitlist yet."}
        </p>
      </section>
    );
  }
  return (
    <section>
      <h4 className={`mb-2 text-xs font-semibold uppercase tracking-wider ${titleColor}`}>
        {title}
      </h4>
      {teams.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-800 px-4 py-3 text-xs text-zinc-500">
          {empty}
        </p>
      ) : (
        <ul className="divide-y divide-zinc-800 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900">
          {teams.map((team, idx) => {
            const pls = [...team.players].sort(
              (a, b) => Number(b.is_captain) - Number(a.is_captain)
            );
            return (
              <li
                key={team.id}
                className="flex items-center justify-between gap-2 px-4 py-3 text-sm"
              >
                <div className="min-w-0 truncate">
                  <span className="mr-2 text-xs text-zinc-500">#{idx + 1}</span>
                  {pls
                    .map(
                      (p) => `${p.first_name} ${p.last_name} (${Number(p.rating).toFixed(1)})`
                    )
                    .join(" / ") || "Team"}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

