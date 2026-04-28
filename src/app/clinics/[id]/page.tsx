import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatTournamentDate, formatTime } from "@/lib/format";
import { getLocale, pick, t } from "@/lib/i18n";
import { PublicHeader } from "@/components/public-header";
import { PublicFooter } from "@/components/public-footer";
import { ImageCarousel } from "@/app/tournaments/[id]/image-carousel";
import { ClinicRegisterForm } from "./clinic-register-form";
import {
  largestSrc,
  type Clinic,
  type ClinicCoach,
  type ClinicRegistration,
  type Workspace,
} from "@/lib/types";

export const dynamic = "force-dynamic";

type LoadedClinic = Clinic & {
  workspace: Pick<Workspace, "id" | "name"> | null;
  coaches: ClinicCoach[];
  registrations: Pick<ClinicRegistration, "id" | "first_name" | "last_name" | "rating_self" | "age" | "status">[];
};

async function loadClinic(id: string): Promise<LoadedClinic | null> {
  const admin = createAdminClient();
  const isUuid = /^[0-9a-f-]{36}$/i.test(id);
  const query = admin
    .from("clinics")
    .select(
      `*,
       workspace:workspaces (id, name),
       coaches:clinic_coaches (*),
       registrations:clinic_registrations (id, first_name, last_name, rating_self, age, status)`
    )
    .eq("status", "published")
    .limit(1);
  const { data } = isUuid ? await query.eq("id", id) : await query.eq("slug", id);
  return (data?.[0] as LoadedClinic | undefined) ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const c = await loadClinic(id);
  if (!c) return { title: "Clinic not found" };
  const description =
    c.description?.trim() ||
    c.details?.slice(0, 240)?.trim() ||
    `Sign up for ${c.title} — pickleball clinic in ${c.location}, Puerto Rico.`;
  const cover = (c.images ?? [])[0];
  const ogImage = cover ? largestSrc(cover) : c.flyer_image_url ?? "/icon-512.png";
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://buentiro.app";
  const canonical = `${siteUrl}/clinics/${c.slug}`;
  return {
    title: c.title,
    description,
    alternates: { canonical },
    openGraph: {
      type: "website",
      title: c.title,
      description,
      url: canonical,
      siteName: "Buen Tiro",
      images: [{ url: ogImage, alt: c.title }],
    },
    twitter: {
      card: "summary_large_image",
      title: c.title,
      description,
      images: [ogImage],
    },
  };
}

export default async function ClinicDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const c = await loadClinic(id);
  if (!c) notFound();

  const locale = await getLocale();
  const d = t(locale);

  const title = pick<string>(c.title, c.title_es ?? "", locale);
  const description = pick<string>(c.description ?? "", c.description_es ?? "", locale);
  const details = pick<string>(c.details ?? "", c.details_es ?? "", locale);
  const location = pick<string>(c.location, c.location_es ?? "", locale);
  const address = pick<string>(c.address ?? "", c.address_es ?? "", locale);

  const images = (c.images && c.images.length > 0)
    ? c.images
    : c.flyer_image_url
      ? [{ srcset: [{ w: 1200, url: c.flyer_image_url }] }]
      : [];
  const coaches = [...c.coaches].sort((a, b) => a.sort_order - b.sort_order);
  const active = c.registrations.filter((r) => r.status !== "cancelled");
  const spotsOpen = c.capacity != null ? c.capacity - active.length : null;
  const isFull = spotsOpen != null && spotsOpen <= 0;

  const L =
    locale === "es"
      ? {
          kicker: "Clínica",
          coaches: "Entrenadores",
          register: "Inscríbete",
          participants: "Participantes inscritos",
          noParticipants: "Aún no hay inscritos.",
          spotsLeft: (n: number) => `${n} espacio${n === 1 ? "" : "s"} disponible${n === 1 ? "" : "s"}`,
          waitlistOnly: "Solo lista de espera",
          unlimited: "Espacios ilimitados",
        }
      : {
          kicker: "Clinic",
          coaches: "Coaches",
          register: "Sign up",
          participants: "Registered participants",
          noParticipants: "No one has signed up yet.",
          spotsLeft: (n: number) => `${n} spot${n === 1 ? "" : "s"} open`,
          waitlistOnly: "Waitlist only",
          unlimited: "Open enrollment",
        };

  const eventJsonLd = {
    "@context": "https://schema.org",
    "@type": "EducationalEvent",
    name: c.title,
    description,
    startDate: `${c.start_date}T${c.start_time}`,
    endDate: c.end_date ? `${c.end_date}T23:59` : `${c.start_date}T23:59`,
    location: {
      "@type": "Place",
      name: c.location,
      address: c.address
        ? { "@type": "PostalAddress", streetAddress: c.address, addressRegion: "PR", addressCountry: "PR" }
        : { "@type": "PostalAddress", addressRegion: "PR", addressCountry: "PR" },
    },
    image: images.map((img) => largestSrc(img)).filter(Boolean),
    organizer: { "@type": "Organization", name: c.workspace?.name ?? "Buen Tiro" },
  };

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950">
      <Script
        id="clinic-jsonld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(eventJsonLd) }}
      />
      <PublicHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-4 sm:px-6 sm:py-8">
        <Link href="/clinics" className="mb-3 inline-block text-xs text-zinc-400 hover:text-white sm:text-sm">
          ← {locale === "es" ? "Todas las clínicas" : "All clinics"}
        </Link>

        <div className="mb-4 lg:hidden">
          <p className="mb-1.5 text-xs font-medium uppercase tracking-[0.15em] text-emerald-500">
            {c.workspace?.name ?? L.kicker}
          </p>
          <h1 className="text-2xl font-bold leading-tight tracking-tight text-white">{title}</h1>
        </div>

        <div className="lg:grid lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] lg:gap-10">
          <div className="mb-6 -mx-4 sm:-mx-6 lg:sticky lg:top-6 lg:mx-0 lg:mb-0 lg:self-start">
            <ImageCarousel images={images} alt={title} />
          </div>

          <div className="min-w-0">
            <div className="hidden lg:block">
              <p className="mb-2 text-xs font-medium uppercase tracking-[0.15em] text-emerald-500">
                {c.workspace?.name ?? L.kicker}
              </p>
              <h1 className="mb-2 text-4xl font-bold leading-tight tracking-tight text-white">{title}</h1>
            </div>
            {description && (
              <p className="mb-6 text-sm text-zinc-400 sm:text-base">{description}</p>
            )}

            <dl className="mb-8 grid gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-sm sm:grid-cols-2 sm:p-5">
              <div>
                <dt className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">{d.label_date}</dt>
                <dd className="mt-0.5 text-white">
                  {formatTournamentDate(c.start_date, c.end_date, c.timezone)}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">{d.label_start_time}</dt>
                <dd className="mt-0.5 text-white">{formatTime(c.start_time, c.timezone)}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">{d.label_location}</dt>
                <dd className="mt-0.5 text-white">
                  {location}
                  {address && <div className="text-xs text-zinc-500">{address}</div>}
                  {c.google_maps_url && (
                    <a
                      href={c.google_maps_url}
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
                <dt className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">{d.label_registration}</dt>
                <dd className="mt-0.5">
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
                </dd>
              </div>
            </dl>

            {coaches.length > 0 && (
              <section className="mb-8">
                <h2 className="mb-3 text-lg font-semibold text-white sm:text-xl">{L.coaches}</h2>
                <ul className="grid gap-3 sm:grid-cols-2">
                  {coaches.map((coach) => (
                    <li key={coach.id} className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                      {coach.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={coach.image_url}
                          alt={coach.name}
                          className="h-14 w-14 flex-shrink-0 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-zinc-800 text-base font-semibold text-zinc-400">
                          {coach.name
                            .split(" ")
                            .map((p) => p[0])
                            .filter(Boolean)
                            .slice(0, 2)
                            .join("")
                            .toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white">{coach.name}</p>
                        {coach.title && (
                          <p className="text-xs text-zinc-500">{coach.title}</p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {details && (
              <section className="mb-8">
                <h2 className="mb-2 text-lg font-semibold text-white sm:text-xl">{d.section_details}</h2>
                <div className="whitespace-pre-wrap rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-sm leading-relaxed text-zinc-300 sm:p-5">
                  {details}
                </div>
              </section>
            )}

            {c.registration_open && (
              <section className="mb-8">
                <h2 className="mb-3 text-lg font-semibold text-white sm:text-xl">{L.register}</h2>
                <ClinicRegisterForm clinicSlug={c.slug} isFull={isFull} locale={locale} />
              </section>
            )}

            <section className="mb-10">
              <h2 className="mb-3 text-lg font-semibold text-white sm:text-xl">{L.participants}</h2>
              {active.length === 0 ? (
                <p className="rounded-lg border border-dashed border-zinc-800 px-4 py-3 text-xs text-zinc-500">
                  {L.noParticipants}
                </p>
              ) : (
                <ul className="divide-y divide-zinc-800 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900">
                  {active.map((r, i) => (
                    <li key={r.id} className="flex items-center justify-between gap-2 px-4 py-3 text-sm">
                      <div className="min-w-0 truncate">
                        <span className="mr-2 text-xs text-zinc-500">#{i + 1}</span>
                        {r.first_name} {r.last_name}
                      </div>
                      <span className="text-xs text-zinc-500">
                        {r.rating_self === "beginner" ? (locale === "es" ? "Principiante" : "Beginner") : r.rating_self}
                        {" · "}
                        {locale === "es" ? "edad" : "age"} {r.age}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
