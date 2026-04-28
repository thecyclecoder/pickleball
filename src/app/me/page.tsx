import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatTournamentDate, formatTime } from "@/lib/format";
import { categoryLabelI18n, getLocale, pick } from "@/lib/i18n";
import { PublicHeader } from "@/components/public-header";
import { PublicFooter } from "@/components/public-footer";
import {
  clinicRatingLabel,
  lessonTypeLabel,
  type CategoryType,
  type TeamStatus,
  type PaymentStatus,
  type ClinicRating,
  type LessonRequestStatus,
  type LessonType,
} from "@/lib/types";

export const dynamic = "force-dynamic";

type PlayerRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  rating: number;
  is_captain: boolean;
  team: {
    id: string;
    status: TeamStatus;
    payment_status: PaymentStatus;
    registered_at: string;
    category: {
      id: string;
      type: CategoryType;
      rating: string;
      label: string | null;
      label_es: string | null;
    };
    tournament: {
      id: string;
      slug: string;
      title: string;
      title_es: string | null;
      start_date: string;
      end_date: string | null;
      start_time: string;
      timezone: string;
      location: string;
      location_es: string | null;
      status: string;
    };
    players: { id: string; first_name: string; last_name: string }[];
  };
};

type ClinicRow = {
  id: string;
  status: "registered" | "waitlisted" | "cancelled";
  paid_at: string | null;
  rating_self: ClinicRating;
  age: number;
  registered_at: string;
  first_name: string;
  last_name: string;
  clinic: {
    id: string;
    slug: string;
    title: string;
    title_es: string | null;
    start_date: string;
    end_date: string | null;
    start_time: string;
    timezone: string;
    location: string;
    location_es: string | null;
  };
};

type LessonRow = {
  id: string;
  status: LessonRequestStatus;
  paid_at: string | null;
  skill_level: ClinicRating;
  lesson_type: LessonType | null;
  goals: string | null;
  schedule_notes: string | null;
  created_at: string;
  first_name: string;
  last_name: string;
  coach: {
    id: string;
    slug: string;
    display_name: string;
    display_name_es: string | null;
    tagline: string | null;
    tagline_es: string | null;
    avatar_url: string | null;
  };
};

type Item = {
  key: string;
  kind: "tournament" | "clinic";
  href: string;
  title: string;
  start_date: string;
  end_date: string | null;
  start_time: string;
  timezone: string;
  location: string;
  status: string;
  paid: boolean;
  subtitle: string;
};

export default async function MePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/me");

  const locale = await getLocale();
  const admin = createAdminClient();

  const [{ data: playerData }, { data: clinicData }, { data: lessonData }] = await Promise.all([
    admin
      .from("players")
      .select(
        `id, first_name, last_name, email, rating, is_captain,
         team:teams!inner (
           id, status, payment_status, registered_at,
           category:tournament_categories!inner (id, type, rating, label, label_es),
           tournament:tournaments!inner (
             id, slug, title, title_es, start_date, end_date, start_time, timezone,
             location, location_es, status
           ),
           players (id, first_name, last_name)
         )`
      )
      .eq("user_id", user.id)
      .order("registered_at", { ascending: false, referencedTable: "teams" }),
    admin
      .from("clinic_registrations")
      .select(
        `id, status, paid_at, rating_self, age, registered_at, first_name, last_name,
         clinic:clinics!inner (
           id, slug, title, title_es, start_date, end_date, start_time, timezone,
           location, location_es
         )`
      )
      .eq("user_id", user.id),
    admin
      .from("lesson_requests")
      .select(
        `id, status, paid_at, skill_level, lesson_type, goals, schedule_notes, created_at,
         first_name, last_name,
         coach:coach_profiles!inner (
           id, slug, display_name, display_name_es, tagline, tagline_es, avatar_url
         )`
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  const playerRows = (playerData ?? []) as unknown as PlayerRow[];
  const clinicRows = (clinicData ?? []) as unknown as ClinicRow[];
  const lessonRows = (lessonData ?? []) as unknown as LessonRow[];

  const items: Item[] = [];

  for (const r of playerRows) {
    const tour = r.team.tournament;
    const title = pick<string>(tour.title, tour.title_es ?? "", locale);
    const location = pick<string>(tour.location, tour.location_es ?? "", locale);
    const catLabel = categoryLabelI18n(r.team.category, locale);
    const teammate = r.team.players.find((p) => p.id !== r.id);
    items.push({
      key: `t:${r.team.id}`,
      kind: "tournament",
      href: `/me/registrations/${r.team.id}`,
      title,
      start_date: tour.start_date,
      end_date: tour.end_date,
      start_time: tour.start_time,
      timezone: tour.timezone,
      location,
      status: r.team.status,
      paid: r.team.payment_status === "paid",
      subtitle: teammate
        ? `${catLabel} · ${locale === "es" ? "con" : "with"} ${teammate.first_name} ${teammate.last_name}`
        : catLabel,
    });
  }

  for (const r of clinicRows) {
    const c = r.clinic;
    const title = pick<string>(c.title, c.title_es ?? "", locale);
    const location = pick<string>(c.location, c.location_es ?? "", locale);
    const ratingLabel =
      r.rating_self === "beginner"
        ? locale === "es" ? "Principiante" : "Beginner"
        : r.rating_self;
    items.push({
      key: `c:${r.id}`,
      kind: "clinic",
      href: `/clinics/${c.slug}`,
      title,
      start_date: c.start_date,
      end_date: c.end_date,
      start_time: c.start_time,
      timezone: c.timezone,
      location,
      status: r.status,
      paid: !!r.paid_at,
      subtitle: `${locale === "es" ? "Clínica" : "Clinic"} · ${ratingLabel}`,
    });
  }

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = items
    .filter((i) => (i.end_date ?? i.start_date) >= today)
    .sort((a, b) => a.start_date.localeCompare(b.start_date));
  const past = items
    .filter((i) => (i.end_date ?? i.start_date) < today)
    .sort((a, b) => b.start_date.localeCompare(a.start_date));

  const meta = user.user_metadata ?? {};
  // Magic-link signups don't populate user_metadata, but we already know
  // who the user is from any existing tournament/clinic/lesson row.
  // Fall back through them in order, then persist back to user_metadata
  // so future page loads (and other surfaces) have the name without a
  // second lookup.
  const fallbackRow =
    playerRows[0] ?? clinicRows[0] ?? lessonRows[0] ?? null;
  const firstName = (meta.first_name as string | undefined) ?? fallbackRow?.first_name ?? null;
  const lastName = (meta.last_name as string | undefined) ?? fallbackRow?.last_name ?? null;
  if (!meta.first_name && !meta.last_name && (firstName || lastName)) {
    admin.auth.admin
      .updateUserById(user.id, {
        user_metadata: {
          ...meta,
          first_name: firstName ?? undefined,
          last_name: lastName ?? undefined,
        },
      })
      .catch((e) => console.error("Failed to backfill user_metadata name:", e));
  }
  const displayName = [firstName, lastName].filter(Boolean).join(" ") || user.email;

  const L =
    locale === "es"
      ? {
          upcoming: "Próximos eventos",
          past: "Eventos pasados",
          lessons: "Solicitudes de lecciones",
          empty: "No tienes inscripciones próximas.",
          noneEver: "Aún no tienes inscripciones.",
          browseTour: "Explorar torneos →",
          browseClin: "Explorar clínicas →",
          browseCoach: "Explorar coaches →",
        }
      : {
          upcoming: "Upcoming events",
          past: "Past events",
          lessons: "Lesson requests",
          empty: "You haven't registered for any upcoming events yet.",
          noneEver: "No registrations yet.",
          browseTour: "Browse tournaments →",
          browseClin: "Browse clinics →",
          browseCoach: "Browse coaches →",
        };

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950">
      <PublicHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 sm:px-6 sm:py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            {displayName}
          </h1>
          <p className="text-sm text-zinc-400">{user.email}</p>
        </div>

        <Section title={L.upcoming} items={upcoming} locale={locale} empty={L.empty} />

        {lessonRows.length > 0 && (
          <div className="mt-10">
            <LessonsSection title={L.lessons} rows={lessonRows} locale={locale} />
          </div>
        )}

        {past.length > 0 && (
          <div className="mt-10">
            <Section title={L.past} items={past} locale={locale} empty="" dim />
          </div>
        )}

        {items.length === 0 && lessonRows.length === 0 && (
          <div className="mt-10 rounded-xl border border-dashed border-zinc-800 bg-zinc-900/40 p-10 text-center">
            <p className="mb-4 text-sm text-zinc-400">{L.noneEver}</p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link
                href="/tournaments"
                className="inline-block rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
              >
                {L.browseTour}
              </Link>
              <Link
                href="/clinics"
                className="inline-block rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-200 hover:border-zinc-700 hover:text-white"
              >
                {L.browseClin}
              </Link>
              <Link
                href="/coaches"
                className="inline-block rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-200 hover:border-zinc-700 hover:text-white"
              >
                {L.browseCoach}
              </Link>
            </div>
          </div>
        )}
      </main>
      <PublicFooter />
    </div>
  );
}

function Section({
  title,
  items,
  locale,
  empty,
  dim,
}: {
  title: string;
  items: Item[];
  locale: "en" | "es";
  empty: string;
  dim?: boolean;
}) {
  if (items.length === 0 && !empty) return null;
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-400">{title}</h2>
      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-800 p-6 text-center text-sm text-zinc-500">
          {empty}
        </p>
      ) : (
        <ul className={`space-y-3 ${dim ? "opacity-70" : ""}`}>
          {items.map((i) => (
            <li key={i.key} className="rounded-xl border border-zinc-800 bg-zinc-900">
              <Link
                href={i.href}
                className="flex flex-wrap items-start justify-between gap-3 px-5 py-4 hover:bg-zinc-900/50"
              >
                <div className="min-w-0 flex-1">
                  <p className="mb-0.5 text-xs text-zinc-500">
                    {formatTournamentDate(i.start_date, i.end_date, i.timezone)} ·{" "}
                    {formatTime(i.start_time, i.timezone)} · {i.location}
                  </p>
                  <h3 className="mb-1 flex items-center gap-2 text-base font-semibold text-white">
                    <span>{i.title}</span>
                    <KindBadge kind={i.kind} locale={locale} />
                  </h3>
                  <p className="text-sm text-zinc-400">{i.subtitle}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <StatusBadge status={i.status} locale={locale} />
                  {i.paid && (
                    <span className="rounded-md border border-emerald-700 bg-emerald-950/30 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-emerald-400">
                      {locale === "es" ? "Pagado" : "Paid"}
                    </span>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function KindBadge({ kind, locale }: { kind: "tournament" | "clinic"; locale: "en" | "es" }) {
  const labels = {
    tournament: locale === "es" ? "Torneo" : "Tournament",
    clinic: locale === "es" ? "Clínica" : "Clinic",
  };
  const cls = kind === "clinic" ? "border-amber-800 text-amber-400" : "border-zinc-700 text-zinc-400";
  return (
    <span className={`rounded-md border px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider ${cls}`}>
      {labels[kind]}
    </span>
  );
}

function LessonsSection({
  title,
  rows,
  locale,
}: {
  title: string;
  rows: LessonRow[];
  locale: "en" | "es";
}) {
  const statusLabels: Record<LessonRequestStatus, { label: string; cls: string; es: string }> = {
    new: { label: "Awaiting reply", es: "Esperando respuesta", cls: "border-amber-800 bg-amber-950/40 text-amber-300" },
    contacted: { label: "Contacted", es: "Contactado", cls: "border-emerald-800 bg-emerald-950/40 text-emerald-300" },
    scheduled: { label: "Scheduled", es: "Agendada", cls: "border-emerald-800 bg-emerald-950/40 text-emerald-300" },
    completed: { label: "Completed", es: "Completada", cls: "border-zinc-700 bg-zinc-900 text-zinc-300" },
    cancelled: { label: "Cancelled", es: "Cancelada", cls: "border-red-900 bg-red-950/40 text-red-300" },
  };
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-400">{title}</h2>
      <ul className="space-y-3">
        {rows.map((r) => {
          const meta = statusLabels[r.status];
          const name = pick<string>(r.coach.display_name, r.coach.display_name_es ?? "", locale);
          const tagline = pick<string>(r.coach.tagline ?? "", r.coach.tagline_es ?? "", locale);
          return (
            <li key={r.id} className="rounded-xl border border-zinc-800 bg-zinc-900">
              <Link
                href={`/coaches/${r.coach.slug}`}
                className="flex flex-wrap items-center gap-3 px-5 py-4 hover:bg-zinc-900/50"
              >
                {r.coach.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={r.coach.avatar_url}
                    alt=""
                    className="h-12 w-12 flex-shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-zinc-800 text-sm font-semibold text-zinc-400">
                    {name
                      .split(" ")
                      .map((p) => p[0])
                      .filter(Boolean)
                      .slice(0, 2)
                      .join("")
                      .toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="mb-0.5 text-xs text-zinc-500">
                    {locale === "es" ? "Solicitud enviada" : "Requested"}{" "}
                    {new Date(r.created_at).toLocaleDateString()}
                  </p>
                  <h3 className="text-base font-semibold text-white">{name}</h3>
                  <p className="text-sm text-zinc-400">
                    {clinicRatingLabel(r.skill_level, locale)}
                    {r.lesson_type && (
                      <>
                        {" · "}
                        {lessonTypeLabel(r.lesson_type, locale)}
                      </>
                    )}
                    {tagline && <> · {tagline}</>}
                  </p>
                </div>
                <span
                  className={`rounded-md border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${meta.cls}`}
                >
                  {locale === "es" ? meta.es : meta.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function StatusBadge({ status, locale }: { status: string; locale: "en" | "es" }) {
  const enLabels: Record<string, { label: string; cls: string }> = {
    registered: { label: "Registered", cls: "border-emerald-800 bg-emerald-950/40 text-emerald-300" },
    confirmed: { label: "Confirmed", cls: "border-emerald-800 bg-emerald-950/40 text-emerald-300" },
    waitlisted: { label: "Waitlisted", cls: "border-amber-800 bg-amber-950/40 text-amber-300" },
    cancelled: { label: "Cancelled", cls: "border-red-900 bg-red-950/40 text-red-300" },
  };
  const esLabels: Record<string, string> = {
    registered: "Inscrito",
    confirmed: "Confirmado",
    waitlisted: "Lista de espera",
    cancelled: "Cancelado",
  };
  const meta = enLabels[status];
  if (!meta) return null;
  const label = locale === "es" ? esLabels[status] ?? meta.label : meta.label;
  return (
    <span className={`rounded-md border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${meta.cls}`}>
      {label}
    </span>
  );
}
