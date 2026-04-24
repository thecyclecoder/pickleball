import type { MetadataRoute } from "next";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://buentiro.app";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const admin = createAdminClient();
  const { data: tournaments } = await admin
    .from("tournaments")
    .select("slug, updated_at, start_date")
    .eq("status", "published")
    .order("start_date", { ascending: false });

  const now = new Date();
  const tournamentEntries: MetadataRoute.Sitemap = (tournaments ?? []).map((t) => ({
    url: `${SITE_URL}/tournaments/${t.slug}`,
    lastModified: t.updated_at ? new Date(t.updated_at) : now,
    changeFrequency: "daily",
    priority: 0.8,
  }));

  return [
    { url: SITE_URL, lastModified: now, changeFrequency: "weekly", priority: 1 },
    {
      url: `${SITE_URL}/tournaments`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    ...tournamentEntries,
  ];
}
