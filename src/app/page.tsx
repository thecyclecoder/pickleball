import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatTournamentDate } from "@/lib/format";
import { getLocale, pick, t } from "@/lib/i18n";
import { PublicHeader } from "@/components/public-header";
import { PublicFooter } from "@/components/public-footer";
import { CoverSlideshow } from "@/components/cover-slideshow";
import type { TournamentImage } from "@/lib/types";

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

  const [{ data: tournaments }, { data: clinics }] = await Promise.all([
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
  ]);

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
          tournament: "Torneo",
          clinic: "Clínica",
        }
      : {
          eventsHeading: "Upcoming events",
          eventsAll: "All tournaments →",
          eventsClinics: "All clinics →",
          tournament: "Tournament",
          clinic: "Clinic",
        };

  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />

      <section className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-6 py-24 text-center">
        <p className="mb-3 text-xs font-medium uppercase tracking-[0.2em] text-emerald-500">
          {d.hero_kicker}
        </p>
        <h1 className="mb-4 text-5xl font-bold tracking-tight text-white sm:text-6xl">
          {d.hero_title}
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
              {events.map((e, idx) => (
                <Link
                  key={e.key}
                  href={e.href}
                  className="group overflow-hidden border-b border-zinc-800 bg-zinc-900 transition-colors hover:border-emerald-600 sm:rounded-xl sm:border sm:border-zinc-800"
                >
                  <div className="bg-zinc-800">
                    {e.images.length > 0 ? (
                      <CoverSlideshow
                        images={e.images}
                        alt={e.title}
                        sizes="(min-width: 1024px) 320px, (min-width: 640px) 45vw, 100vw"
                        stagger={idx * 600}
                      />
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
              ))}
            </div>
          </div>
        </section>
      )}

      <PublicFooter />
    </div>
  );
}
