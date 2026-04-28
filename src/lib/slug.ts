import type { SupabaseClient } from "@supabase/supabase-js";

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export async function uniqueTournamentSlug(
  admin: SupabaseClient,
  base: string,
  ignoreId?: string
): Promise<string> {
  return uniqueSlugInTable(admin, "tournaments", base, "tournament", ignoreId);
}

export async function uniqueClinicSlug(
  admin: SupabaseClient,
  base: string,
  ignoreId?: string
): Promise<string> {
  return uniqueSlugInTable(admin, "clinics", base, "clinic", ignoreId);
}

async function uniqueSlugInTable(
  admin: SupabaseClient,
  table: string,
  base: string,
  fallback: string,
  ignoreId?: string
): Promise<string> {
  const root = slugify(base) || fallback;
  let candidate = root;
  for (let i = 2; i < 1000; i++) {
    let q = admin.from(table).select("id").eq("slug", candidate).limit(1);
    if (ignoreId) q = q.neq("id", ignoreId);
    const { data, error } = await q;
    if (error) throw error;
    if (!data || data.length === 0) return candidate;
    candidate = `${root}-${i}`;
  }
  return `${root}-${Date.now()}`;
}
