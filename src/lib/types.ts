export type CategoryType = "MD" | "WD" | "MXD";

export type TournamentImage = {
  srcset: { w: number; url: string }[];
};

export const IMAGE_WIDTHS = [480, 800, 1200, 1800] as const;

export function largestSrc(img: TournamentImage): string {
  const sorted = [...img.srcset].sort((a, b) => b.w - a.w);
  return sorted[0]?.url ?? "";
}

export function pickSrc(img: TournamentImage, targetWidth: number): string {
  const sorted = [...img.srcset].sort((a, b) => a.w - b.w);
  for (const s of sorted) if (s.w >= targetWidth) return s.url;
  return sorted[sorted.length - 1]?.url ?? "";
}

export function srcSetAttr(img: TournamentImage): string {
  return img.srcset
    .slice()
    .sort((a, b) => a.w - b.w)
    .map((s) => `${s.url} ${s.w}w`)
    .join(", ");
}
export type TournamentStatus = "draft" | "published" | "cancelled" | "completed";
export type TeamStatus = "registered" | "confirmed" | "waitlisted" | "cancelled";
export type PaymentStatus = "unpaid" | "paid" | "refunded";

export type Workspace = {
  id: string;
  name: string;
  owner_email: string;
  payment_info: {
    venmo_qr_url?: string;
    ath_qr_url?: string;
    venmo_handle?: string;
    ath_handle?: string;
  };
  created_at: string;
};

export type WorkspaceMember = {
  id: string;
  workspace_id: string;
  user_id: string | null;
  email: string;
  role: "owner" | "admin" | "member";
  invited_at: string;
  joined_at: string | null;
};

export type Tournament = {
  id: string;
  workspace_id: string;
  slug: string;
  title: string;
  description: string | null;
  details: string | null;
  flyer_image_url: string | null;
  images: TournamentImage[];
  title_es: string | null;
  description_es: string | null;
  details_es: string | null;
  location_es: string | null;
  address_es: string | null;
  start_date: string;
  end_date: string | null;
  start_time: string;
  timezone: string;
  location: string;
  address: string | null;
  google_maps_url: string | null;
  status: TournamentStatus;
  registration_open: boolean;
  payment_qr_url: string | null;
  payment_instructions: string | null;
  payment_instructions_es: string | null;
  created_at: string;
  updated_at: string;
};

export type TournamentCategory = {
  id: string;
  tournament_id: string;
  type: CategoryType;
  rating: string;
  label: string | null;
  label_es: string | null;
  team_limit: number;
  sort_order: number;
  format_id: string | null;
  pool_count: number | null;
  advance_per_pool: number | null;
  created_at: string;
};

export type TournamentFormat = {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  pool_play_games_to: number;
  pool_play_win_by: number;
  pool_play_best_of: number;
  pool_play_advance_per_pool: number;
  has_quarterfinals: boolean;
  quarterfinals_games_to: number | null;
  quarterfinals_win_by: number | null;
  quarterfinals_best_of: number | null;
  has_semifinals: boolean;
  semifinals_games_to: number | null;
  semifinals_win_by: number | null;
  semifinals_best_of: number | null;
  has_finals: boolean;
  finals_games_to: number | null;
  finals_win_by: number | null;
  finals_best_of: number | null;
  created_at: string;
  updated_at: string;
};

/** Human-friendly description of a single stage's rules, e.g.
 *  "Best of 3, games to 11, win by 2". */
export function stageRulesText(
  gamesTo: number | null,
  winBy: number | null,
  bestOf: number | null
): string {
  if (!gamesTo || !winBy || !bestOf) return "—";
  const gamesPart = bestOf > 1 ? `Best of ${bestOf}, games to ${gamesTo}` : `1 game to ${gamesTo}`;
  return winBy > 1 ? `${gamesPart}, win by ${winBy}` : gamesPart;
}

export type Team = {
  id: string;
  tournament_id: string;
  category_id: string;
  workspace_id: string;
  status: TeamStatus;
  payment_status: PaymentStatus;
  registered_at: string;
};

export type Player = {
  id: string;
  team_id: string | null;
  workspace_id: string | null;
  user_id: string | null;
  first_name: string;
  last_name: string;
  email: string;
  rating: number;
  is_captain: boolean;
  confirmed_at: string | null;
  created_at: string;
};

export type TeamWithPlayers = Team & { players: Player[] };

export type CategoryWithTeams = TournamentCategory & {
  teams: TeamWithPlayers[];
  active_team_count: number;
};

export type TournamentWithDetails = Tournament & {
  categories: CategoryWithTeams[];
};

export const RATING_OPTIONS = ["2.5", "3.0", "3.5", "4.0", "4.5", "5.0", "5.5", "6.0", "6.5"] as const;
export const CATEGORY_RATINGS = ["3.0", "3.5", "4.0", "4.0+", "4.5", "4.5+", "5.0", "5.0+", "open"] as const;
export const CATEGORY_TYPES: CategoryType[] = ["MD", "WD", "MXD"];
