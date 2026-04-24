# Pickleball Tournament Manager

## Project Overview
A tournament management platform for pickleball. Organizers create tournaments, players register as teams (doubles format). Multi-tenant with workspace scoping.

- **GitHub**: https://github.com/thecyclecoder/pickleball
- **Vercel**: dylan-ralstons-projects/pickleball (Pro plan, Next.js)
- **Supabase**: project ref `jfpeyuwffumrlkokejha` (Superfoods Company org)

## Tech Stack
- **Frontend**: Next.js (App Router), Tailwind CSS, TypeScript
- **Backend**: Supabase (Postgres + RLS + Storage), Vercel serverless
- **Auth**: Google OAuth via Supabase Auth
- **File Storage**: Supabase Storage (tournament flyer images)

## Supabase Connection
- **Project ref**: `jfpeyuwffumrlkokejha`
- **URL**: `https://jfpeyuwffumrlkokejha.supabase.co`
- **Client files**: Same pattern as ShopCX
  - `src/lib/supabase/client.ts` — browser client
  - `src/lib/supabase/server.ts` — SSR client (cookies)
  - `src/lib/supabase/admin.ts` — service role client (all writes)
- **Env vars**: `.env.local` and Vercel production

## Setup Required (manual)
1. **Enable Google Auth**: Supabase Dashboard → Authentication → Providers → Google
   - Redirect URL: `https://jfpeyuwffumrlkokejha.supabase.co/auth/v1/callback`
2. **Create Storage bucket**: `tournament-images` (public, 5MB limit, image/* only)
3. **Set NEXT_PUBLIC_SITE_URL** on Vercel once domain is assigned

## Architecture

### Route Structure
```
/ .......................... Public landing page
/tournaments ............... Public tournament list
/tournaments/[id] .......... Public tournament detail + signup form + registered teams
/login ..................... Google OAuth login
/auth/callback ............. OAuth callback handler
/admin ..................... Auth-gated dashboard (tournament management)
/admin/tournaments ......... Tournament list (CRUD)
/admin/tournaments/new ..... Create tournament
/admin/tournaments/[id] .... Edit tournament + view registrations
```

### Auth & Access Control
- **Public**: `/`, `/tournaments`, `/tournaments/[id]`, `/api/tournaments/*`
- **Auth-gated**: `/admin/*` — requires Google login
- **Workspace members only**: On login, check `workspace_members` table. If user is not a member, show "Access Denied" page
- **Owner**: dylanralston@gmail.com — auto-created as owner on first workspace setup
- **Invite flow**: Owner invites users by email → row in `workspace_members` → invited user can log in

### Data Model
```
Workspace (multi-tenant root)
  └── Tournament (event with categories)
       └── Category (e.g., "Men's 4.0 Doubles")
            └── Team (pair of players, scoped to category)
                 ├── Player 1 (first_name, last_name, email, rating)
                 └── Player 2 (first_name, last_name, email, rating)
```

### Admin Client Pattern
All writes go through `createAdminClient()` (service_role), never client-side. Auth verified via `createClient().auth.getUser()` on server.

## Database Schema

### `workspaces`
```sql
id UUID PRIMARY KEY DEFAULT gen_random_uuid()
name TEXT NOT NULL
owner_email TEXT NOT NULL          -- dylanralston@gmail.com
payment_info JSONB DEFAULT '{}'   -- {venmo_qr_url, ath_qr_url}
created_at TIMESTAMPTZ DEFAULT now()
```

### `workspace_members`
```sql
id UUID PRIMARY KEY DEFAULT gen_random_uuid()
workspace_id UUID REFERENCES workspaces(id)
user_id UUID REFERENCES auth.users(id)  -- NULL until user logs in
email TEXT NOT NULL
role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member'))
invited_at TIMESTAMPTZ DEFAULT now()
joined_at TIMESTAMPTZ                    -- set on first login
UNIQUE(workspace_id, email)
```

### `tournaments`
```sql
id UUID PRIMARY KEY DEFAULT gen_random_uuid()
workspace_id UUID NOT NULL REFERENCES workspaces(id)
slug TEXT NOT NULL UNIQUE               -- URL-friendly, auto-generated from title
title TEXT NOT NULL
description TEXT
details TEXT                            -- rich details (rules, prizes, etc.)
flyer_image_url TEXT                    -- Supabase Storage URL
start_date DATE NOT NULL
end_date DATE                           -- NULL if single day
start_time TIME NOT NULL
timezone TEXT NOT NULL DEFAULT 'America/Puerto_Rico'  -- IANA timezone
location TEXT NOT NULL                  -- venue name
address TEXT                            -- street address
google_maps_url TEXT                    -- directions link
status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'cancelled', 'completed'))
registration_open BOOLEAN DEFAULT true
created_at TIMESTAMPTZ DEFAULT now()
updated_at TIMESTAMPTZ DEFAULT now()
```

### `tournament_categories`
```sql
id UUID PRIMARY KEY DEFAULT gen_random_uuid()
tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE
type TEXT NOT NULL CHECK (type IN ('MD', 'WD', 'MXD'))  -- Men's/Women's/Mixed Doubles
rating TEXT NOT NULL                    -- '3.0', '3.5', '4.0', '4.5', '4.5+', 'open'
label TEXT                              -- display label override, e.g., "Men's 4.0 Doubles"
team_limit INTEGER NOT NULL DEFAULT 16  -- max teams in this category
sort_order INTEGER DEFAULT 0
created_at TIMESTAMPTZ DEFAULT now()
UNIQUE(tournament_id, type, rating)
```

### `teams`
```sql
id UUID PRIMARY KEY DEFAULT gen_random_uuid()
tournament_id UUID NOT NULL REFERENCES tournaments(id)
category_id UUID NOT NULL REFERENCES tournament_categories(id)
workspace_id UUID NOT NULL REFERENCES workspaces(id)
status TEXT NOT NULL DEFAULT 'registered' CHECK (status IN ('registered', 'confirmed', 'waitlisted', 'cancelled'))
payment_status TEXT DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid', 'refunded'))
registered_at TIMESTAMPTZ DEFAULT now()
```

### `players`
```sql
id UUID PRIMARY KEY DEFAULT gen_random_uuid()
team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE
first_name TEXT NOT NULL
last_name TEXT NOT NULL
email TEXT NOT NULL
rating DECIMAL(2,1) NOT NULL            -- e.g., 3.0, 3.5, 4.0, 4.5, 5.0
is_captain BOOLEAN DEFAULT false        -- player 1 = captain (submitter)
created_at TIMESTAMPTZ DEFAULT now()
```

### RLS Policies
- **workspaces**: authenticated members can SELECT, service_role has ALL
- **workspace_members**: authenticated members can SELECT, service_role has ALL
- **tournaments**: everyone can SELECT published, service_role has ALL
- **tournament_categories**: everyone can SELECT, service_role has ALL
- **teams**: everyone can SELECT, service_role has ALL
- **players**: everyone can SELECT, service_role has ALL

## API Endpoints

### Public (no auth)
- `GET /api/tournaments` — list published tournaments (with categories + team counts)
- `GET /api/tournaments/[id]` — tournament detail + categories + teams + players
- `POST /api/tournaments/[id]/register` — register a team (creates team + 2 players)

### Auth-gated (admin)
- `GET /api/admin/tournaments` — list all tournaments for workspace
- `POST /api/admin/tournaments` — create tournament
- `PATCH /api/admin/tournaments/[id]` — update tournament
- `DELETE /api/admin/tournaments/[id]` — delete tournament
- `POST /api/admin/tournaments/[id]/categories` — add category
- `PATCH /api/admin/tournaments/[id]/categories/[catId]` — update category
- `DELETE /api/admin/tournaments/[id]/categories/[catId]` — delete category
- `PATCH /api/admin/teams/[teamId]` — update team status/payment
- `POST /api/admin/upload-flyer` — upload flyer image to Supabase Storage

## Tournament Detail Page (`/tournaments/[id]`)
Public page that displays:

1. **Flyer image** (hero, full width)
2. **Tournament info**: title, description, date(s), start time + timezone, location with Google Maps link
3. **Details section**: rules, prizes, format info
4. **Categories**: list of available categories with spots remaining (e.g., "Men's 4.0 — 12/16 teams")
5. **Payment info**: Venmo/ATH QR code images from workspace settings
6. **Registration form**:
   - Category selector (dropdown, only categories with open spots)
   - Player 1: first name, last name, email, rating (dropdown: 2.5, 3.0, 3.5, 4.0, 4.5, 5.0)
   - Player 2: first name, last name, email, rating
   - Submit → creates team + players → shows confirmation
   - If category is full, show "Waitlist" button instead
7. **Registered teams**: grouped by category, showing team names and spots remaining

## Admin Dashboard (`/admin`)
Auth-gated area:

1. **Tournament list**: table with title, date, status, team count, actions (edit/delete)
2. **Create tournament**: form with all tournament fields + category builder + flyer upload
3. **Tournament detail**: edit form + registrations table (teams, players, payment status)
4. **Team management**: mark payment as paid, cancel teams, move to waitlist

## Key Implementation Notes
- **Slug generation**: Auto-generate from title, ensure uniqueness with suffix if needed
- **Category labels**: Auto-generate from type + rating (e.g., "MD" + "4.0" = "Men's Doubles 4.0") unless `label` override provided
- **Team limit enforcement**: Check count before inserting team. If at limit, set status to 'waitlisted'
- **Timezone**: Default to 'America/Puerto_Rico'. Store IANA timezone, display times in that timezone
- **Flyer upload**: Use Supabase Storage bucket `tournament-images`, store public URL in tournament record
- **QR codes for payment**: Stored as image URLs in workspace `payment_info` JSONB
- **No payment processing**: Just display QR codes. Admin manually marks teams as paid.
- **Registration validation**: Reject if same email already registered in same category
- **Dark theme**: zinc-950 background, emerald accents

## Environment Variables (set in .env.local and Vercel)
```
NEXT_PUBLIC_SUPABASE_URL=https://jfpeyuwffumrlkokejha.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>
NEXT_PUBLIC_SITE_URL=<vercel URL or custom domain>
```

## Conventions
- Run `npx tsc --noEmit` before committing
- Migrations: `supabase/migrations/YYYYMMDDNNNNNN_description.sql`
- API routes: `/api/resource/route.ts` or `/api/resource/[id]/route.ts`
- All API writes use admin client
- Auth check: `createClient().auth.getUser()` then verify workspace membership
