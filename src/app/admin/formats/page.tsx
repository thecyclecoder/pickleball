import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentMembership } from "@/lib/auth";
import { stageRulesText, type TournamentFormat } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminFormatsPage() {
  const res = await getCurrentMembership();
  if (res.status !== "ok") return null;

  const admin = createAdminClient();
  const { data } = await admin
    .from("tournament_formats")
    .select("*")
    .eq("workspace_id", res.member.workspace_id)
    .order("created_at", { ascending: false });
  const formats = (data ?? []) as TournamentFormat[];

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Formats</h1>
          <p className="text-sm text-zinc-400">
            Reusable tournament rules — pool play settings, which elimination rounds exist, and
            how each is played. Attach a format to a category when editing a tournament.
          </p>
        </div>
        <Link
          href="/admin/formats/new"
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
        >
          + New format
        </Link>
      </div>

      {formats.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/40 p-10 text-center">
          <p className="mb-4 text-sm text-zinc-400">No formats yet.</p>
          <Link
            href="/admin/formats/new"
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
          >
            Create the first one
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {formats.map((f) => (
            <li key={f.id}>
              <Link
                href={`/admin/formats/${f.id}`}
                className="block rounded-xl border border-zinc-800 bg-zinc-900 p-5 transition-colors hover:border-emerald-600"
              >
                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-base font-semibold text-white">{f.name}</h2>
                  <span className="text-xs text-zinc-500">
                    Top {f.pool_play_advance_per_pool} advance per pool
                  </span>
                </div>
                {f.description && (
                  <p className="mb-3 text-xs text-zinc-500">{f.description}</p>
                )}
                <dl className="grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
                  <StageSummary
                    label="Pool play"
                    text={stageRulesText(
                      f.pool_play_games_to,
                      f.pool_play_win_by,
                      f.pool_play_best_of
                    )}
                    enabled
                  />
                  <StageSummary
                    label="Quarterfinals"
                    text={stageRulesText(
                      f.quarterfinals_games_to,
                      f.quarterfinals_win_by,
                      f.quarterfinals_best_of
                    )}
                    enabled={f.has_quarterfinals}
                  />
                  <StageSummary
                    label="Semifinals"
                    text={stageRulesText(
                      f.semifinals_games_to,
                      f.semifinals_win_by,
                      f.semifinals_best_of
                    )}
                    enabled={f.has_semifinals}
                  />
                  <StageSummary
                    label="Finals"
                    text={stageRulesText(
                      f.finals_games_to,
                      f.finals_win_by,
                      f.finals_best_of
                    )}
                    enabled={f.has_finals}
                  />
                </dl>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StageSummary({ label, text, enabled }: { label: string; text: string; enabled: boolean }) {
  return (
    <div className={enabled ? "" : "opacity-40"}>
      <dt className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</dt>
      <dd className="mt-0.5 text-zinc-200">{enabled ? text : "Not used"}</dd>
    </div>
  );
}
