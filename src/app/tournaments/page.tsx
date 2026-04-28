import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatTournamentDate, formatTime } from "@/lib/format";
import { categoryLabelI18n, formatSpotsOpen, getLocale, pick, t } from "@/lib/i18n";
import { PublicHeader } from "@/components/public-header";
import { PublicFooter } from "@/components/public-footer";
import { largestSrc, srcSetAttr, type CategoryType, type Team, type TournamentImage } from "@/lib/types";
import { tournamentCanonicalUrl } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Pickleball Tournaments in Puerto Rico",
  description:
    "Browse upcoming pickleball tournaments in Puerto Rico. Register your team, see categories, spots remaining, and event details.",
  alternates: { canonical: "/tournaments" },
  openGraph: {
    type: "website",
    title: "Pickleball Tournaments in Puerto Rico",
    description: "Browse and register for pickleball tournaments in Puerto Rico.",
    url: "/tournaments",
  },
};

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  slug: string;
  title: string;
  title_es: string | null;
  description: string | null;
  description_es: string | null;
  flyer_image_url: string | null;
  images: TournamentImage[] | null;
  start_date: string;
  end_date: string | null;
  start_time: string;
  timezone: string;
  location: string;
  location_es: string | null;
  registration_open: boolean;
  categories: {
    id: string;
    type: CategoryType;
    rating: string;
    label: string | null;
    label_es: string | null;
    team_limit: number;
  }[];
  teams: Pick<Team, "id" | "status" | "category_id">[];
};

export default async function TournamentsPage() {
  const locale = await getLocale();
  const d = t(locale);
  const admin = createAdminClient();
  const { data } = await admin
    .from("tournaments")
    .select(
      `id, slug, title, title_es, description, description_es, flyer_image_url, images,
       start_date, end_date, start_time, timezone,
       location, location_es, registration_open,
       categories:tournament_categories (id, type, rating, label, label_es, team_limit),
       teams (id, status, category_id)`
    )
    .eq("status", "published")
    .order("start_date", { ascending: true });

  const tournaments = (data ?? []) as Row[];

  const itemListJsonLd = tournaments.length > 0
    ? {
        "@context": "https://schema.org",
        "@type": "ItemList",
        itemListElement: tournaments.map((tt, i) => ({
          "@type": "ListItem",
          position: i + 1,
          url: tournamentCanonicalUrl(tt.slug),
          name: tt.title,
        })),
      }
    : null;

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950">
      {itemListJsonLd && (
        <Script
          id="tournaments-list-jsonld"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
        />
      )}
      <PublicHeader active="tournaments" />

      <main className="mx-auto w-full max-w-5xl flex-1 px-0 py-6 sm:px-6 sm:py-10">
        <div className="px-4 sm:px-0">
          <h1 className="mb-2 text-3xl font-bold tracking-tight text-white">
            {d.page_tournaments_title}
          </h1>
          <p className="mb-6 text-sm text-zinc-400 sm:mb-8">{d.page_tournaments_desc}</p>
        </div>

        {tournaments.length === 0 ? (
          <div className="mx-4 rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 p-10 text-center sm:mx-0">
            <p className="text-sm text-zinc-400">{d.no_tournaments}</p>
          </div>
        ) : (
          <div className="grid items-start gap-0 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tournaments.map((tt) => {
              const totalLimit = tt.categories.reduce((a, c) => a + c.team_limit, 0);
              const totalActive = tt.teams.filter((x) => x.status !== "cancelled").length;
              const spotsOpen = totalLimit - totalActive;
              const cover = (tt.images ?? [])[0];
              return (
                <Link
                  key={tt.id}
                  href={`/tournaments/${tt.slug}`}
                  className="group overflow-hidden border-b border-zinc-800 bg-zinc-900 transition-colors hover:border-emerald-600 sm:rounded-xl sm:border sm:border-zinc-800"
                >
                  <div className="bg-zinc-800">
                    {cover ? (
                      <picture>
                        <source
                          type="image/webp"
                          srcSet={srcSetAttr(cover)}
                          sizes="(min-width: 1024px) 320px, (min-width: 640px) 45vw, 100vw"
                        />
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={largestSrc(cover)}
                          srcSet={srcSetAttr(cover)}
                          sizes="(min-width: 1024px) 320px, (min-width: 640px) 45vw, 100vw"
                          alt={tt.title}
                          loading="lazy"
                          decoding="async"
                          className="block h-auto w-full"
                        />
                      </picture>
                    ) : tt.flyer_image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={tt.flyer_image_url}
                        alt={tt.title}
                        className="block h-auto w-full"
                      />
                    ) : (
                      <div className="flex aspect-[9/16] items-center justify-center text-xs uppercase tracking-widest text-zinc-600">
                        {d.no_flyer}
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="mb-1 text-base font-semibold text-white group-hover:text-emerald-400">
                      {pick(tt.title, tt.title_es, locale)}
                    </h3>
                    <p className="mb-3 text-xs text-zinc-500">
                      {formatTournamentDate(tt.start_date, tt.end_date, tt.timezone)} ·{" "}
                      {formatTime(tt.start_time, tt.timezone)}
                    </p>
                    <p className="mb-3 text-xs text-zinc-400">
                      {pick(tt.location, tt.location_es, locale)}
                    </p>
                    <div className="mb-3 flex flex-wrap gap-1.5">
                      {tt.categories.slice(0, 4).map((c) => (
                        <span
                          key={c.id}
                          className="rounded-md bg-zinc-800 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-zinc-300"
                        >
                          {categoryLabelI18n(c, locale)}
                        </span>
                      ))}
                    </div>
                    <p className="text-xs text-zinc-500">
                      {tt.registration_open ? (
                        spotsOpen > 0 ? (
                          <span className="text-emerald-500">{formatSpotsOpen(locale, spotsOpen)}</span>
                        ) : (
                          <span className="text-amber-500">{d.waitlist_only}</span>
                        )
                      ) : (
                        <span className="text-zinc-500">{d.registration_closed}</span>
                      )}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
      <PublicFooter />
    </div>
  );
}
