import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { parsePlayerUpdateToken } from "@/lib/player-update-token";
import { PublicHeader } from "@/components/public-header";
import { PublicFooter } from "@/components/public-footer";
import { UpdateForm } from "./update-form";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Update your contact info",
  robots: { index: false, follow: false },
};

export default async function PlayerUpdatePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const parsed = parsePlayerUpdateToken(token);
  if (!parsed) notFound();

  const admin = createAdminClient();
  const { data: player } = await admin
    .from("players")
    .select(
      `id, first_name, last_name, email, phone,
       team:teams (
         tournament:tournaments (id, slug, title, start_date, timezone)
       )`
    )
    .eq("id", parsed.playerId)
    .maybeSingle();
  if (!player) notFound();

  type LoadedPlayer = {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string | null;
    team: {
      tournament: {
        id: string;
        slug: string;
        title: string;
        start_date: string;
        timezone: string;
      } | null;
    } | null;
  };
  const p = player as unknown as LoadedPlayer;
  const tournament = p.team?.tournament ?? null;

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950">
      <PublicHeader />
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-10 sm:px-6 sm:py-14">
        <p className="mb-2 text-xs uppercase tracking-[0.2em] text-emerald-500">
          {tournament?.title ? `For ${tournament.title}` : "Your Buen Tiro profile"}
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-white">
          Add your WhatsApp number
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-zinc-400">
          Hi {p.first_name}, we&apos;ll use this to send you live tournament updates: your pool
          and seed when brackets drop, your court call when it&apos;s time to play, score and
          schedule changes during the day.
        </p>
        <p className="mt-2 text-xs text-zinc-500">
          On file: <strong className="text-zinc-300">{p.first_name} {p.last_name}</strong> ·{" "}
          {p.email}
        </p>
        <UpdateForm
          token={token}
          initialPhone={p.phone ?? ""}
          firstName={p.first_name}
        />
      </main>
      <PublicFooter />
    </div>
  );
}
