-- Per-player payment tracking. Two people on a team pay separately, and
-- one may pay before the other. teams.payment_status is a team-level
-- concept that stays for refund/cancellation workflow; actual "did this
-- person send their share" lives on the player row.

alter table public.players
  add column if not exists paid_at timestamptz;

create index if not exists players_paid_at_idx on public.players(paid_at)
  where paid_at is not null;
