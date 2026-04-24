import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatTournamentDate } from "@/lib/format";
import { getLocale, pick, t } from "@/lib/i18n";
import { PublicHeader } from "@/components/public-header";
import { ResponsiveImage } from "@/components/responsive-image";
import type { TournamentImage } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Home() {
  const locale = await getLocale();
  const d = t(locale);

  const admin = createAdminClient();
  const { data: tournaments } = await admin
    .from("tournaments")
    .select(
      "id, slug, title, title_es, start_date, end_date, timezone, location, location_es, flyer_image_url, images"
    )
    .eq("status", "published")
    .gte("start_date", new Date().toISOString().slice(0, 10))
    .order("start_date", { ascending: true })
    .limit(3);

  const upcoming = tournaments ?? [];

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
        <Link
          href="/tournaments"
          className="rounded-lg bg-emerald-600 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-emerald-500"
        >
          {d.hero_cta}
        </Link>
      </section>

      {upcoming.length > 0 && (
        <section className="border-t border-zinc-900 bg-zinc-950">
          <div className="mx-auto max-w-5xl px-6 py-16">
            <div className="mb-6 flex items-baseline justify-between">
              <h2 className="text-xl font-semibold text-white">{d.upcoming}</h2>
              <Link href="/tournaments" className="text-sm text-emerald-500 hover:text-emerald-400">
                {d.see_all}
              </Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {upcoming.map((tt) => {
                const cover = ((tt.images as TournamentImage[] | null) ?? [])[0];
                return (
                <Link
                  key={tt.id}
                  href={`/tournaments/${tt.slug}`}
                  className="group overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 transition-colors hover:border-emerald-600"
                >
                  <div className="aspect-[9/16] bg-zinc-800">
                    {cover ? (
                      <ResponsiveImage
                        image={cover}
                        alt={tt.title}
                        sizes="(min-width: 1024px) 320px, (min-width: 640px) 45vw, 100vw"
                        className="h-full w-full object-cover"
                      />
                    ) : tt.flyer_image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={tt.flyer_image_url}
                        alt={tt.title}
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="p-4">
                    <h3 className="mb-1 text-sm font-medium text-white group-hover:text-emerald-400">
                      {pick(tt.title, tt.title_es, locale)}
                    </h3>
                    <p className="text-xs text-zinc-500">
                      {formatTournamentDate(tt.start_date, tt.end_date, tt.timezone)} ·{" "}
                      {pick(tt.location, tt.location_es, locale)}
                    </p>
                  </div>
                </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      <footer className="border-t border-zinc-900">
        <div className="mx-auto max-w-5xl px-6 py-6 text-xs text-zinc-600">
          © {new Date().getFullYear()} {d.footer}
        </div>
      </footer>
    </div>
  );
}
