import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentMembership } from "@/lib/auth";
import { formatTournamentDate } from "@/lib/format";
import { categoryLabel } from "@/lib/categories";
import { TournamentForm } from "../tournament-form";
import { RegistrationsPanel } from "./registrations-panel";
import { DangerZone } from "./danger-zone";
import type { Tournament, TournamentCategory, Team, Player, TournamentFormat } from "@/lib/types";

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

  const { data } = await admin
    .from("tournaments")
    .select(
      `*,
       categories:tournament_categories (*),
       teams (*, players (*))`
    )
    .eq("id", id)
    .eq("workspace_id", res.member.workspace_id)
    .limit(1)
    .single();

  if (!data) notFound();
  const tournament = data as Tournament & {
    categories: TournamentCategory[];
    teams: (Team & { players: Player[] })[];
  };

  const { data: formatRows } = await admin
    .from("tournament_formats")
    .select("*")
    .eq("workspace_id", res.member.workspace_id)
    .order("created_at", { ascending: false });
  const formats = (formatRows ?? []) as TournamentFormat[];

  const publicUrl = `/tournaments/${tournament.slug}`;

  return (
    <div>
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

      <RegistrationsPanel
        tournamentId={tournament.id}
        categories={tournament.categories
          .slice()
          .sort((a, b) => a.sort_order - b.sort_order || a.type.localeCompare(b.type))
          .map((c) => ({ ...c, display: categoryLabel(c) }))}
        teams={tournament.teams}
      />

      <div className="mt-8">
        <h2 className="mb-4 text-lg font-semibold text-white">Edit</h2>
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
          }))}
          formats={formats}
        />
      </div>

      <div className="mt-10">
        <DangerZone tournamentId={tournament.id} tournamentTitle={tournament.title} />
      </div>
    </div>
  );
}
