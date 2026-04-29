// Strict, format-driven score validation for tournament games.
//
// A "game" here is the single recorded result on the `games` row
// (score_a / score_b). For best_of=1 stages — pool, QF, SF — the
// scores are the literal point totals of that one game.
//
// Best-of-N (e.g. finals best-of-3 to 11) needs per-game scores
// stored separately. That requires a `match_scores jsonb` column
// extension on `games`; until that lands, this validator rejects
// best_of>1 with a clear error so we can't silently accept malformed
// finals scores. Pool play (May 9 Money Ball) only uses best_of=1,
// so this is good enough for now.

export type ScoreFormatRules = {
  gamesTo: number;
  winBy: number;
  bestOf: number;
};

export type ScoreValidationResult = { ok: true } | { ok: false; error: string };

export function validateGameScore(
  rules: ScoreFormatRules,
  scoreA: number,
  scoreB: number,
  opts: { forfeit?: boolean } = {}
): ScoreValidationResult {
  if (!Number.isInteger(scoreA) || !Number.isInteger(scoreB)) {
    return { ok: false, error: "Scores must be whole numbers" };
  }
  if (scoreA < 0 || scoreB < 0) {
    return { ok: false, error: "Scores can't be negative" };
  }

  if (opts.forfeit) {
    // Forfeit / mid-tournament withdrawal: one side gets gamesTo, other gets 0.
    const high = Math.max(scoreA, scoreB);
    const low = Math.min(scoreA, scoreB);
    if (high !== rules.gamesTo || low !== 0) {
      return { ok: false, error: `Forfeits must be ${rules.gamesTo}-0` };
    }
    return { ok: true };
  }

  if (rules.bestOf > 1) {
    return {
      ok: false,
      error: "Best-of-N scoring isn't supported yet — record each game separately when that ships",
    };
  }

  if (scoreA === scoreB) {
    return { ok: false, error: "A game can't end in a tie" };
  }

  const high = Math.max(scoreA, scoreB);
  const low = Math.min(scoreA, scoreB);

  // Winner must reach at least gamesTo; if the loser is at gamesTo - 1 (or
  // closer), the winner needs to lead by win_by. e.g. games_to=11, win_by=2:
  // valid finals 11-0..11-9, 12-10, 13-11, 14-12, …
  if (high < rules.gamesTo) {
    return { ok: false, error: `Winner must reach at least ${rules.gamesTo}` };
  }
  if (high - low < rules.winBy) {
    return { ok: false, error: `Winner must lead by at least ${rules.winBy}` };
  }
  // Once the winner is past games_to, the lead must be exactly win_by — a
  // 13-9 score (lead of 4) shouldn't happen at games_to=11/win_by=2 because
  // play stops at the moment win_by is reached.
  if (high > rules.gamesTo && high - low > rules.winBy) {
    return {
      ok: false,
      error: `Past ${rules.gamesTo}, the lead can only be ${rules.winBy}`,
    };
  }

  return { ok: true };
}

export function rulesForStage(
  format: {
    pool_play_games_to: number;
    pool_play_win_by: number;
    pool_play_best_of: number;
    quarterfinals_games_to: number | null;
    quarterfinals_win_by: number | null;
    quarterfinals_best_of: number | null;
    semifinals_games_to: number | null;
    semifinals_win_by: number | null;
    semifinals_best_of: number | null;
    finals_games_to: number | null;
    finals_win_by: number | null;
    finals_best_of: number | null;
  },
  stage: "pool" | "qf" | "sf" | "f"
): ScoreFormatRules | null {
  if (stage === "pool") {
    return {
      gamesTo: format.pool_play_games_to,
      winBy: format.pool_play_win_by,
      bestOf: format.pool_play_best_of,
    };
  }
  if (stage === "qf") {
    if (
      format.quarterfinals_games_to == null ||
      format.quarterfinals_win_by == null ||
      format.quarterfinals_best_of == null
    ) return null;
    return {
      gamesTo: format.quarterfinals_games_to,
      winBy: format.quarterfinals_win_by,
      bestOf: format.quarterfinals_best_of,
    };
  }
  if (stage === "sf") {
    if (
      format.semifinals_games_to == null ||
      format.semifinals_win_by == null ||
      format.semifinals_best_of == null
    ) return null;
    return {
      gamesTo: format.semifinals_games_to,
      winBy: format.semifinals_win_by,
      bestOf: format.semifinals_best_of,
    };
  }
  if (
    format.finals_games_to == null ||
    format.finals_win_by == null ||
    format.finals_best_of == null
  ) return null;
  return {
    gamesTo: format.finals_games_to,
    winBy: format.finals_win_by,
    bestOf: format.finals_best_of,
  };
}
