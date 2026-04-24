-- Change tournaments.images to jsonb so each image can carry multiple
-- pre-rendered sizes (srcset for responsive rendering).
-- No production data yet, so we drop and recreate.
alter table public.tournaments drop column if exists images;
alter table public.tournaments
  add column images jsonb not null default '[]'::jsonb;

-- Shape per element:
-- {
--   "srcset": [
--     { "w": 480,  "url": "https://.../xxxx-480.webp" },
--     { "w": 800,  "url": "https://.../xxxx-800.webp" },
--     { "w": 1200, "url": "https://.../xxxx-1200.webp" },
--     { "w": 1800, "url": "https://.../xxxx-1800.webp" }
--   ]
-- }
