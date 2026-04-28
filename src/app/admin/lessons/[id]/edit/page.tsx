import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentMembership } from "@/lib/auth";
import { LessonForm } from "../../lesson-form";
import type { Lesson } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminLessonEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const res = await getCurrentMembership();
  if (res.status !== "ok") return null;
  if (res.workspaceKind !== "coach") redirect("/admin");
  const { id } = await params;

  const admin = createAdminClient();
  const { data } = await admin
    .from("lessons")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", res.member.workspace_id)
    .maybeSingle();
  if (!data) notFound();
  const lesson = data as Lesson;

  return (
    <div>
      <div className="mb-6">
        <Link href={`/admin/lessons/${lesson.id}`} className="text-xs text-zinc-500 hover:text-white">
          ← Back to lesson
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-white">Edit lesson</h1>
      </div>
      <LessonForm mode="edit" initial={lesson} />
    </div>
  );
}
