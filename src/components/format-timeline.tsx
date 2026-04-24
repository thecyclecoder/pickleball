import { Fragment } from "react";
import { stageRulesText, type TournamentFormat } from "@/lib/types";

type Stage = {
  name: string;
  rule: string;
  detail?: string;
  tone: "pool" | "mid" | "final";
};

/** Visualizes a tournament format as a flow: Pool → QF → SF → Finals.
 *  Stacks vertically on mobile (down arrows) and lays out horizontally
 *  on sm+ (right arrows). Disabled stages are skipped. Finals gets a
 *  warm amber accent. */
export function FormatTimeline({
  format,
  advancePerPool,
  locale = "en",
}: {
  format: TournamentFormat;
  advancePerPool?: number | null;
  locale?: "en" | "es";
}) {
  const advance = advancePerPool ?? format.pool_play_advance_per_pool;
  const L = locale === "es"
    ? { pool: "Fase de grupos", qf: "Cuartos de final", sf: "Semifinales", f: "Final", topPer: (n: number) => `Top ${n} por grupo avanza${n === 1 ? "" : "n"}` }
    : { pool: "Pool play", qf: "Quarterfinals", sf: "Semifinals", f: "Finals", topPer: (n: number) => `Top ${n} per pool advance${n === 1 ? "s" : ""}` };

  const stages: Stage[] = [];
  stages.push({
    name: L.pool,
    rule: stageRulesText(format.pool_play_games_to, format.pool_play_win_by, format.pool_play_best_of, locale),
    detail: L.topPer(advance),
    tone: "pool",
  });
  if (format.has_quarterfinals) {
    stages.push({
      name: L.qf,
      rule: stageRulesText(format.quarterfinals_games_to, format.quarterfinals_win_by, format.quarterfinals_best_of, locale),
      tone: "mid",
    });
  }
  if (format.has_semifinals) {
    stages.push({
      name: L.sf,
      rule: stageRulesText(format.semifinals_games_to, format.semifinals_win_by, format.semifinals_best_of, locale),
      tone: "mid",
    });
  }
  if (format.has_finals) {
    stages.push({
      name: L.f,
      rule: stageRulesText(format.finals_games_to, format.finals_win_by, format.finals_best_of, locale),
      tone: "final",
    });
  }

  return (
    <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-stretch sm:gap-0">
      {stages.map((stage, i) => (
        <Fragment key={stage.name}>
          {i > 0 && <Connector />}
          <StagePill stage={stage} />
        </Fragment>
      ))}
    </div>
  );
}

function StagePill({ stage }: { stage: Stage }) {
  const toneClass =
    stage.tone === "pool"
      ? "border-emerald-800/60 bg-emerald-950/30"
      : stage.tone === "final"
        ? "border-amber-800/60 bg-amber-950/30"
        : "border-zinc-800 bg-zinc-950";
  const labelClass =
    stage.tone === "pool"
      ? "text-emerald-400"
      : stage.tone === "final"
        ? "text-amber-400"
        : "text-zinc-500";
  return (
    <div className={`flex-1 rounded-lg border px-3 py-2.5 ${toneClass}`}>
      <p className={`text-[10px] font-semibold uppercase tracking-wider ${labelClass}`}>{stage.name}</p>
      <p className="mt-1 text-xs font-medium text-zinc-100">{stage.rule}</p>
      {stage.detail && <p className="mt-0.5 text-[11px] text-zinc-500">{stage.detail}</p>}
    </div>
  );
}

function Connector() {
  return (
    <div
      className="flex items-center justify-center text-zinc-600 sm:px-2"
      aria-hidden
    >
      {/* Down arrow on mobile, right arrow on sm+ */}
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        className="rotate-90 sm:rotate-0"
      >
        <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
