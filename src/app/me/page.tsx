import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatTournamentDate, formatTime } from "@/lib/format";
import { categoryLabelI18n, getLocale, pick, t } from "@/lib/i18n";
import { PublicHeader } from "@/components/public-header";
import { PublicFooter } from "@/components/public-footer";
import { SignOutButton } from "../admin/sign-out-button";
import type { CategoryType, TeamStatus, PaymentStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

type Row = {
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
    players: {
      id: string;
      first_name: string;
      last_name: string;
      email: string;
      is_captain: boolean;
    }[];
  };
};

export default async function MePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/me");

  const locale = await getLocale();
  const d = t(locale);

  const admin = createAdminClient();
  // Inner-joined on teams / tournament / category: a player row whose team
  // was hard-deleted (team_id=null after detach) simply won't appear here.
  // We *do* still preserve that history in the admin Players view, which
  // queries by players.workspace_id instead.
  const { data } = await admin
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
         players (id, first_name, last_name, email, is_captain)
       )`
    )
    .eq("user_id", user.id)
    .order("registered_at", { ascending: false, referencedTable: "teams" });

  const rows = (data ?? []) as unknown as Row[];
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = rows.filter((r) => (r.team.tournament.end_date ?? r.team.tournament.start_date) >= today);
  const past = rows.filter((r) => (r.team.tournament.end_date ?? r.team.tournament.start_date) < today);

  const meta = user.user_metadata ?? {};
  const displayName = [meta.first_name, meta.last_name].filter(Boolean).join(" ") || user.email;

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950">
      <PublicHeader />

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 sm:px-6 sm:py-10">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              {displayName}
            </h1>
            <p className="text-sm text-zinc-400">{user.email}</p>
          </div>
          <SignOutButton />
        </div>

        <Section title="Upcoming tournaments" rows={upcoming} locale={locale} dict={d} empty="You haven't registered for any upcoming tournaments yet." />

        {past.length > 0 && (
          <div className="mt-10">
            <Section title="Past tournaments" rows={past} locale={locale} dict={d} empty="" dim />
          </div>
        )}

        {rows.length === 0 && (
          <div className="mt-10 rounded-xl border border-dashed border-zinc-800 bg-zinc-900/40 p-10 text-center">
            <p className="mb-3 text-sm text-zinc-400">
              No registrations yet.
            </p>
            <Link
              href="/tournaments"
              className="inline-block rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
            >
              Browse tournaments →
            </Link>
          </div>
        )}
      </main>

      <PublicFooter />
    </div>
  );
}

function Section({
  title,
  rows,
  locale,
  empty,
  dim,
}: {
  title: string;
  rows: Row[];
  locale: "en" | "es";
  dict: ReturnType<typeof t>;
  empty: string;
  dim?: boolean;
}) {
  if (rows.length === 0 && !empty) return null;
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-400">{title}</h2>
      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-800 p-6 text-center text-sm text-zinc-500">
          {empty}
        </p>
      ) : (
        <ul className={`space-y-3 ${dim ? "opacity-70" : ""}`}>
          {rows.map((r) => {
            const tour = r.team.tournament;
            const title = pick<string>(tour.title, tour.title_es ?? "", locale);
            const location = pick<string>(tour.location, tour.location_es ?? "", locale);
            const catLabel = categoryLabelI18n(
              { type: r.team.category.type, rating: r.team.category.rating, label: r.team.category.label, label_es: r.team.category.label_es },
              locale
            );
            const teammate = r.team.players.find((p) => p.id !== r.id);
            return (
              <li key={r.team.id} className="rounded-xl border border-zinc-800 bg-zinc-900">
                <Link
                  href={`/me/registrations/${r.team.id}`}
                  className="flex flex-wrap items-start justify-between gap-3 px-5 py-4 hover:bg-zinc-900/50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="mb-0.5 text-xs text-zinc-500">
                      {formatTournamentDate(tour.start_date, tour.end_date, tour.timezone)} ·{" "}
                      {formatTime(tour.start_time, tour.timezone)} · {location}
                    </p>
                    <h3 className="mb-1 text-base font-semibold text-white">{title}</h3>
                    <p className="text-sm text-zinc-400">
                      {catLabel}
                      {teammate && (
                        <>
                          {" · with "}
                          <span className="text-zinc-200">
                            {teammate.first_name} {teammate.last_name}
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <StatusBadge status={r.team.status} />
                    <PaymentBadge status={r.team.payment_status} />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function StatusBadge({ status }: { status: TeamStatus }) {
  const map: Record<TeamStatus, string> = {
    registered: "border-emerald-800 bg-emerald-950/40 text-emerald-300",
    confirmed: "border-emerald-800 bg-emerald-950/40 text-emerald-300",
    waitlisted: "border-amber-800 bg-amber-950/40 text-amber-300",
    cancelled: "border-red-900 bg-red-950/40 text-red-300",
  };
  return (
    <span className={`rounded-md border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${map[status]}`}>
      {status}
    </span>
  );
}

function PaymentBadge({ status }: { status: PaymentStatus }) {
  const map: Record<PaymentStatus, string> = {
    unpaid: "border-zinc-700 text-zinc-400",
    paid: "border-emerald-700 bg-emerald-950/30 text-emerald-400",
    refunded: "border-zinc-700 text-zinc-500",
  };
  return (
    <span className={`rounded-md border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${map[status]}`}>
      {status}
    </span>
  );
}
