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
import type { Tournament, TournamentCategory, Team, Player, Workspace, TournamentImage } from "@/lib/types";
import { largestSrc, stageRulesText, type TournamentFormat } from "@/lib/types";
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

  const query = admin
    .from("tournaments")
    .select(
      `*,
       workspace:workspaces (id, name, payment_info),
       categories:tournament_categories (*, format:tournament_formats (*)),
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
        categories: LoadedCategory[];
        teams: LoadedTeam[];
      })
    | undefined;
  if (!tour || tour.status !== "published") notFound();

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
    return {
      ...c,
      teams,
      spots_remaining: Math.max(0, c.team_limit - teams.length),
      is_full: teams.length >= c.team_limit,
      display: categoryLabelI18n(c, locale),
    };
  });

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
              return (
                <li key={c.id} className="px-4 py-3 text-sm sm:px-5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-white">{c.display}</span>
                    <span className={`whitespace-nowrap text-xs ${c.is_full ? "text-amber-500" : "text-zinc-400"}`}>
                      {formatTeamsOf(locale, c.teams.length, c.team_limit)} {c.is_full && d.waitlist_suffix}
                    </span>
                  </div>
                  {fmt && (
                    <dl className="mt-2 grid gap-1.5 text-[11px] sm:grid-cols-4">
                      <FormatStage
                        label="Pool"
                        text={stageRulesText(fmt.pool_play_games_to, fmt.pool_play_win_by, fmt.pool_play_best_of)}
                        enabled
                      />
                      <FormatStage
                        label="QF"
                        text={stageRulesText(fmt.quarterfinals_games_to, fmt.quarterfinals_win_by, fmt.quarterfinals_best_of)}
                        enabled={fmt.has_quarterfinals}
                      />
                      <FormatStage
                        label="SF"
                        text={stageRulesText(fmt.semifinals_games_to, fmt.semifinals_win_by, fmt.semifinals_best_of)}
                        enabled={fmt.has_semifinals}
                      />
                      <FormatStage
                        label="F"
                        text={stageRulesText(fmt.finals_games_to, fmt.finals_win_by, fmt.finals_best_of)}
                        enabled={fmt.has_finals}
                      />
                    </dl>
                  )}
                </li>
              );
            })}
            {categoriesView.length === 0 && (
              <li className="px-5 py-6 text-center text-sm text-zinc-500">{d.no_categories}</li>
            )}
          </ul>
        </section>

        {tour.registration_open && categoriesView.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-3 text-lg font-semibold text-white sm:text-xl">{d.section_register}</h2>
            <RegisterForm
              tournamentSlug={tour.slug}
              categories={categoriesView.map((c) => ({
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
          <h2 className="mb-3 text-lg font-semibold text-white sm:text-xl">{d.section_registered_teams}</h2>
          <div className="space-y-5">
            {categoriesView.map((c) => (
              <div key={c.id}>
                <h3 className="mb-2 flex items-baseline justify-between text-sm font-medium text-zinc-200">
                  <span>{c.display}</span>
                  <span className="text-xs text-zinc-500">{c.teams.length} / {c.team_limit}</span>
                </h3>
                {c.teams.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-zinc-800 px-4 py-3 text-xs text-zinc-500">
                    {d.no_teams_yet}
                  </p>
                ) : (
                  <ul className="divide-y divide-zinc-800 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900">
                    {c.teams.map((team, idx) => {
                      const pls = [...team.players].sort(
                        (a, b) => Number(b.is_captain) - Number(a.is_captain)
                      );
                      return (
                        <li key={team.id} className="flex items-center justify-between gap-2 px-4 py-3 text-sm">
                          <div className="min-w-0 truncate">
                            <span className="mr-2 text-xs text-zinc-500">#{idx + 1}</span>
                            {pls.map((p) => `${p.first_name} ${p.last_name}`).join(" / ") || "Team"}
                          </div>
                          <span
                            className={`text-xs ${
                              team.status === "waitlisted" ? "text-amber-500" : "text-zinc-500"
                            }`}
                          >
                            {team.status === "waitlisted" ? d.waitlist_only : ""}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </section>
          </div>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}

function FormatStage({ label, text, enabled }: { label: string; text: string; enabled: boolean }) {
  return (
    <div className={enabled ? "" : "opacity-30"}>
      <dt className="text-[9px] uppercase tracking-wider text-zinc-500">{label}</dt>
      <dd className="mt-0.5 text-zinc-300">{enabled ? text : "—"}</dd>
    </div>
  );
}
