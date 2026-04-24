import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatTournamentDate, formatTime } from "@/lib/format";
import { categoryLabelI18n, getLocale, pick, t } from "@/lib/i18n";
import { PublicHeader } from "@/components/public-header";
import { ImageCarousel } from "./image-carousel";
import type { Tournament, TournamentCategory, Team, Player, Workspace } from "@/lib/types";
import { RegisterForm } from "./register-form";

export const dynamic = "force-dynamic";

type LoadedCategory = TournamentCategory;
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
       categories:tournament_categories (*),
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

  const payment = tour.workspace?.payment_info ?? {};
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

  return (
    <div className="min-h-screen bg-zinc-950">
      <PublicHeader />

      <main className="mx-auto max-w-3xl px-4 py-4 sm:px-6 sm:py-8">
        <Link href="/tournaments" className="mb-3 inline-block text-xs text-zinc-400 hover:text-white sm:text-sm">
          {d.back_to_list}
        </Link>

        {/* Mobile-first hero: carousel on top */}
        <div className="mb-6">
          <ImageCarousel images={images} alt={title} />
        </div>

        <h1 className="mb-2 text-2xl font-bold leading-tight tracking-tight text-white sm:text-4xl">
          {title}
        </h1>
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
            {categoriesView.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm sm:px-5">
                <span className="text-white">{c.display}</span>
                <span className={`whitespace-nowrap text-xs ${c.is_full ? "text-amber-500" : "text-zinc-400"}`}>
                  {d.teams_of(c.teams.length, c.team_limit)} {c.is_full && d.waitlist_suffix}
                </span>
              </li>
            ))}
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
                spots_remaining: c.spots_remaining,
              }))}
              payment={{
                venmo_qr_url: payment.venmo_qr_url,
                ath_qr_url: payment.ath_qr_url,
                venmo_handle: payment.venmo_handle,
                ath_handle: payment.ath_handle,
              }}
              dict={d}
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
      </main>
    </div>
  );
}
