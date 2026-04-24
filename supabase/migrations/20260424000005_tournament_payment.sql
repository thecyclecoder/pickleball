-- Per-tournament payment info: QR code image + free-text instructions (EN/ES)
alter table public.tournaments
  add column if not exists payment_qr_url text,
  add column if not exists payment_instructions text,
  add column if not exists payment_instructions_es text;
