import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentMembership } from "@/lib/auth";
import { FormatForm } from "../format-form";
import type { TournamentFormat } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function EditFormatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const res = await getCurrentMembership();
  if (res.status !== "ok") return null;
  const { id } = await params;

  const admin = createAdminClient();
  const { data } = await admin
    .from("tournament_formats")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", res.member.workspace_id)
    .limit(1)
    .single();

  if (!data) notFound();
  const format = data as TournamentFormat;

  return (
    <div>
      <Link href="/admin/formats" className="mb-2 inline-block text-xs text-zinc-400 hover:text-white">
        ← Formats
      </Link>
      <h1 className="mb-6 text-2xl font-bold tracking-tight text-white">{format.name}</h1>
      <FormatForm mode="edit" initial={format} />
    </div>
  );
}
