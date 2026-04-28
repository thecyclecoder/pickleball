import type { Metadata } from "next";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { getLocale, pick } from "@/lib/i18n";
import { PublicHeader } from "@/components/public-header";
import { PublicFooter } from "@/components/public-footer";
import {
  clinicRatingLabel,
  lessonTypeLabel,
  type ClinicRating,
  type CoachProfile,
  type LessonType,
} from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pickleball Coaches in Puerto Rico",
  description:
    "Find a pickleball coach in Puerto Rico — private, semi-private, and group lessons from certified pros at every level.",
  alternates: { canonical: "/coaches" },
  openGraph: {
    type: "website",
    title: "Pickleball Coaches in Puerto Rico",
    description: "Private and semi-private pickleball lessons across Puerto Rico.",
    url: "/coaches",
  },
};

type Row = Pick<
  CoachProfile,
  | "id"
  | "slug"
  | "display_name"
  | "display_name_es"
  | "tagline"
  | "tagline_es"
  | "avatar_url"
  | "lesson_types"
  | "skill_levels"
  | "service_area"
  | "service_area_es"
  | "accepting_requests"
> & {
  workspace: { id: string; name: string } | null;
};

export default async function CoachesListPage() {
  const locale = await getLocale();
  const admin = createAdminClient();
  const { data } = await admin
    .from("coach_profiles")
    .select(
      `id, slug, display_name, display_name_es, tagline, tagline_es, avatar_url,
       lesson_types, skill_levels, service_area, service_area_es, accepting_requests,
       workspace:workspaces (id, name)`
    )
    .eq("status", "published")
    .order("updated_at", { ascending: false });
  const coaches = (data ?? []) as unknown as Row[];

  const L =
    locale === "es"
      ? {
          heading: "Coaches",
          subheading: "Toma una lección con un pro de pickleball en Puerto Rico.",
          empty: "Aún no hay coaches publicados. Vuelve pronto.",
          requestALesson: "Solicitar lección",
          notAccepting: "No acepta solicitudes",
        }
      : {
          heading: "Coaches",
          subheading: "Take a lesson with a pickleball pro in Puerto Rico.",
          empty: "No coaches listed yet. Check back soon.",
          requestALesson: "Request a lesson",
          notAccepting: "Not accepting requests",
        };

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950">
      <PublicHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-0 py-6 sm:px-6 sm:py-10">
        <div className="px-4 sm:px-0">
          <h1 className="mb-2 text-3xl font-bold tracking-tight text-white">{L.heading}</h1>
          <p className="mb-6 text-sm text-zinc-400 sm:mb-8">{L.subheading}</p>
        </div>

        {coaches.length === 0 ? (
          <div className="mx-4 rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 p-10 text-center sm:mx-0">
            <p className="text-sm text-zinc-400">{L.empty}</p>
          </div>
        ) : (
          <div className="grid items-start gap-0 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {coaches.map((c) => {
              const name = pick<string>(c.display_name, c.display_name_es ?? "", locale);
              const tagline = pick<string>(c.tagline ?? "", c.tagline_es ?? "", locale);
              const area = pick<string>(c.service_area ?? "", c.service_area_es ?? "", locale);
              return (
                <Link
                  key={c.id}
                  href={`/coaches/${c.slug}`}
                  className="group flex flex-col gap-3 overflow-hidden border-b border-zinc-800 bg-zinc-900 p-5 transition-colors hover:border-emerald-600 sm:rounded-xl sm:border sm:border-zinc-800"
                >
                  <div className="flex items-center gap-3">
                    {c.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={c.avatar_url}
                        alt={name}
                        className="h-16 w-16 flex-shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full bg-zinc-800 text-base font-semibold text-zinc-400">
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
                        {locale === "es" ? "Coach" : "Coach"}
                      </p>
                      <h3 className="truncate text-base font-semibold text-white group-hover:text-emerald-400">
                        {name}
                      </h3>
                      {tagline && (
                        <p className="line-clamp-1 text-xs text-zinc-400">{tagline}</p>
                      )}
                    </div>
                  </div>

                  {(c.lesson_types?.length || c.skill_levels?.length) && (
                    <div className="flex flex-wrap gap-1.5">
                      {(c.lesson_types ?? []).map((lt) => (
                        <span
                          key={`lt:${lt}`}
                          className="rounded-full border border-zinc-800 bg-zinc-950 px-2 py-0.5 text-[10px] text-zinc-300"
                        >
                          {lessonTypeLabel(lt as LessonType, locale)}
                        </span>
                      ))}
                      {(c.skill_levels ?? []).slice(0, 4).map((sl) => (
                        <span
                          key={`sl:${sl}`}
                          className="rounded-full border border-emerald-900/60 bg-emerald-950/30 px-2 py-0.5 text-[10px] text-emerald-300"
                        >
                          {clinicRatingLabel(sl as ClinicRating, locale)}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="mt-auto text-xs text-zinc-500">
                    {area && <p className="line-clamp-1">{area}</p>}
                    <p className={c.accepting_requests ? "text-emerald-500" : "text-zinc-500"}>
                      {c.accepting_requests ? L.requestALesson + " →" : L.notAccepting}
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
