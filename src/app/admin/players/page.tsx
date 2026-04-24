import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentMembership } from "@/lib/auth";
import { PlayersPanel } from "./players-panel";

export const dynamic = "force-dynamic";

type Raw = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  rating: number;
  user_id: string | null;
  confirmed_at: string | null;
  created_at: string;
  team: {
    id: string;
    status: string;
    registered_at: string;
    tournament: { id: string; slug: string; title: string } | null;
  } | null;
};

export type PlayerAggregate = {
  email: string;
  first_name: string;
  last_name: string;
  rating: number;
  has_account: boolean;
  registration_count: number;
  last_registered_at: string;
  tournaments: { id: string; slug: string; title: string; registered_at: string; status: string }[];
};

export default async function AdminPlayersPage() {
  const res = await getCurrentMembership();
  if (res.status !== "ok") return null;

  const admin = createAdminClient();
  const { data: players } = await admin
    .from("players")
    .select(
      `id, first_name, last_name, email, rating, user_id, confirmed_at, created_at,
       team:teams (
         id, status, registered_at,
         tournament:tournaments (id, slug, title)
       )`
    )
    .eq("workspace_id", res.member.workspace_id)
    .order("created_at", { ascending: false });

  const rows = (players ?? []) as unknown as Raw[];

  // Aggregate by lowercased email so a person who registered for N
  // tournaments shows up as one row with N in the "Registrations" column.
  const byEmail = new Map<string, PlayerAggregate>();
  for (const r of rows) {
    const key = r.email.toLowerCase();
    const entry = byEmail.get(key);
    const registeredAt = r.team?.registered_at ?? r.created_at;
    const tour = r.team?.tournament ?? null;
    const tourEntry = tour
      ? {
          id: tour.id,
          slug: tour.slug,
          title: tour.title,
          registered_at: registeredAt,
          status: r.team?.status ?? "registered",
        }
      : null;
    if (!entry) {
      byEmail.set(key, {
        email: key,
        first_name: r.first_name,
        last_name: r.last_name,
        rating: Number(r.rating),
        has_account: !!r.confirmed_at,
        registration_count: 1,
        last_registered_at: registeredAt,
        tournaments: tourEntry ? [tourEntry] : [],
      });
    } else {
      entry.registration_count += 1;
      if (tourEntry) entry.tournaments.push(tourEntry);
      if (r.confirmed_at) entry.has_account = true;
      if (registeredAt > entry.last_registered_at) {
        entry.last_registered_at = registeredAt;
        entry.first_name = r.first_name;
        entry.last_name = r.last_name;
        entry.rating = Number(r.rating);
      }
    }
  }
  const aggregates = Array.from(byEmail.values()).sort((a, b) =>
    b.last_registered_at.localeCompare(a.last_registered_at)
  );

  const withAccount = aggregates.filter((p) => p.has_account).length;
  const pending = aggregates.length - withAccount;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Players</h1>
          <p className="text-sm text-zinc-400">
            Everyone who has registered for a tournament in this workspace. Players become{" "}
            <strong className="text-emerald-400">confirmed</strong> users when they click the magic
            link in their confirmation email (or sign in with Google using that email).
          </p>
        </div>
        <div className="flex gap-2 text-xs">
          <span className="rounded-md border border-emerald-800 bg-emerald-950/40 px-2 py-1 text-emerald-300">
            {withAccount} confirmed
          </span>
          <span className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-400">
            {pending} pending
          </span>
        </div>
      </div>

      {aggregates.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/40 p-10 text-center">
          <p className="mb-3 text-sm text-zinc-400">No players have registered yet.</p>
          <Link
            href="/admin/tournaments"
            className="text-sm text-emerald-400 hover:text-emerald-300"
          >
            Go to tournaments →
          </Link>
        </div>
      ) : (
        <PlayersPanel players={aggregates} />
      )}
    </div>
  );
}
