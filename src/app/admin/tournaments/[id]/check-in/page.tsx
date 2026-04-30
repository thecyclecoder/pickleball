import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentMembership } from "@/lib/auth";
import { categoryLabel } from "@/lib/categories";
import { CheckInList, type CheckInPlayer } from "./check-in-list";
import type {
  Tournament,
  TournamentCategory,
  TournamentPool,
  Team,
  Player,
  Workspace,
} from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function CheckInPage({
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
       categories:tournament_categories ( *, pools:tournament_pools (*) ),
       teams ( *, players (*) ),
       workspace:workspaces ( payment_info )`
    )
    .eq("id", id)
    .eq("workspace_id", res.member.workspace_id)
    .maybeSingle();
  if (!data) notFound();

  const tour = data as Tournament & {
    categories: (TournamentCategory & { pools: TournamentPool[] })[];
    teams: (Team & { players: Player[] })[];
    workspace: Pick<Workspace, "payment_info"> | null;
  };

  // Payment QR + instructions: tournament-level wins; fall back to
  // workspace defaults so clubs that set venmo/ATH once don't have to
  // re-paste it for every tournament.
  const paymentQrUrl =
    tour.payment_qr_url ||
    tour.workspace?.payment_info?.venmo_qr_url ||
    tour.workspace?.payment_info?.ath_qr_url ||
    null;
  const paymentInstructions = tour.payment_instructions ?? null;

  // Build lookups
  const categoriesById = new Map(tour.categories.map((c) => [c.id, c]));
  const poolsById = new Map(
    tour.categories.flatMap((c) => c.pools).map((p) => [p.id, p])
  );

  // Flatten to per-player rows. Each player gets their team's
  // partner-name + pool letter + pay status precomputed.
  const players: CheckInPlayer[] = tour.teams
    .filter((t) => t.status !== "cancelled")
    .flatMap((t) => {
      const pool = t.pool_id ? poolsById.get(t.pool_id) ?? null : null;
      const cat = categoriesById.get(t.category_id);
      return t.players.map((p) => {
        const partners = t.players.filter((x) => x.id !== p.id);
        const partnerLabel = partners
          .map((x) => `${x.first_name} ${x.last_name}`)
          .join(" & ");
        const allPaid = t.players.every((x) => !!x.paid_at) && !!t.players.length;
        return {
          id: p.id,
          team_id: t.id,
          first_name: p.first_name,
          last_name: p.last_name,
          email: p.email,
          phone: p.phone,
          checked_in_at: p.checked_in_at ?? null,
          partner_label: partnerLabel || "—",
          pool_letter: pool?.letter ?? null,
          category_label: cat ? categoryLabel(cat) : "",
          team_paid: allPaid,
          team_payment_status: t.payment_status,
        };
      });
    })
    .sort((a, b) =>
      `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`)
    );

  return (
    <div>
      <div className="mb-5">
        <Link
          href={`/admin/tournaments/${id}`}
          className="text-xs text-zinc-400 hover:text-white"
        >
          ← {tour.title}
        </Link>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-white">Check-in</h1>
        <p className="text-xs text-zinc-500">
          Tap a player to check them in. WhatsApp confirmation sends automatically
          (sandbox redirects to you).
        </p>
      </div>
      <CheckInList
        tournamentId={id}
        initialPlayers={players}
        paymentQrUrl={paymentQrUrl}
        paymentInstructions={paymentInstructions}
      />
    </div>
  );
}
