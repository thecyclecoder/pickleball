-- Multiple tournament images (replaces single flyer)
alter table public.tournaments
  add column if not exists images text[] not null default '{}'::text[];

-- Backfill from the existing single flyer_image_url when present
update public.tournaments
set images = array[flyer_image_url]
where flyer_image_url is not null
  and (images is null or array_length(images, 1) is null);
