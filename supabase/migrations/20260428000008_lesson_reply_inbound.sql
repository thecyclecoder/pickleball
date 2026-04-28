-- Inbound replies via the lesson-request relay address
-- (lr-<id>-<hmac>@replies.buentiro.app). Resend Inbound webhooks land
-- player↔coach replies here, threaded by lesson_request_id.
--
-- direction:
--   outbound — sent by Buen Tiro (coach via composer, or forwarded
--              relay of an inbound message)
--   inbound  — landed via the inbound webhook (player or coach reply
--              from their email client)
--
-- email_message_id is captured for future RFC-style threading; it's
-- nullable since older outbound rows won't have one.

alter table public.lesson_request_replies
  add column if not exists direction text not null default 'outbound'
  check (direction in ('outbound', 'inbound'));

alter table public.lesson_request_replies
  add column if not exists email_message_id text;

alter table public.lesson_request_replies
  add column if not exists subject text;

create index if not exists lesson_request_replies_email_message_id_idx
  on public.lesson_request_replies(email_message_id);
