import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getLocale, pick } from "@/lib/i18n";
import { PublicHeader } from "@/components/public-header";
import { PublicFooter } from "@/components/public-footer";
import { ImageCarousel } from "@/app/tournaments/[id]/image-carousel";
import { LessonRequestForm } from "./lesson-request-form";
import {
  clinicRatingLabel,
  largestSrc,
  lessonTypeLabel,
  type ClinicRating,
  type CoachProfile,
  type LessonType,
  type Workspace,
} from "@/lib/types";

export const dynamic = "force-dynamic";

type LoadedCoach = CoachProfile & {
  workspace: Pick<Workspace, "id" | "name"> | null;
};

async function loadCoach(slug: string): Promise<LoadedCoach | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("coach_profiles")
    .select(`*, workspace:workspaces (id, name)`)
    .eq("status", "published")
    .eq("slug", slug)
    .maybeSingle();
  return (data as LoadedCoach | null) ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const c = await loadCoach(slug);
  if (!c) return { title: "Coach not found" };

  // Share-card format: "Coach: <Name>" / "<tagline> · DUPR x.xxx · <area>"
  // — keeps the most identifying info (name, role, rating) above any
  // truncation that platforms apply to long descriptions.
  const titleShare = `Coach: ${c.display_name}`;
  const descParts: string[] = [];
  if (c.tagline?.trim()) descParts.push(c.tagline.trim());
  if (c.dupr_rating != null) descParts.push(`DUPR ${c.dupr_rating}`);
  if (c.service_area?.trim()) descParts.push(c.service_area.trim().split(/\n/)[0]);
  const description = descParts.length
    ? descParts.join(" · ")
    : c.bio?.slice(0, 240)?.trim() ||
      `Take a pickleball lesson with ${c.display_name} in Puerto Rico.`;

  const cover = (c.images ?? [])[0];
  const ogImage = cover ? largestSrc(cover) : c.avatar_url ?? "/icon-512.png";
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://buentiro.app";
  const canonical = `${siteUrl}/coaches/${c.slug}`;
  return {
    title: titleShare,
    description,
    alternates: { canonical },
    openGraph: {
      type: "profile",
      title: titleShare,
      description,
      url: canonical,
      siteName: "Buen Tiro",
      images: [{ url: ogImage, alt: c.display_name }],
    },
    twitter: {
      card: "summary_large_image",
      title: titleShare,
      description,
      images: [ogImage],
    },
  };
}

export default async function CoachDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const c = await loadCoach(slug);
  if (!c) notFound();

  const locale = await getLocale();

  const name = pick<string>(c.display_name, c.display_name_es ?? "", locale);
  const tagline = pick<string>(c.tagline ?? "", c.tagline_es ?? "", locale);
  const bio = pick<string>(c.bio ?? "", c.bio_es ?? "", locale);
  const priceNotes = pick<string>(c.price_notes ?? "", c.price_notes_es ?? "", locale);
  const serviceArea = pick<string>(c.service_area ?? "", c.service_area_es ?? "", locale);
  const certifications = pick<string>(c.certifications ?? "", c.certifications_es ?? "", locale);

  const images =
    c.images && c.images.length > 0
      ? c.images
      : c.avatar_url
        ? [{ srcset: [{ w: 1200, url: c.avatar_url }] }]
        : [];

  const L =
    locale === "es"
      ? {
          kicker: "Coach",
          back: "Todos los coaches",
          requestHeading: "Solicitar lección",
          notAccepting: "Este coach no está aceptando solicitudes en este momento.",
          aboutHeading: "Acerca de",
          lessonsHeading: "Lecciones",
          lessonTypes: "Tipos de lección",
          skillLevels: "Niveles que enseña",
          languages: "Idiomas",
          experience: "Experiencia",
          years: (n: number) => `${n} año${n === 1 ? "" : "s"} entrenando`,
          dupr: (r: number) => `DUPR ${r}`,
          pricing: "Precio",
          serviceArea: "Lugar / canchas",
          certifications: "Certificaciones",
          languageEn: "Inglés",
          languageEs: "Español",
        }
      : {
          kicker: "Coach",
          back: "All coaches",
          requestHeading: "Request a lesson",
          notAccepting: "This coach isn't accepting new requests right now.",
          aboutHeading: "About",
          lessonsHeading: "Lessons",
          lessonTypes: "Lesson types",
          skillLevels: "Skill levels",
          languages: "Languages",
          experience: "Experience",
          years: (n: number) => `${n} year${n === 1 ? "" : "s"} coaching`,
          dupr: (r: number) => `DUPR ${r}`,
          pricing: "Pricing",
          serviceArea: "Where",
          certifications: "Certifications",
          languageEn: "English",
          languageEs: "Spanish",
        };

  const jsonLdDescParts: string[] = [];
  if (c.tagline?.trim()) jsonLdDescParts.push(c.tagline.trim());
  if (c.dupr_rating != null) jsonLdDescParts.push(`DUPR ${c.dupr_rating}`);
  if (c.bio?.trim()) jsonLdDescParts.push(c.bio.trim().slice(0, 400));
  const personJsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: c.display_name,
    description: jsonLdDescParts.length > 0 ? jsonLdDescParts.join(" — ") : undefined,
    image: c.avatar_url ?? (c.images?.[0] ? largestSrc(c.images[0]) : undefined),
    jobTitle: "Pickleball Coach",
    knowsLanguage:
      c.languages && c.languages.length > 0
        ? c.languages.map((l) => (l === "es" ? "Spanish" : l === "en" ? "English" : l))
        : undefined,
    areaServed: c.service_area?.trim() || "Puerto Rico",
    worksFor: c.workspace?.name ? { "@type": "Organization", name: c.workspace.name } : undefined,
    url: `${process.env.NEXT_PUBLIC_SITE_URL || "https://buentiro.app"}/coaches/${c.slug}`,
  };

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950">
      <Script
        id="coach-jsonld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(personJsonLd) }}
      />
      <PublicHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-4 sm:px-6 sm:py-8">
        <Link href="/coaches" className="mb-3 inline-block text-xs text-zinc-400 hover:text-white sm:text-sm">
          ← {L.back}
        </Link>

        <div className="mb-4 lg:hidden">
          <p className="mb-1.5 text-xs font-medium uppercase tracking-[0.15em] text-emerald-500">
            {c.workspace?.name ?? L.kicker}
          </p>
          <h1 className="text-2xl font-bold leading-tight tracking-tight text-white">{name}</h1>
          {tagline && <p className="mt-2 text-sm text-zinc-400">{tagline}</p>}
        </div>

        <div className="lg:grid lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] lg:gap-10">
          <div className="mb-6 -mx-4 sm:-mx-6 lg:sticky lg:top-6 lg:mx-0 lg:mb-0 lg:self-start">
            {images.length > 0 ? (
              <ImageCarousel images={images} alt={name} />
            ) : (
              <div className="aspect-square w-full bg-zinc-900" />
            )}
          </div>

          <div className="min-w-0">
            <div className="hidden lg:block">
              <p className="mb-2 text-xs font-medium uppercase tracking-[0.15em] text-emerald-500">
                {c.workspace?.name ?? L.kicker}
              </p>
              <h1 className="mb-2 text-4xl font-bold leading-tight tracking-tight text-white">{name}</h1>
              {tagline && <p className="mb-6 text-base text-zinc-400">{tagline}</p>}
            </div>

            {bio && (
              <section className="mb-8">
                <h2 className="mb-2 text-lg font-semibold text-white sm:text-xl">{L.aboutHeading}</h2>
                <div className="whitespace-pre-wrap rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-sm leading-relaxed text-zinc-300 sm:p-5">
                  {bio}
                </div>
              </section>
            )}

            {((c.lesson_types?.length ?? 0) > 0 ||
              (c.skill_levels?.length ?? 0) > 0 ||
              (c.languages?.length ?? 0) > 0) && (
              <section className="mb-8">
                <h2 className="mb-3 text-lg font-semibold text-white sm:text-xl">{L.lessonsHeading}</h2>
                <div className="grid gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-sm sm:p-5">
                  {(c.lesson_types?.length ?? 0) > 0 && (
                    <div>
                      <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                        {L.lessonTypes}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {c.lesson_types.map((lt) => (
                          <span
                            key={lt}
                            className="rounded-full border border-zinc-800 bg-zinc-950 px-2.5 py-1 text-xs text-zinc-200"
                          >
                            {lessonTypeLabel(lt as LessonType, locale)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {(c.skill_levels?.length ?? 0) > 0 && (
                    <div>
                      <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                        {L.skillLevels}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {c.skill_levels.map((sl) => (
                          <span
                            key={sl}
                            className="rounded-full border border-emerald-900/60 bg-emerald-950/30 px-2.5 py-1 text-xs text-emerald-300"
                          >
                            {clinicRatingLabel(sl as ClinicRating, locale)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {(c.languages?.length ?? 0) > 0 && (
                    <div>
                      <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                        {L.languages}
                      </p>
                      <p className="text-zinc-200">
                        {c.languages
                          .map((l) => (l === "es" ? L.languageEs : l === "en" ? L.languageEn : l))
                          .join(" · ")}
                      </p>
                    </div>
                  )}
                </div>
              </section>
            )}

            {(c.years_coaching != null || c.dupr_rating != null || certifications) && (
              <section className="mb-8">
                <h2 className="mb-3 text-lg font-semibold text-white sm:text-xl">{L.experience}</h2>
                <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-sm sm:p-5">
                  {(c.years_coaching != null || c.dupr_rating != null) && (
                    <div className="flex flex-wrap gap-3 text-zinc-200">
                      {c.years_coaching != null && (
                        <span className="rounded-md border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs">
                          {L.years(c.years_coaching)}
                        </span>
                      )}
                      {c.dupr_rating != null && (
                        <span className="rounded-md border border-emerald-900/60 bg-emerald-950/30 px-3 py-1.5 text-xs text-emerald-300">
                          {L.dupr(c.dupr_rating)}
                        </span>
                      )}
                    </div>
                  )}
                  {certifications && (
                    <p className="whitespace-pre-wrap text-zinc-300">{certifications}</p>
                  )}
                </div>
              </section>
            )}

            {(priceNotes || serviceArea) && (
              <section className="mb-8 grid gap-3 sm:grid-cols-2">
                {priceNotes && (
                  <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-sm sm:p-5">
                    <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                      {L.pricing}
                    </p>
                    <p className="whitespace-pre-wrap text-zinc-200">{priceNotes}</p>
                  </div>
                )}
                {serviceArea && (
                  <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-sm sm:p-5">
                    <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                      {L.serviceArea}
                    </p>
                    <p className="whitespace-pre-wrap text-zinc-200">{serviceArea}</p>
                  </div>
                )}
              </section>
            )}

            <section className="mb-8">
              <h2 className="mb-3 text-lg font-semibold text-white sm:text-xl">{L.requestHeading}</h2>
              {c.accepting_requests ? (
                <LessonRequestForm
                  coachSlug={c.slug}
                  coachLessonTypes={(c.lesson_types ?? []) as LessonType[]}
                  coachSkillLevels={(c.skill_levels ?? []) as ClinicRating[]}
                  locale={locale}
                />
              ) : (
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 text-sm text-zinc-400">
                  {L.notAccepting}
                </div>
              )}
            </section>
          </div>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
