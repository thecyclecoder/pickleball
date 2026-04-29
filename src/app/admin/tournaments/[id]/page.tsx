import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentMembership } from "@/lib/auth";
import { formatTournamentDate } from "@/lib/format";
import { categoryLabel } from "@/lib/categories";
import { TournamentForm } from "../tournament-form";
import { RegistrationsPanel } from "./registrations-panel";
import { DangerZone } from "./danger-zone";
import { SendResultsButton } from "./send-results-button";
import {
  GraphicsPanel,
  type GraphicRow,
  type PoolForGraphics,
  type CategoryForGraphics,
} from "./graphics-panel";
import type {
  Tournament,
  TournamentCategory,
  TournamentCourt,
  TournamentPool,
  Team,
  Player,
  TournamentFormat,
  Game,
} from "@/lib/types";
import { PoolsPanel } from "./pools-panel";
import { PhoneCollectionTile } from "./phone-collection";

export const dynamic = "force-dynamic";

export default async function AdminTournamentEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const res = await getCurrentMembership();
  if (res.status !== "ok") return null;
  const { id } = await params;
  const admin = createAdminClient();

  // Pools and games reference categories, not tournaments — they have to
  // ride along inside the categories embed since PostgREST can't infer a
  // direct relationship to the tournament row.
  const { data } = await admin
    .from("tournaments")
    .select(
      `*,
       categories:tournament_categories (
         *,
         pools:tournament_pools (*),
         games (*)
       ),
       courts:tournament_courts (*),
       teams (*, players (*))`
    )
    .eq("id", id)
    .eq("workspace_id", res.member.workspace_id)
    .limit(1)
    .single();

  if (!data) notFound();
  const tournament = data as Tournament & {
    categories: (TournamentCategory & {
      pools: TournamentPool[];
      games: Game[];
    })[];
    courts: TournamentCourt[];
    teams: (Team & { players: Player[] })[];
  };

  // Group pools/games/teams per category for the PoolsPanel
  const poolCategoriesView = tournament.categories
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order || a.type.localeCompare(b.type))
    .map((c) => ({
      ...c,
      pools: c.pools ?? [],
      teams: tournament.teams.filter((t) => t.category_id === c.id),
      games: c.games ?? [],
    }));

  const { data: formatRows } = await admin
    .from("tournament_formats")
    .select("*")
    .eq("workspace_id", res.member.workspace_id)
    .order("created_at", { ascending: false });
  const formats = (formatRows ?? []) as TournamentFormat[];

  const { data: graphicRows } = await admin
    .from("tournament_graphics")
    .select("id, type, target_key, svg, png_url, approved, updated_at")
    .eq("tournament_id", id);
  const graphics = (graphicRows ?? []) as GraphicRow[];

  const sortedCategoriesForGraphics = tournament.categories
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order || a.type.localeCompare(b.type));
  const categoriesForGraphics: CategoryForGraphics[] = sortedCategoriesForGraphics.map(
    (c) => ({ id: c.id, display: categoryLabel(c) })
  );
  const poolsForGraphics: PoolForGraphics[] = sortedCategoriesForGraphics.flatMap(
    (c) =>
      (c.pools ?? [])
        .slice()
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((p) => ({
          id: p.id,
          letter: p.letter,
          category_id: c.id,
          categoryDisplay: categoryLabel(c),
        }))
  );

  const sortedCourts = [...tournament.courts].sort(
    (a, b) => a.sort_order - b.sort_order || a.number - b.number
  );

  // Phone-collection stats. Dedupe by email since a player may be on
  // multiple teams — we count people, not roster slots. A player counts
  // as "with phone" if any of their rows in this tournament has one.
  const activePlayers = tournament.teams
    .filter((t) => t.status !== "cancelled")
    .flatMap((t) => t.players);
  const playerByEmail = new Map<string, { phone: string | null }>();
  for (const p of activePlayers) {
    const e = (p.email ?? "").toLowerCase();
    if (!e) continue;
    const existing = playerByEmail.get(e);
    if (!existing || (!existing.phone && p.phone)) {
      playerByEmail.set(e, { phone: p.phone ?? null });
    }
  }
  const totalUniquePlayers = playerByEmail.size;
  const playersWithPhone = Array.from(playerByEmail.values()).filter(
    (p) => p.phone && p.phone.trim()
  ).length;
  const playersMissingPhone = totalUniquePlayers - playersWithPhone;

  const publicUrl = `/tournaments/${tournament.slug}`;

  return (
    <div>
      {tournament.sandbox_mode && (
        <div className="mb-4 rounded-xl border border-amber-700 bg-amber-950/30 px-5 py-3">
          <p className="text-sm font-semibold text-amber-200">⚠ Sandbox mode active</p>
          <p className="mt-0.5 text-xs text-amber-100/80">
            Score-entry notifications go only to workspace owners + admins (with{" "}
            <code className="rounded bg-amber-900/40 px-1">[SANDBOX]</code> prefix). Live data on the
            public page is hidden from non-members. Flip OFF in Visibility before tournament day.
          </p>
        </div>
      )}

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/admin/tournaments" className="text-xs text-zinc-400 hover:text-white">
            ← All tournaments
          </Link>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-white">{tournament.title}</h1>
          <p className="text-xs text-zinc-500">
            {formatTournamentDate(tournament.start_date, tournament.end_date, tournament.timezone)} ·{" "}
            {tournament.status}
          </p>
        </div>
        {tournament.status === "published" && (
          <Link
            href={publicUrl}
            target="_blank"
            className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm text-zinc-300 hover:border-zinc-700 hover:text-white"
          >
            View public page →
          </Link>
        )}
      </div>

      {totalUniquePlayers > 0 && (
        <div className="mb-6">
          <PhoneCollectionTile
            tournamentId={tournament.id}
            totalPlayers={totalUniquePlayers}
            withPhone={playersWithPhone}
            missingPhone={playersMissingPhone}
          />
        </div>
      )}

      <RegistrationsPanel
        tournamentId={tournament.id}
        categories={tournament.categories
          .slice()
          .sort((a, b) => a.sort_order - b.sort_order || a.type.localeCompare(b.type))
          .map((c) => ({ ...c, display: categoryLabel(c) }))}
        teams={tournament.teams}
      />

      {tournament.categories.length > 0 && (
        <div className="mt-8">
          <PoolsPanel
            tournamentId={tournament.id}
            categories={poolCategoriesView}
            courts={sortedCourts}
            formats={formats}
          />
        </div>
      )}

      <div className="mt-8">
        <SendResultsButton
          tournamentId={tournament.id}
          tournamentTitle={tournament.title}
          sandboxMode={tournament.sandbox_mode ?? false}
        />
      </div>

      <div className="mt-6">
        <GraphicsPanel
          tournamentId={tournament.id}
          graphics={graphics}
          pools={poolsForGraphics}
          categories={categoriesForGraphics}
        />
      </div>

      <details className="group mt-8">
        <summary className="flex cursor-pointer list-none items-center justify-between rounded-lg px-1 py-1 hover:bg-zinc-900/40 [&::-webkit-details-marker]:hidden">
          <h2 className="text-lg font-semibold text-white">Edit</h2>
          <svg
            className="h-4 w-4 text-zinc-500 transition-transform group-open:rotate-180"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </summary>
        <div className="mt-4">
        <TournamentForm
          mode="edit"
          initialTournament={{
            id: tournament.id,
            title: tournament.title,
            title_es: tournament.title_es ?? "",
            description: tournament.description ?? "",
            description_es: tournament.description_es ?? "",
            details: tournament.details ?? "",
            details_es: tournament.details_es ?? "",
            start_date: tournament.start_date,
            end_date: tournament.end_date ?? "",
            start_time: tournament.start_time.slice(0, 5),
            timezone: tournament.timezone,
            location: tournament.location,
            location_es: tournament.location_es ?? "",
            address: tournament.address ?? "",
            address_es: tournament.address_es ?? "",
            google_maps_url: tournament.google_maps_url ?? "",
            status: tournament.status,
            registration_open: tournament.registration_open,
            sandbox_mode: tournament.sandbox_mode ?? false,
            images: tournament.images ?? [],
            payment_qr_url: tournament.payment_qr_url ?? "",
            payment_instructions: tournament.payment_instructions ?? "",
            payment_instructions_es: tournament.payment_instructions_es ?? "",
          }}
          initialCategories={tournament.categories.map((c) => ({
            id: c.id,
            type: c.type,
            rating: c.rating,
            label: c.label ?? "",
            label_es: c.label_es ?? "",
            team_limit: c.team_limit,
            waitlist_limit: c.waitlist_limit ?? null,
            sort_order: c.sort_order,
            format_id: c.format_id ?? null,
            pool_count: c.pool_count ?? null,
            advance_per_pool: c.advance_per_pool ?? null,
            semifinals_court_id: c.semifinals_court_id ?? null,
            finals_court_id: c.finals_court_id ?? null,
          }))}
          initialCourts={sortedCourts.map((c) => ({
            id: c.id,
            number: c.number,
            name: c.name ?? "",
            sort_order: c.sort_order,
          }))}
          formats={formats}
        />
        </div>
      </details>

      <div className="mt-10">
        <DangerZone
          tournamentId={tournament.id}
          tournamentTitle={tournament.title}
          isOwner={res.member.role === "owner"}
        />
      </div>
    </div>
  );
}
