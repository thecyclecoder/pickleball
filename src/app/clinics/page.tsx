import type { Metadata } from "next";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatTournamentDate, formatTime } from "@/lib/format";
import { getLocale, pick, t } from "@/lib/i18n";
import { PublicHeader } from "@/components/public-header";
import { PublicFooter } from "@/components/public-footer";
import { CoverSlideshow } from "@/components/cover-slideshow";
import type { TournamentImage } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pickleball Clinics in Puerto Rico",
  description:
    "Browse upcoming pickleball clinics in Puerto Rico — drills, skill camps, and pro coaching at every level.",
  alternates: { canonical: "/clinics" },
  openGraph: {
    type: "website",
    title: "Pickleball Clinics in Puerto Rico",
    description: "Drills, skill camps, and pro coaching across Puerto Rico.",
    url: "/clinics",
  },
};

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
  capacity: number | null;
  registration_open: boolean;
  coaches: { id: string; name: string }[];
  registrations: { id: string; status: string }[];
};

export default async function ClinicsListPage() {
  const locale = await getLocale();
  const d = t(locale);
  const admin = createAdminClient();
  const { data } = await admin
    .from("clinics")
    .select(
      `id, slug, title, title_es, description, description_es, flyer_image_url, images,
       start_date, end_date, start_time, timezone, location, location_es, capacity,
       registration_open,
       coaches:clinic_coaches (id, name),
       registrations:clinic_registrations (id, status)`
    )
    .eq("status", "published")
    .order("start_date", { ascending: true });
  const clinics = (data ?? []) as Row[];

  const L =
    locale === "es"
      ? {
          heading: "Clínicas",
          subheading: "Próximas clínicas de pickleball en Puerto Rico.",
          empty: "Aún no hay clínicas publicadas. Vuelve pronto.",
          spotsLeft: (n: number) => `${n} espacio${n === 1 ? "" : "s"} disponible${n === 1 ? "" : "s"}`,
          waitlistOnly: "Solo lista de espera",
          unlimited: "Espacios ilimitados",
          coaches: (n: number) => `${n} coach${n === 1 ? "" : "es"}`,
        }
      : {
          heading: "Clinics",
          subheading: "Upcoming pickleball clinics in Puerto Rico.",
          empty: "No clinics listed yet. Check back soon.",
          spotsLeft: (n: number) => `${n} spot${n === 1 ? "" : "s"} open`,
          waitlistOnly: "Waitlist only",
          unlimited: "Open enrollment",
          coaches: (n: number) => `${n} coach${n === 1 ? "" : "es"}`,
        };

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950">
      <PublicHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-0 py-6 sm:px-6 sm:py-10">
        <div className="px-4 sm:px-0">
          <h1 className="mb-2 text-3xl font-bold tracking-tight text-white">{L.heading}</h1>
          <p className="mb-6 text-sm text-zinc-400 sm:mb-8">{L.subheading}</p>
        </div>

        {clinics.length === 0 ? (
          <div className="mx-4 rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 p-10 text-center sm:mx-0">
            <p className="text-sm text-zinc-400">{L.empty}</p>
          </div>
        ) : (
          <div className="grid items-start gap-0 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {clinics.map((c, idx) => {
              const active = c.registrations.filter((r) => r.status !== "cancelled").length;
              const spotsOpen = c.capacity != null ? c.capacity - active : null;
              const imgs = c.images ?? [];
              const title = pick<string>(c.title, c.title_es ?? "", locale);
              const location = pick<string>(c.location, c.location_es ?? "", locale);
              return (
                <Link
                  key={c.id}
                  href={`/clinics/${c.slug}`}
                  className="group overflow-hidden border-b border-zinc-800 bg-zinc-900 transition-colors hover:border-emerald-600 sm:rounded-xl sm:border sm:border-zinc-800"
                >
                  <div className="bg-zinc-800">
                    {imgs.length > 0 ? (
                      <CoverSlideshow
                        images={imgs}
                        alt={c.title}
                        sizes="(min-width: 1024px) 320px, (min-width: 640px) 45vw, 100vw"
                        stagger={idx * 600}
                      />
                    ) : c.flyer_image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.flyer_image_url} alt={c.title} className="block h-auto w-full" />
                    ) : (
                      <div className="flex aspect-[9/16] items-center justify-center text-xs uppercase tracking-widest text-zinc-600">
                        {d.no_flyer}
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-500">
                      {locale === "es" ? "Clínica" : "Clinic"}
                    </p>
                    <h3 className="mb-1 text-base font-semibold text-white group-hover:text-emerald-400">
                      {title}
                    </h3>
                    <p className="mb-3 text-xs text-zinc-500">
                      {formatTournamentDate(c.start_date, c.end_date, c.timezone)} ·{" "}
                      {formatTime(c.start_time, c.timezone)}
                    </p>
                    <p className="mb-3 text-xs text-zinc-400">{location}</p>
                    <p className="text-xs text-zinc-500">
                      {c.coaches.length > 0 && <span className="mr-2">{L.coaches(c.coaches.length)}</span>}
                      {c.registration_open ? (
                        spotsOpen == null ? (
                          <span className="text-emerald-500">{L.unlimited}</span>
                        ) : spotsOpen > 0 ? (
                          <span className="text-emerald-500">{L.spotsLeft(spotsOpen)}</span>
                        ) : (
                          <span className="text-amber-500">{L.waitlistOnly}</span>
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
