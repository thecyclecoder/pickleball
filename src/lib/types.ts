export type CategoryType = "MD" | "WD" | "MXD";
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
  images: string[];
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
  created_at: string;
};

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
  team_id: string;
  first_name: string;
  last_name: string;
  email: string;
  rating: number;
  is_captain: boolean;
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

export const RATING_OPTIONS = ["2.5", "3.0", "3.5", "4.0", "4.5", "5.0"] as const;
export const CATEGORY_RATINGS = ["3.0", "3.5", "4.0", "4.5", "4.5+", "open"] as const;
export const CATEGORY_TYPES: CategoryType[] = ["MD", "WD", "MXD"];
