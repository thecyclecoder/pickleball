import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatTournamentDate } from "@/lib/format";
import { getLocale, pick, t } from "@/lib/i18n";
import { PublicHeader } from "@/components/public-header";
import { PublicFooter } from "@/components/public-footer";
import { RotatingWord } from "@/components/rotating-word";
import {
  largestSrc,
  lessonTypeLabel,
  srcSetAttr,
  type LessonType,
  type TournamentImage,
} from "@/lib/types";

type CoachCard = {
  id: string;
  slug: string;
  display_name: string;
  display_name_es: string | null;
  tagline: string | null;
  tagline_es: string | null;
  avatar_url: string | null;
  lesson_types: LessonType[];
};

export const dynamic = "force-dynamic";

type EventCard = {
  key: string;
  kind: "tournament" | "clinic";
  href: string;
  title: string;
  start_date: string;
  end_date: string | null;
  timezone: string;
  location: string;
  images: TournamentImage[];
  flyer_image_url: string | null;
};

export default async function Home() {
  const locale = await getLocale();
  const d = t(locale);

  const admin = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);

  const [{ data: tournaments }, { data: clinics }, { data: coaches }] = await Promise.all([
    admin
      .from("tournaments")
      .select(
        "id, slug, title, title_es, start_date, end_date, timezone, location, location_es, flyer_image_url, images"
      )
      .eq("status", "published")
      .gte("start_date", today)
      .order("start_date", { ascending: true })
      .limit(6),
    admin
      .from("clinics")
      .select(
        "id, slug, title, title_es, start_date, end_date, timezone, location, location_es, flyer_image_url, images"
      )
      .eq("status", "published")
      .gte("start_date", today)
      .order("start_date", { ascending: true })
      .limit(6),
    admin
      .from("coach_profiles")
      .select(
        "id, slug, display_name, display_name_es, tagline, tagline_es, avatar_url, lesson_types"
      )
      .eq("status", "published")
      .eq("accepting_requests", true)
      .order("updated_at", { ascending: false })
      .limit(6),
  ]);
  const coachCards = (coaches ?? []) as CoachCard[];

  const events: EventCard[] = [
    ...(tournaments ?? []).map((tt) => ({
      key: `t:${tt.id}`,
      kind: "tournament" as const,
      href: `/tournaments/${tt.slug}`,
      title: pick<string>(tt.title, tt.title_es ?? "", locale),
      start_date: tt.start_date,
      end_date: tt.end_date,
      timezone: tt.timezone,
      location: pick<string>(tt.location, tt.location_es ?? "", locale),
      images: (tt.images as TournamentImage[] | null) ?? [],
      flyer_image_url: tt.flyer_image_url,
    })),
    ...(clinics ?? []).map((c) => ({
      key: `c:${c.id}`,
      kind: "clinic" as const,
      href: `/clinics/${c.slug}`,
      title: pick<string>(c.title, c.title_es ?? "", locale),
      start_date: c.start_date,
      end_date: c.end_date,
      timezone: c.timezone,
      location: pick<string>(c.location, c.location_es ?? "", locale),
      images: (c.images as TournamentImage[] | null) ?? [],
      flyer_image_url: c.flyer_image_url,
    })),
  ]
    .sort((a, b) => a.start_date.localeCompare(b.start_date))
    .slice(0, 6);

  const L =
    locale === "es"
      ? {
          eventsHeading: "Próximos eventos",
          eventsAll: "Ver torneos →",
          eventsClinics: "Ver clínicas →",
          coachesHeading: "Coaches",
          coachesAll: "Ver coaches →",
          tournament: "Torneo",
          clinic: "Clínica",
          coach: "Coach",
          findYourNext: "Encuentra tu próximo",
          findCoaches: "Encuentra un coach",
          rotatingWords: ["torneo", "partido", "lección", "evento"],
          viewCoaches: "Ver coaches",
        }
      : {
          eventsHeading: "Upcoming events",
          eventsAll: "All tournaments →",
          eventsClinics: "All clinics →",
          coachesHeading: "Coaches",
          coachesAll: "All coaches →",
          tournament: "Tournament",
          clinic: "Clinic",
          coach: "Coach",
          findYourNext: "Find your next",
          findCoaches: "Find a coach",
          rotatingWords: ["tournament", "clinic", "lesson", "match"],
          viewCoaches: "View coaches",
        };

  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />

      <section className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-6 py-24 text-center">
        <p className="mb-3 text-xs font-medium uppercase tracking-[0.2em] text-emerald-500">
          {d.hero_kicker}
        </p>
        <h1 className="mb-4 text-4xl font-bold leading-tight tracking-tight text-white sm:text-6xl">
          <span className="block">{L.findYourNext}</span>
          <RotatingWord words={L.rotatingWords} />
          <span>.</span>
        </h1>
        <p className="mb-10 max-w-lg text-base text-zinc-400">{d.hero_desc}</p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            href="/tournaments"
            className="rounded-lg bg-emerald-600 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-emerald-500"
          >
            {d.hero_cta}
          </Link>
          <Link
            href="/clinics"
            className="rounded-lg border border-zinc-800 bg-zinc-900 px-6 py-3 text-sm font-medium text-zinc-200 transition-colors hover:border-zinc-700 hover:text-white"
          >
            {locale === "es" ? "Ver clínicas" : "View clinics"}
          </Link>
          <Link
            href="/coaches"
            className="rounded-lg border border-zinc-800 bg-zinc-900 px-6 py-3 text-sm font-medium text-zinc-200 transition-colors hover:border-zinc-700 hover:text-white"
          >
            {L.viewCoaches}
          </Link>
        </div>
      </section>

      {events.length > 0 && (
        <section className="border-t border-zinc-900 bg-zinc-950">
          <div className="mx-auto max-w-5xl px-0 py-12 sm:px-6 sm:py-16">
            <div className="mb-6 flex items-baseline justify-between gap-3 px-4 sm:px-0">
              <h2 className="text-xl font-semibold text-white">{L.eventsHeading}</h2>
              <div className="flex items-baseline gap-3 text-sm">
                <Link href="/tournaments" className="text-emerald-500 hover:text-emerald-400">
                  {L.eventsAll}
                </Link>
                <Link href="/clinics" className="text-emerald-500 hover:text-emerald-400">
                  {L.eventsClinics}
                </Link>
              </div>
            </div>
            <div className="grid items-start gap-0 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {events.map((e) => {
                const cover = e.images[0];
                return (
                <Link
                  key={e.key}
                  href={e.href}
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
                          alt={e.title}
                          loading="lazy"
                          decoding="async"
                          className="block h-auto w-full"
                        />
                      </picture>
                    ) : e.flyer_image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={e.flyer_image_url} alt={e.title} className="block h-auto w-full" />
                    ) : null}
                  </div>
                  <div className="p-4">
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-500">
                      {e.kind === "tournament" ? L.tournament : L.clinic}
                    </p>
                    <h3 className="mb-1 text-sm font-medium text-white group-hover:text-emerald-400">
                      {e.title}
                    </h3>
                    <p className="text-xs text-zinc-500">
                      {formatTournamentDate(e.start_date, e.end_date, e.timezone)} · {e.location}
                    </p>
                  </div>
                </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {coachCards.length > 0 && (
        <section className="border-t border-zinc-900 bg-zinc-950">
          <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
            <div className="mb-6 flex items-baseline justify-between gap-3">
              <h2 className="text-xl font-semibold text-white">{L.coachesHeading}</h2>
              <Link href="/coaches" className="text-sm text-emerald-500 hover:text-emerald-400">
                {L.coachesAll}
              </Link>
            </div>
            <div className="grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {coachCards.map((c) => {
                const name = pick<string>(c.display_name, c.display_name_es ?? "", locale);
                const tagline = pick<string>(c.tagline ?? "", c.tagline_es ?? "", locale);
                return (
                  <Link
                    key={c.id}
                    href={`/coaches/${c.slug}`}
                    className="group flex items-center gap-3 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 p-4 transition-colors hover:border-emerald-600"
                  >
                    {c.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={c.avatar_url}
                        alt={name}
                        className="h-14 w-14 flex-shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-zinc-800 text-sm font-semibold text-zinc-400">
                        {name
                          .split(" ")
                          .map((p) => p[0])
                          .filter(Boolean)
                          .slice(0, 2)
                          .join("")
                          .toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-500">
                        {L.coach}
                      </p>
                      <h3 className="truncate text-sm font-medium text-white group-hover:text-emerald-400">
                        {name}
                      </h3>
                      {tagline ? (
                        <p className="truncate text-xs text-zinc-500">{tagline}</p>
                      ) : c.lesson_types?.length ? (
                        <p className="truncate text-xs text-zinc-500">
                          {c.lesson_types.map((lt) => lessonTypeLabel(lt, locale)).join(" · ")}
                        </p>
                      ) : null}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      <PublicFooter />
    </div>
  );
}
