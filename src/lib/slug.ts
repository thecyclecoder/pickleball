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
  const root = slugify(base) || "tournament";
  let candidate = root;
  for (let i = 2; i < 1000; i++) {
    let q = admin.from("tournaments").select("id").eq("slug", candidate).limit(1);
    if (ignoreId) q = q.neq("id", ignoreId);
    const { data, error } = await q;
    if (error) throw error;
    if (!data || data.length === 0) return candidate;
    candidate = `${root}-${i}`;
  }
  return `${root}-${Date.now()}`;
}
