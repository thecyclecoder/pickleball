import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentMembership, isSuperAdmin } from "@/lib/auth";
import { PlayersPanel } from "./players-panel";

export const dynamic = "force-dynamic";

type PlayerRaw = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  rating: number;
  user_id: string | null;
  confirmed_at: string | null;
  created_at: string;
  workspace_id: string | null;
  team: {
    id: string;
    status: string;
    registered_at: string;
    tournament: { id: string; slug: string; title: string } | null;
  } | null;
};

type ClinicRegRaw = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  rating_self: string;
  user_id: string | null;
  confirmed_at: string | null;
  registered_at: string;
  workspace_id: string | null;
  status: string;
  clinic: { id: string; slug: string; title: string } | null;
};

export type PlayerAggregate = {
  email: string;
  first_name: string;
  last_name: string;
  /** Display string — numeric for tournament players, "Beginner" / number for clinics. */
  rating: string;
  has_account: boolean;
  registration_count: number;
  last_registered_at: string;
  workspaces: { id: string; name: string }[];
  events: {
    kind: "tournament" | "clinic";
    id: string;
    slug: string;
    title: string;
    workspace_id: string | null;
    workspace_name: string;
    registered_at: string;
    status: string;
  }[];
};

export default async function AdminPlayersPage({
  searchParams,
}: {
  searchParams: Promise<{ all?: string }>;
}) {
  const res = await getCurrentMembership();
  if (res.status !== "ok") return null;
  const sp = await searchParams;
  const superAdmin = isSuperAdmin(res.user);
  const showAll = superAdmin && sp.all === "1";

  const admin = createAdminClient();

  const playersQuery = admin
    .from("players")
    .select(
      `id, first_name, last_name, email, rating, user_id, confirmed_at, created_at, workspace_id,
       team:teams (
         id, status, registered_at,
         tournament:tournaments (id, slug, title)
       )`
    )
    .order("created_at", { ascending: false });
  const clinicQuery = admin
    .from("clinic_registrations")
    .select(
      `id, first_name, last_name, email, rating_self, user_id, confirmed_at, registered_at, workspace_id, status,
       clinic:clinics (id, slug, title)`
    )
    .order("registered_at", { ascending: false });

  const [playersRes, clinicRes, workspacesRes] = await Promise.all([
    showAll ? playersQuery : playersQuery.eq("workspace_id", res.member.workspace_id),
    showAll ? clinicQuery : clinicQuery.eq("workspace_id", res.member.workspace_id),
    admin.from("workspaces").select("id, name"),
  ]);
  const wsById = new Map((workspacesRes.data ?? []).map((w) => [w.id, w.name]));

  const players = (playersRes.data ?? []) as unknown as PlayerRaw[];
  const clinicRegs = (clinicRes.data ?? []) as unknown as ClinicRegRaw[];

  const byEmail = new Map<string, PlayerAggregate>();

  function ensure(key: string, seed: Pick<PlayerAggregate, "first_name" | "last_name" | "email" | "rating">): PlayerAggregate {
    const existing = byEmail.get(key);
    if (existing) return existing;
    const fresh: PlayerAggregate = {
      email: key,
      first_name: seed.first_name,
      last_name: seed.last_name,
      rating: seed.rating,
      has_account: false,
      registration_count: 0,
      last_registered_at: "",
      workspaces: [],
      events: [],
    };
    byEmail.set(key, fresh);
    return fresh;
  }

  function noteWorkspace(agg: PlayerAggregate, workspaceId: string | null) {
    if (!workspaceId) return;
    if (agg.workspaces.some((w) => w.id === workspaceId)) return;
    agg.workspaces.push({ id: workspaceId, name: wsById.get(workspaceId) ?? "Workspace" });
  }

  for (const p of players) {
    const key = p.email.toLowerCase();
    const agg = ensure(key, {
      first_name: p.first_name,
      last_name: p.last_name,
      email: key,
      rating: Number(p.rating).toFixed(1),
    });
    agg.registration_count += 1;
    if (p.confirmed_at) agg.has_account = true;
    const at = p.team?.registered_at ?? p.created_at;
    if (at > agg.last_registered_at) {
      agg.last_registered_at = at;
      agg.first_name = p.first_name;
      agg.last_name = p.last_name;
      agg.rating = Number(p.rating).toFixed(1);
    }
    noteWorkspace(agg, p.workspace_id);
    if (p.team?.tournament) {
      agg.events.push({
        kind: "tournament",
        id: p.team.tournament.id,
        slug: p.team.tournament.slug,
        title: p.team.tournament.title,
        workspace_id: p.workspace_id,
        workspace_name: p.workspace_id ? wsById.get(p.workspace_id) ?? "Workspace" : "—",
        registered_at: at,
        status: p.team.status,
      });
    }
  }

  for (const r of clinicRegs) {
    const key = r.email.toLowerCase();
    const ratingDisplay = r.rating_self === "beginner" ? "Beginner" : r.rating_self;
    const agg = ensure(key, {
      first_name: r.first_name,
      last_name: r.last_name,
      email: key,
      rating: ratingDisplay,
    });
    agg.registration_count += 1;
    if (r.confirmed_at) agg.has_account = true;
    if (r.registered_at > agg.last_registered_at) {
      agg.last_registered_at = r.registered_at;
      agg.first_name = r.first_name;
      agg.last_name = r.last_name;
      agg.rating = ratingDisplay;
    }
    noteWorkspace(agg, r.workspace_id);
    if (r.clinic) {
      agg.events.push({
        kind: "clinic",
        id: r.clinic.id,
        slug: r.clinic.slug,
        title: r.clinic.title,
        workspace_id: r.workspace_id,
        workspace_name: r.workspace_id ? wsById.get(r.workspace_id) ?? "Workspace" : "—",
        registered_at: r.registered_at,
        status: r.status,
      });
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
            {showAll
              ? "Every unique person who has registered for an event across every workspace."
              : "Everyone who has registered for a tournament or clinic in this workspace."}{" "}
            <strong className="text-emerald-400">Confirmed</strong> = signed in via magic link.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          {superAdmin && (
            <div className="flex items-center gap-0.5 rounded-md border border-zinc-800 bg-zinc-900 p-0.5">
              <Link
                href="/admin/players"
                className={`rounded px-2.5 py-1 font-medium transition-colors ${
                  !showAll ? "bg-emerald-600 text-white" : "text-zinc-400 hover:text-white"
                }`}
              >
                This workspace
              </Link>
              <Link
                href="/admin/players?all=1"
                className={`rounded px-2.5 py-1 font-medium transition-colors ${
                  showAll ? "bg-emerald-600 text-white" : "text-zinc-400 hover:text-white"
                }`}
              >
                All workspaces
              </Link>
            </div>
          )}
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
          <p className="mb-3 text-sm text-zinc-400">No players yet.</p>
        </div>
      ) : (
        <PlayersPanel players={aggregates} showWorkspaceColumn={showAll} />
      )}
    </div>
  );
}
